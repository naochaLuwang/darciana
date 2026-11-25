-- Apply after admin-setup.sql and shipping-setup.sql, before deploying the order controls/dashboard.
-- Additive and safe to rerun. Existing order statuses, prices and shipping snapshots stay intact.
begin;

alter table public.storefront_order_requests
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists payment_updated_at timestamptz not null default now();
alter table public.storefront_order_requests
  drop constraint if exists storefront_order_requests_status_check,
  drop constraint if exists storefront_order_requests_payment_status_check;
alter table public.storefront_order_requests
  add constraint storefront_order_requests_status_check check (status in (
    'awaiting_confirmation','confirmed','processing','shipped','out_for_delivery','delivered','completed','cancelled'
  )),
  add constraint storefront_order_requests_payment_status_check check (payment_status in ('unpaid','paid'));

create or replace function private.storefront_admin_set_order_status(p_order_id uuid,p_status text,p_expected_status text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare previous public.storefront_order_requests%rowtype; begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into previous from public.storefront_order_requests where id=p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.status is distinct from p_expected_status then raise exception 'CONFLICT'; end if;
  if p_status is null or not (
    -- Retain the old client's transitions while the new website is being deployed.
    (previous.status='awaiting_confirmation' and p_status in ('confirmed','processing','cancelled')) or
    (previous.status='confirmed' and p_status in ('processing','completed','cancelled')) or
    (previous.status='processing' and p_status in ('shipped','cancelled')) or
    (previous.status='shipped' and p_status='out_for_delivery') or
    (previous.status='out_for_delivery' and p_status='delivered')
  ) then raise exception 'INVALID_TRANSITION'; end if;
  update public.storefront_order_requests set status=p_status where id=p_order_id;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label)
    values(auth.uid(),'request_'||p_status,p_order_id,'Request '||left(p_order_id::text,8));
  return p_order_id;
end $$;

create or replace function private.storefront_admin_set_payment_status(
  p_order_id uuid,p_status text,p_expected_status text,p_expected_updated_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.storefront_order_requests%rowtype; begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into previous from public.storefront_order_requests where id=p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.payment_status is distinct from p_expected_status
    or previous.payment_updated_at is distinct from p_expected_updated_at then raise exception 'CONFLICT'; end if;
  if p_status is null or p_status not in ('unpaid','paid') then raise exception 'INVALID_PAYMENT_STATUS'; end if;
  if p_status=previous.payment_status then raise exception 'INVALID_TRANSITION'; end if;
  update public.storefront_order_requests set payment_status=p_status,payment_updated_at=clock_timestamp() where id=p_order_id;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label)
    values(auth.uid(),'payment_'||p_status,p_order_id,'Request '||left(p_order_id::text,8));
  return p_order_id;
end $$;
create or replace function public.storefront_admin_set_payment_status(
  p_order_id uuid,p_status text,p_expected_status text,p_expected_updated_at timestamptz
) returns uuid language sql security invoker set search_path = '' as $$
  select private.storefront_admin_set_payment_status(p_order_id,p_status,p_expected_status,p_expected_updated_at);
$$;

