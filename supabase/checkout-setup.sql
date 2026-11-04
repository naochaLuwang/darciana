-- Run once AFTER setup.sql, admin-setup.sql, shipping-setup.sql and address-setup.sql.
-- Adds COD checkout without rewriting or relabelling earlier order requests.
begin;
create function private.storefront_submit_order(
  p_request_id uuid, p_items jsonb, p_shipping jsonb, p_expected_total numeric,
  p_payment_mode text, p_terms_accepted boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  customer_id uuid := auth.uid();
  previous public.storefront_order_requests%rowtype;
  result jsonb;
begin
  if customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  if p_payment_mode is distinct from 'cash_on_delivery' then raise exception 'INVALID_PAYMENT_MODE'; end if;
  if p_terms_accepted is distinct from true then raise exception 'TERMS_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(customer_id::text,0));
  select * into previous from public.storefront_order_requests where user_id=customer_id and request_key=p_request_id;
  if found then
    if previous.shipping->>'payment_mode' is distinct from 'cash_on_delivery' or previous.order_total is null then
      raise exception 'LEGACY_REQUEST';
    end if;
    return jsonb_build_object('id',previous.id,'item_total',previous.item_total,'shipping_price',previous.shipping_price,'shipping_area_name',previous.shipping_area_name,'order_total',previous.order_total,'payment_mode','cash_on_delivery');
  end if;
  -- Reuse authoritative stock, item/area pricing and address checks.
  -- The order and its saved-address trigger remain in this transaction.
  result := private.darciana_submit_request(p_request_id,p_items,p_shipping,p_expected_total);
  update public.storefront_order_requests set shipping=shipping || jsonb_build_object(
    'payment_mode','cash_on_delivery',
    'terms_version','2026-11-cod-v1',
    'terms_accepted_at',clock_timestamp()
  ) where id=(result->>'id')::uuid and user_id=customer_id;
  return result || jsonb_build_object('payment_mode','cash_on_delivery');
end $$;
revoke all on function private.storefront_submit_order(uuid,jsonb,jsonb,numeric,text,boolean) from public,anon,authenticated;
grant execute on function private.storefront_submit_order(uuid,jsonb,jsonb,numeric,text,boolean) to authenticated;
create function public.storefront_submit_order(
  p_request_id uuid, p_items jsonb, p_shipping jsonb, p_expected_total numeric,
  p_payment_mode text, p_terms_accepted boolean
) returns jsonb language sql security invoker set search_path='' as $$
  select private.storefront_submit_order(p_request_id,p_items,p_shipping,p_expected_total,p_payment_mode,p_terms_accepted);
$$;
revoke all on function public.storefront_submit_order(uuid,jsonb,jsonb,numeric,text,boolean) from public,anon,authenticated;
grant execute on function public.storefront_submit_order(uuid,jsonb,jsonb,numeric,text,boolean) to authenticated;
commit;
notify pgrst,'reload schema';
