-- Run once in your project's SQL Editor. Additive: existing catalog is not changed.
-- This workflow records order REQUESTS; it does not take payments or reserve stock.
begin;

create schema if not exists private;

create table public.storefront_order_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_key uuid not null,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  item_total numeric(12,2) not null check (item_total >= 0),
  shipping jsonb not null check (jsonb_typeof(shipping) = 'object'),
  status text not null default 'awaiting_confirmation'
    check (status in ('awaiting_confirmation', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (user_id, request_key)
);
create index storefront_requests_user_created_idx on public.storefront_order_requests (user_id, created_at desc);
alter table public.storefront_order_requests enable row level security;
revoke all on public.storefront_order_requests from anon, authenticated;
grant select on public.storefront_order_requests to authenticated;
create policy "Customers read their own requests" on public.storefront_order_requests
  for select to authenticated using ((select auth.uid()) = user_id);

-- Privilege is needed only for the validated insert. Keep the implementation in
-- the unexposed private schema; the public entry point uses SECURITY INVOKER.
create function private.darciana_submit_request(
  p_request_id uuid, p_items jsonb, p_shipping jsonb, p_expected_total numeric
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  customer_id uuid := auth.uid();
  existing public.storefront_order_requests%rowtype;
  line jsonb;
  product public.products%rowtype;
  variant public.product_variants%rowtype;
  quantity integer;
  raw_price numeric;
  unit_price numeric;
  discount_kind text;
  discount_amount numeric;
  total numeric := 0;
  snapshot jsonb := '[]'::jsonb;
  order_id uuid;
begin
  if customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  -- Serialize retries and rate-limit checks for this customer.
  perform pg_advisory_xact_lock(hashtextextended(customer_id::text, 0));
  select * into existing from public.storefront_order_requests
    where user_id = customer_id and request_key = p_request_id;
  if found then return jsonb_build_object('id', existing.id, 'item_total', existing.item_total); end if;
  if (select count(*) from public.storefront_order_requests where user_id = customer_id and created_at > now() - interval '1 hour') >= 5 then raise exception 'RATE_LIMIT'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_ITEMS'; end if;
  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then raise exception 'INVALID_ITEMS'; end if;
  if (select count(distinct value->>'variant_id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then raise exception 'INVALID_ITEMS'; end if;
  if p_shipping is null or jsonb_typeof(p_shipping) <> 'object' then raise exception 'INVALID_ADDRESS'; end if;
  if coalesce(length(btrim(p_shipping->>'name')), 0) not between 2 and 100
    or coalesce(length(btrim(p_shipping->>'address')), 0) not between 8 and 300
    or coalesce(length(btrim(p_shipping->>'city')), 0) not between 2 and 100
    or coalesce(length(btrim(p_shipping->>'state')), 0) not between 2 and 100
    or coalesce(p_shipping->>'phone', '') !~ '^(\+91[ -]?)?[6-9][0-9]{9}$'
    or coalesce(p_shipping->>'pincode', '') !~ '^[1-9][0-9]{5}$'
    or coalesce(length(p_shipping->>'notes'), 0) > 500 then raise exception 'INVALID_ADDRESS'; end if;

  -- Lock in a stable order to avoid deadlocks. Prices always come from the DB.
  for line in select value from jsonb_array_elements(p_items) order by value->>'variant_id' loop
    if jsonb_typeof(line->'quantity') <> 'number' or coalesce(line->>'quantity', '') !~ '^[1-9][0-9]?$' then raise exception 'INVALID_QUANTITY'; end if;
    quantity := (line->>'quantity')::integer;
    if quantity < 1 or quantity > 10 then raise exception 'INVALID_QUANTITY'; end if;
    select * into product from public.products where id = (line->>'product_id')::uuid for share;
    if not found or product.status::text <> 'active' or product.currency::text <> 'INR' then raise exception 'UNAVAILABLE'; end if;
    select * into variant from public.product_variants where id = (line->>'variant_id')::uuid and product_id = product.id for share;
    if not found or variant.stock is null or variant.stock < quantity or variant.currency::text <> 'INR' then raise exception 'UNAVAILABLE'; end if;
    if product.has_variants then
      raw_price := variant.price;
      discount_kind := variant.discount_type::text;
      discount_amount := greatest(0, coalesce(variant.discount_value, 0));
    else
      raw_price := coalesce(product.base_price, variant.price);
      discount_kind := product.discount_type::text;
      discount_amount := greatest(0, coalesce(product.discount_value, 0));
    end if;
    if raw_price is null or raw_price < 0 or raw_price::text in ('NaN','Infinity','-Infinity') then raise exception 'UNAVAILABLE'; end if;
    unit_price := round(greatest(0, case discount_kind
      when 'percentage' then raw_price * (1 - discount_amount / 100)
      when 'amount' then raw_price - discount_amount else raw_price end), 2);
    total := total + unit_price * quantity;
    snapshot := snapshot || jsonb_build_array(jsonb_build_object(
      'product_id', product.id, 'variant_id', variant.id, 'name', product.name,
      'option', variant.title, 'quantity', quantity, 'unit_price', unit_price,
      'image_url', coalesce(variant.image_url, product.thumbnail_url)
    ));
  end loop;
  if p_expected_total is null or total <> p_expected_total then raise exception 'PRICE_CHANGED'; end if;
  if total > 1000000 then raise exception 'INVALID_TOTAL'; end if;
  insert into public.storefront_order_requests (user_id, request_key, items, item_total, shipping)
    values (customer_id, p_request_id, snapshot, total, jsonb_build_object(
      'name', btrim(p_shipping->>'name'), 'phone', p_shipping->>'phone',
      'address', btrim(p_shipping->>'address'), 'city', btrim(p_shipping->>'city'),
      'state', btrim(p_shipping->>'state'), 'pincode', p_shipping->>'pincode',
      'notes', coalesce(p_shipping->>'notes', ''), 'country', 'India'
    )) returning id into order_id;
  return jsonb_build_object('id', order_id, 'item_total', total);
end;
$$;
revoke all on function private.darciana_submit_request(uuid,jsonb,jsonb,numeric) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.darciana_submit_request(uuid,jsonb,jsonb,numeric) to authenticated;

create function public.storefront_submit_request(
  p_request_id uuid, p_items jsonb, p_shipping jsonb, p_expected_total numeric
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.darciana_submit_request(p_request_id, p_items, p_shipping, p_expected_total);
$$;
revoke all on function public.storefront_submit_request(uuid,jsonb,jsonb,numeric) from public, anon, authenticated;
grant execute on function public.storefront_submit_request(uuid,jsonb,jsonb,numeric) to authenticated;

commit;
notify pgrst, 'reload schema';

-- Read-only verification: both flags should be true, and a policy should appear.
select relrowsecurity from pg_class where oid = 'public.storefront_order_requests'::regclass;
select policyname, roles, qual from pg_policies where tablename = 'storefront_order_requests';
select has_function_privilege('authenticated', 'public.storefront_submit_request(uuid,jsonb,jsonb,numeric)', 'EXECUTE') as customers_can_submit,
  not has_function_privilege('anon', 'public.storefront_submit_request(uuid,jsonb,jsonb,numeric)', 'EXECUTE') as anonymous_cannot_submit;