revoke all on function private.storefront_admin_set_order_status(uuid,text,text) from public,anon,authenticated;
grant execute on function private.storefront_admin_set_order_status(uuid,text,text) to authenticated;
revoke all on function private.storefront_admin_set_payment_status(uuid,text,text,timestamptz) from public,anon,authenticated;
revoke all on function public.storefront_admin_set_payment_status(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function private.storefront_admin_set_payment_status(uuid,text,text,timestamptz) to authenticated;
grant execute on function public.storefront_admin_set_payment_status(uuid,text,text,timestamptz) to authenticated;

-- The optional existing email webhook also receives the new delivery stages.
do $$ begin
  if to_regclass('public.storefront_email_deliveries') is not null then
    alter table public.storefront_email_deliveries drop constraint if exists storefront_email_deliveries_order_status_check;
    alter table public.storefront_email_deliveries add constraint storefront_email_deliveries_order_status_check check (
      order_status in ('awaiting_confirmation','confirmed','processing','shipped','out_for_delivery','delivered','completed','cancelled')
    );
  end if;
end $$;

-- One snapshot supplies filtered rows, metrics and tab counts without a client row limit.
create or replace function private.storefront_admin_orders(
  p_from timestamptz default null, p_to timestamptz default null,
  p_q text default '', p_status text default '', p_payment text default '',
  p_mode text default '', p_sort text default 'newest', p_page integer default 1
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare response jsonb;
begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_page is null or p_page not between 1 and 10000 or length(p_q)>80
    or p_status is null or p_status not in ('','active','awaiting_confirmation','confirmed','processing','shipped','out_for_delivery','delivered','completed','cancelled')
    or p_payment is null or p_payment not in ('','paid','unpaid')
    or p_mode is null or p_mode not in ('','cash_on_delivery','manual_upi','unrecorded')
    or p_sort is null or p_sort not in ('newest','oldest','highest_total','lowest_total')
    or (p_from is not null and p_to is not null and p_from>=p_to)
    then raise exception 'INVALID_FILTERS'; end if;
  with filtered as materialized (
    select o.id,o.user_id,o.created_at,o.status,o.payment_status,o.payment_updated_at,
      o.item_total,o.order_total,o.shipping_price,o.shipping_area_name,o.shipping,o.items
    from public.storefront_order_requests o
    where (p_from is null or o.created_at>=p_from) and (p_to is null or o.created_at<p_to)
      and (p_payment='' or o.payment_status=p_payment)
      and (p_mode='' or (p_mode='unrecorded' and coalesce(o.shipping->>'payment_mode','')='') or o.shipping->>'payment_mode'=p_mode)
      and (coalesce(btrim(p_q),'')='' or
        position(lower(btrim(p_q)) in lower(coalesce(o.shipping->>'name','')))>0 or
        position(btrim(p_q) in coalesce(o.shipping->>'phone',''))>0 or
        (replace(lower(ltrim(btrim(p_q),'#')),'-','')<>'' and
         position(replace(lower(ltrim(btrim(p_q),'#')),'-','') in replace(o.id::text,'-',''))=1))
  ), metrics as (
    select count(*) as total,
      count(*) filter (where status='awaiting_confirmation') as pending,
      coalesce(sum(coalesce(order_total,item_total)) filter (where status<>'cancelled'),0) as order_value,
      coalesce(sum(coalesce(order_total,item_total)) filter (where status<>'cancelled' and payment_status='unpaid'),0) as unpaid_value
    from filtered
  ), status_counts as (
    select coalesce(jsonb_object_agg(status,n),'{}'::jsonb) as counts
    from (select status,count(*) as n from filtered group by status) s
  ), matching as (
    select * from filtered where p_status='' or status=p_status
      or (p_status='active' and status not in ('awaiting_confirmation','cancelled'))
  ), totals as (
    select count(*) as count from matching
  ), pagination as (
    select greatest(1,least(p_page,ceil(t.count/25.0)::integer)) as page from totals t
  ), page_rows as (
    select * from matching
    order by
      case when p_sort='oldest' then created_at end asc,
      case when p_sort='highest_total' then coalesce(order_total,item_total) end desc,
      case when p_sort='lowest_total' then coalesce(order_total,item_total) end asc,
      created_at desc,id
    limit 25 offset (select (page-1)*25 from pagination)
  )
  select jsonb_build_object(
    'orders',coalesce((select jsonb_agg(row_to_json(r)) from page_rows r),'[]'::jsonb),
    'count',t.count,'page',pg.page,'summary',to_jsonb(m),'counts',sc.counts
  ) into response from totals t cross join pagination pg cross join metrics m cross join status_counts sc;
  return response;
end $$;
create or replace function public.storefront_admin_orders(
  p_from timestamptz default null, p_to timestamptz default null,
  p_q text default '', p_status text default '', p_payment text default '',
  p_mode text default '', p_sort text default 'newest', p_page integer default 1
) returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.storefront_admin_orders(p_from,p_to,p_q,p_status,p_payment,p_mode,p_sort,p_page);
$$;
revoke all on function private.storefront_admin_orders(timestamptz,timestamptz,text,text,text,text,text,integer) from public,anon,authenticated;
revoke all on function public.storefront_admin_orders(timestamptz,timestamptz,text,text,text,text,text,integer) from public,anon,authenticated;
grant execute on function private.storefront_admin_orders(timestamptz,timestamptz,text,text,text,text,text,integer) to authenticated;
grant execute on function public.storefront_admin_orders(timestamptz,timestamptz,text,text,text,text,text,integer) to authenticated;

comment on column public.storefront_order_requests.payment_status is 'Manually recorded by verified store admins. Delivery does not automatically mark an order paid.';
notify pgrst,'reload schema';
commit;
