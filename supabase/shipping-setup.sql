-- Run once AFTER setup.sql and admin-setup.sql. Existing requests are preserved.
begin;
create table public.storefront_shipping_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  price numeric(10,2) not null check (price between 0 and 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index storefront_shipping_areas_name_key on public.storefront_shipping_areas(lower(name));
alter table public.storefront_shipping_areas enable row level security;
revoke all on public.storefront_shipping_areas from public,anon,authenticated;
grant select on public.storefront_shipping_areas to anon,authenticated;
create policy "Customers see available delivery areas" on public.storefront_shipping_areas for select to anon,authenticated using (is_active);
create policy "Admins see all delivery areas" on public.storefront_shipping_areas for select to authenticated using ((select private.storefront_is_admin()));

alter table public.storefront_order_requests
  add column shipping_area_id uuid references public.storefront_shipping_areas(id) on delete set null,
  add column shipping_area_name text,
  add column shipping_price numeric(10,2),
  add column order_total numeric(12,2),
  add constraint storefront_order_shipping_snapshot check (
    (shipping_price is null and order_total is null) or
    (shipping_price is not null and order_total is not null and shipping_area_name is not null and shipping_price>=0 and order_total=item_total+shipping_price)
  );

create function private.storefront_admin_save_shipping_area(p_area jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  area_id uuid := nullif(p_area->>'id','')::uuid;
  area_name text := regexp_replace(btrim(p_area->>'name'),'\s+',' ','g');
  area_price numeric;
  previous public.storefront_shipping_areas%rowtype;
begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if coalesce(length(area_name),0) not between 2 and 160
    or jsonb_typeof(p_area->'price') is distinct from 'number'
    or jsonb_typeof(p_area->'is_active') is distinct from 'boolean' then raise exception 'INVALID_AREA'; end if;
  area_price := (p_area->>'price')::numeric;
  if area_price not between 0 and 100000 then raise exception 'INVALID_PRICE'; end if;
  area_price := round(area_price, 0);
  if area_id is null then
    insert into public.storefront_shipping_areas(name,price,is_active) values(area_name,area_price,(p_area->>'is_active')::boolean) returning id into area_id;
  else
    select * into previous from public.storefront_shipping_areas where id=area_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if previous.updated_at is distinct from (p_area->>'expected_updated_at')::timestamptz then raise exception 'CONFLICT'; end if;
    update public.storefront_shipping_areas set name=area_name,price=area_price,is_active=(p_area->>'is_active')::boolean,updated_at=clock_timestamp() where id=area_id;
  end if;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label) values(auth.uid(),'shipping_area_saved',area_id,area_name||' · INR '||area_price::text);
  return area_id;
end $$;
revoke all on function private.storefront_admin_save_shipping_area(jsonb) from public,anon,authenticated;
grant execute on function private.storefront_admin_save_shipping_area(jsonb) to authenticated;
create function public.storefront_admin_save_shipping_area(p_area jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_admin_save_shipping_area(p_area); $$;
revoke all on function public.storefront_admin_save_shipping_area(jsonb) from public,anon,authenticated;
grant execute on function public.storefront_admin_save_shipping_area(jsonb) to authenticated;

-- The existing checkout RPC is replaced below, keeping its signature. Older
-- clients cannot bypass shipping validation by calling the previous endpoint.

create or replace function private.darciana_submit_request(
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
  delivery public.storefront_shipping_areas%rowtype;
  grand_total numeric;
begin
  if customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  -- Serialize retries and rate-limit checks for this customer.
  perform pg_advisory_xact_lock(hashtextextended(customer_id::text, 0));
  select * into existing from public.storefront_order_requests
    where user_id = customer_id and request_key = p_request_id;
  if found then
    if existing.order_total is null then raise exception 'LEGACY_REQUEST'; end if;
    return jsonb_build_object('id',existing.id,'item_total',existing.item_total,'shipping_price',existing.shipping_price,'shipping_area_name',existing.shipping_area_name,'order_total',existing.order_total);
  end if;
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

  if coalesce(p_shipping->>'area_id','') = '' then raise exception 'AREA_REQUIRED'; end if;
  select * into delivery from public.storefront_shipping_areas where id=(p_shipping->>'area_id')::uuid and is_active for share;
  if not found then raise exception 'AREA_UNAVAILABLE'; end if;
  delivery.price := round(delivery.price, 0);
  if jsonb_typeof(p_shipping->'expected_price') is distinct from 'number' or delivery.price is distinct from (p_shipping->>'expected_price')::numeric then raise exception 'SHIPPING_PRICE_CHANGED'; end if;

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
      when 'amount' then raw_price - discount_amount else raw_price end), 0);
    total := total + unit_price * quantity;
    snapshot := snapshot || jsonb_build_array(jsonb_build_object(
      'product_id', product.id, 'variant_id', variant.id, 'name', product.name,
      'option', variant.title, 'quantity', quantity, 'unit_price', unit_price,
      'image_url', coalesce(variant.image_url, product.thumbnail_url)
    ));
  end loop;
  grand_total := total + delivery.price;
  if p_expected_total is null or grand_total <> p_expected_total then raise exception 'PRICE_CHANGED'; end if;
  if grand_total > 1000000 then raise exception 'INVALID_TOTAL'; end if;
  insert into public.storefront_order_requests (user_id, request_key, items, item_total, shipping_area_id, shipping_area_name, shipping_price, order_total, shipping)
    values (customer_id, p_request_id, snapshot, total, delivery.id, delivery.name, delivery.price, grand_total, jsonb_build_object(
      'name', btrim(p_shipping->>'name'), 'phone', p_shipping->>'phone',
      'address', btrim(p_shipping->>'address'), 'city', btrim(p_shipping->>'city'),
      'state', btrim(p_shipping->>'state'), 'pincode', p_shipping->>'pincode',
      'notes', coalesce(p_shipping->>'notes', ''), 'country', 'India'
    )) returning id into order_id;
  return jsonb_build_object('id',order_id,'item_total',total,'shipping_price',delivery.price,'shipping_area_name',delivery.name,'order_total',grand_total);
end;
$$;

revoke all on function private.darciana_submit_request(uuid,jsonb,jsonb,numeric) from public,anon,authenticated;
grant execute on function private.darciana_submit_request(uuid,jsonb,jsonb,numeric) to authenticated;
commit;
notify pgrst,'reload schema';

select policyname,roles from pg_policies where tablename='storefront_shipping_areas';
