-- Run AFTER supabase/setup.sql. Review before applying to the existing project.
-- No service key is used. Only SQL-editor-enrolled users may administer the store.
begin;
create schema if not exists private;
create table private.storefront_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.storefront_admins enable row level security;
revoke all on private.storefront_admins from public, anon, authenticated;

create function private.storefront_is_admin() returns boolean language sql stable
security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from private.storefront_admins where user_id = auth.uid());
$$;
revoke all on function private.storefront_is_admin() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.storefront_is_admin() to anon, authenticated;
create function public.storefront_is_admin() returns boolean language sql stable
security invoker set search_path = '' as $$ select private.storefront_is_admin(); $$;
revoke all on function public.storefront_is_admin() from public, anon;
grant execute on function public.storefront_is_admin() to authenticated;

create table public.storefront_admin_activity (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null,
  action text not null, target_id uuid, label text not null, created_at timestamptz not null default now()
);
create index storefront_admin_activity_created_idx on public.storefront_admin_activity(created_at desc);
alter table public.storefront_admin_activity enable row level security;
revoke all on public.storefront_admin_activity from anon, authenticated;
grant select on public.storefront_admin_activity to authenticated;
create policy "Store admins read activity" on public.storefront_admin_activity for select to authenticated using ((select private.storefront_is_admin()));

-- Preserve storefront reads and add admin reads, including inactive products.
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.categories enable row level security;
alter table public.product_categories enable row level security;
grant select on public.products, public.product_variants, public.categories, public.product_categories to anon, authenticated;
create policy "Darciana public products" on public.products for select to anon, authenticated using (status::text = 'active');
create policy "Darciana public variants" on public.product_variants for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and p.status::text = 'active'));
create policy "Darciana public categories" on public.categories for select to anon, authenticated using (true);
create policy "Darciana public category links" on public.product_categories for select to anon, authenticated using (true);
create policy "Darciana admin products" on public.products for select to authenticated using ((select private.storefront_is_admin()));
create policy "Darciana admin variants" on public.product_variants for select to authenticated using ((select private.storefront_is_admin()));
create policy "Darciana admin orders" on public.storefront_order_requests for select to authenticated using ((select private.storefront_is_admin()));

-- Restrictive write guards prevent older permissive policies from letting
-- customer accounts modify the catalog. They do not grant new direct writes.
do $$ declare table_name text; begin
  foreach table_name in array array['products','product_variants','categories','product_categories'] loop
    execute format('create policy "Darciana insert guard" on public.%I as restrictive for insert to anon, authenticated with check ((select private.storefront_is_admin()))', table_name);
    execute format('create policy "Darciana update guard" on public.%I as restrictive for update to anon, authenticated using ((select private.storefront_is_admin())) with check ((select private.storefront_is_admin()))', table_name);
    execute format('create policy "Darciana delete guard" on public.%I as restrictive for delete to anon, authenticated using ((select private.storefront_is_admin()))', table_name);
  end loop;
end $$;

create function private.storefront_admin_save_product(p_product jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  saved_product_id uuid := nullif(p_product->>'id','')::uuid;
  previous public.products%rowtype;
  candidate public.products%rowtype;
  option_row public.product_variants%rowtype;
  option_json jsonb;
  option_id uuid;
  category_ids uuid[];
  variants jsonb := p_product->'variants';
  is_new boolean := saved_product_id is null;
begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if jsonb_typeof(p_product) <> 'object' or coalesce(length(btrim(p_product->>'name')),0) not between 2 and 500
    or coalesce(p_product->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_product->>'slug') > 600
    or coalesce(length(p_product->>'description'),0) > 20000 or coalesce(length(p_product->>'brand'),0) > 100
    or coalesce(p_product->>'status','') not in ('active','inactive')
    or jsonb_typeof(p_product->'has_variants') is distinct from 'boolean'
    or (coalesce(p_product->>'thumbnail_url','') <> '' and (p_product->>'thumbnail_url' !~ '^https://' or length(p_product->>'thumbnail_url') > 2048))
    then raise exception 'INVALID_PRODUCT'; end if;
  if jsonb_typeof(variants) is distinct from 'array' then raise exception 'INVALID_VARIANTS'; end if;
  if jsonb_array_length(variants) not between 1 and 100 then raise exception 'INVALID_VARIANTS'; end if;
  if (select count(*) from jsonb_array_elements(variants) where value->>'is_default' = 'true') <> 1
    or (select count(distinct value->>'sku') from jsonb_array_elements(variants)) <> jsonb_array_length(variants)
    or (select count(value->>'id') from jsonb_array_elements(variants)) <> (select count(distinct value->>'id') from jsonb_array_elements(variants))
    then raise exception 'INVALID_VARIANTS'; end if;
  if jsonb_typeof(p_product->'category_ids') is distinct from 'array' or jsonb_array_length(p_product->'category_ids') > 50 then raise exception 'INVALID_CATEGORIES'; end if;
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into category_ids from jsonb_array_elements_text(p_product->'category_ids');
  if (select count(*) from public.categories where id = any(category_ids)) <> cardinality(category_ids) then raise exception 'INVALID_CATEGORIES'; end if;
  if is_new then saved_product_id := gen_random_uuid(); else
    select * into previous from public.products where id = saved_product_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if previous.updated_at is distinct from (p_product->>'expected_updated_at')::timestamptz then raise exception 'CONFLICT'; end if;
    if exists (select 1 from public.product_variants v where v.product_id = saved_product_id and not exists (select 1 from jsonb_array_elements(variants) x where nullif(x->>'id','')::uuid = v.id)) then raise exception 'EXISTING_VARIANTS_REQUIRED'; end if;
  end if;
  candidate := jsonb_populate_record(null::public.products, p_product || jsonb_build_object('id',saved_product_id,'currency','INR','category_id',category_ids[1]));
  if not candidate.has_variants then
    if jsonb_array_length(variants) <> 1 or candidate.base_price is null or candidate.base_price not between 0 and 1000000 or round(candidate.base_price,2) <> candidate.base_price then raise exception 'INVALID_PRICE'; end if;
  else candidate.base_price := null; candidate.discount_type := 'none'; candidate.discount_value := 0; end if;
  if coalesce(candidate.discount_type::text,'') not in ('none','amount','percentage') or candidate.discount_value is null or candidate.discount_value not between 0 and 1000000
    or (candidate.discount_type::text = 'percentage' and candidate.discount_value > 100)
    or (candidate.discount_type::text = 'amount' and candidate.discount_value > candidate.base_price) then raise exception 'INVALID_DISCOUNT'; end if;
  if is_new then
    insert into public.products(id,name,slug,description,brand,status,has_variants,base_price,currency,thumbnail_url,category_id,discount_type,discount_value)
      values(saved_product_id,btrim(candidate.name),candidate.slug,coalesce(candidate.description,''),coalesce(candidate.brand,''),candidate.status,candidate.has_variants,candidate.base_price,'INR',nullif(candidate.thumbnail_url,''),category_ids[1],candidate.discount_type,candidate.discount_value);
  else
    update public.products p set name=btrim(candidate.name),slug=candidate.slug,description=coalesce(candidate.description,''),brand=coalesce(candidate.brand,''),status=candidate.status,has_variants=candidate.has_variants,base_price=candidate.base_price,thumbnail_url=nullif(candidate.thumbnail_url,''),category_id=category_ids[1],discount_type=candidate.discount_type,discount_value=candidate.discount_value,updated_at=clock_timestamp() where p.id=saved_product_id;
  end if;
  update public.product_variants v set is_default=false where v.product_id=saved_product_id;
  for option_json in select value from jsonb_array_elements(variants) loop
    option_row := jsonb_populate_record(null::public.product_variants,option_json || jsonb_build_object('currency','INR'));
    if coalesce(length(btrim(option_row.title)),0) not between 1 and 200 or coalesce(length(btrim(option_row.sku)),0) not between 1 and 1000
      or option_row.price is null or option_row.price not between 0 and 1000000 or round(option_row.price,2) <> option_row.price
      or jsonb_typeof(option_json->'stock') is distinct from 'number' or coalesce(option_json->>'stock','') !~ '^[0-9]+$' or option_row.stock not between 0 and 1000000
      or jsonb_typeof(option_json->'is_default') is distinct from 'boolean'
      or (coalesce(option_row.image_url,'') <> '' and (option_row.image_url !~ '^https://' or length(option_row.image_url) > 2048))
      or (coalesce(option_row.hex_code,'') <> '' and option_row.hex_code !~ '^#[0-9a-fA-F]{6}$') then raise exception 'INVALID_VARIANT'; end if;
    if coalesce(option_row.discount_type::text,'') not in ('none','amount','percentage') or option_row.discount_value is null or option_row.discount_value not between 0 and 1000000
      or (option_row.discount_type::text = 'percentage' and option_row.discount_value > 100)
      or (option_row.discount_type::text = 'amount' and option_row.discount_value > option_row.price) then raise exception 'INVALID_DISCOUNT'; end if;
    if not candidate.has_variants then option_row.price := candidate.base_price; option_row.discount_type := candidate.discount_type; option_row.discount_value := candidate.discount_value; end if;
    option_id := option_row.id;
    if option_id is null then
      insert into public.product_variants(product_id,sku,title,price,currency,stock,is_default,image_url,discount_type,discount_value,hex_code)
      values(saved_product_id,btrim(option_row.sku),btrim(option_row.title),option_row.price,'INR',option_row.stock,option_row.is_default,nullif(option_row.image_url,''),option_row.discount_type,option_row.discount_value,nullif(option_row.hex_code,''));
    else
      update public.product_variants v set sku=btrim(option_row.sku),title=btrim(option_row.title),price=option_row.price,stock=option_row.stock,is_default=option_row.is_default,image_url=nullif(option_row.image_url,''),discount_type=option_row.discount_type,discount_value=option_row.discount_value,hex_code=nullif(option_row.hex_code,''),updated_at=clock_timestamp() where v.id=option_id and v.product_id=saved_product_id;
      if not found then raise exception 'INVALID_VARIANT'; end if;
    end if;
  end loop;
  delete from public.product_categories pc where pc.product_id=saved_product_id;
  insert into public.product_categories(product_id,category_id) select saved_product_id,unnest(category_ids);
  insert into public.storefront_admin_activity(actor_id,action,target_id,label) values(auth.uid(),case when is_new then 'product_created' else 'product_updated' end,saved_product_id,candidate.name);
  return saved_product_id;
end $$;

create function private.storefront_admin_save_category(p_category jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare category_id uuid := nullif(p_category->>'id','')::uuid; parent uuid := nullif(p_category->>'parent_id','')::uuid; begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  perform pg_advisory_xact_lock(84174019);
  if coalesce(length(btrim(p_category->>'name')),0) not between 2 and 120 or coalesce(p_category->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(p_category->>'slug') > 160
    or (coalesce(p_category->>'image_url','') <> '' and (p_category->>'image_url' !~ '^https://' or length(p_category->>'image_url') > 2048)) then raise exception 'INVALID_CATEGORY'; end if;
  if parent is not null and (parent = category_id or exists (
    with recursive ancestors as (select id,parent_id,array[id] as visited from public.categories where id=parent
      union all select c.id,c.parent_id,a.visited||c.id from public.categories c join ancestors a on c.id=a.parent_id where not c.id=any(a.visited))
    select 1 from ancestors where id=category_id)) then raise exception 'CATEGORY_CYCLE'; end if;
  if category_id is null then
    insert into public.categories(name,slug,parent_id,image_url) values(btrim(p_category->>'name'),p_category->>'slug',parent,coalesce(p_category->>'image_url','')) returning id into category_id;
  else
    update public.categories c set name=btrim(p_category->>'name'),slug=p_category->>'slug',parent_id=parent,image_url=coalesce(p_category->>'image_url','') where c.id=category_id;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label) values(auth.uid(),'category_saved',category_id,p_category->>'name');
  return category_id;
end $$;

create function private.storefront_admin_set_stock(p_variant_id uuid,p_stock integer,p_expected_updated_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare parent uuid; previous public.product_variants%rowtype; begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_stock is null or p_stock not between 0 and 1000000 then raise exception 'INVALID_STOCK'; end if;
  select product_id into parent from public.product_variants where id=p_variant_id;
  perform 1 from public.products where id=parent for update;
  select * into previous from public.product_variants where id=p_variant_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'CONFLICT'; end if;
  update public.product_variants set stock=p_stock,updated_at=clock_timestamp() where id=p_variant_id;
  update public.products set updated_at=clock_timestamp() where id=parent;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label) values(auth.uid(),'stock_updated',p_variant_id,previous.sku||' → '||p_stock::text);
  return p_variant_id;
end $$;

create function private.storefront_admin_set_product_status(p_product_id uuid,p_status text,p_expected_updated_at timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare previous public.products%rowtype; candidate public.products%rowtype; begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status is null or p_status not in ('active','inactive') then raise exception 'INVALID_STATUS'; end if;
  select * into previous from public.products where id=p_product_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'CONFLICT'; end if;
  candidate := jsonb_populate_record(null::public.products,jsonb_build_object('status',p_status));
  update public.products set status=candidate.status,updated_at=clock_timestamp() where id=p_product_id;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label) values(auth.uid(),'product_'||p_status,p_product_id,previous.name);
  return p_product_id;
end $$;

create function private.storefront_admin_set_order_status(p_order_id uuid,p_status text,p_expected_status text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare previous public.storefront_order_requests%rowtype; begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  select * into previous from public.storefront_order_requests where id=p_order_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.status is distinct from p_expected_status then raise exception 'CONFLICT'; end if;
  if p_status is null or not ((previous.status='awaiting_confirmation' and p_status in ('confirmed','cancelled')) or (previous.status='confirmed' and p_status in ('completed','cancelled'))) then raise exception 'INVALID_TRANSITION'; end if;
  update public.storefront_order_requests set status=p_status where id=p_order_id;
  insert into public.storefront_admin_activity(actor_id,action,target_id,label) values(auth.uid(),'request_'||p_status,p_order_id,'Request '||left(p_order_id::text,8));
  return p_order_id;
end $$;

create function private.storefront_admin_overview() returns jsonb language plpgsql stable security definer set search_path = '' as $$ begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object('active_products',(select count(*) from public.products where status::text='active'),'low_stock',(select count(*) from public.product_variants v join public.products p on p.id=v.product_id where p.status::text='active' and v.stock<=5),'pending_requests',(select count(*) from public.storefront_order_requests where status='awaiting_confirmation'),'requested_value',(select coalesce(sum(item_total),0) from public.storefront_order_requests where status<>'cancelled' and created_at>=now()-interval '30 days'));
end $$;

-- Exposed RPCs never run as the database owner. Each private implementation
-- rechecks membership, including if access was revoked after a page was loaded.
create function public.storefront_admin_save_product(p_product jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_admin_save_product(p_product); $$;
create function public.storefront_admin_save_category(p_category jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_admin_save_category(p_category); $$;
create function public.storefront_admin_set_stock(p_variant_id uuid,p_stock integer,p_expected_updated_at timestamptz) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_admin_set_stock(p_variant_id,p_stock,p_expected_updated_at); $$;
create function public.storefront_admin_set_product_status(p_product_id uuid,p_status text,p_expected_updated_at timestamptz) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_admin_set_product_status(p_product_id,p_status,p_expected_updated_at); $$;
create function public.storefront_admin_set_order_status(p_order_id uuid,p_status text,p_expected_status text) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_admin_set_order_status(p_order_id,p_status,p_expected_status); $$;
create function public.storefront_admin_overview() returns jsonb language sql stable security invoker set search_path='' as $$ select private.storefront_admin_overview(); $$;
do $$ declare signature regprocedure; begin
  for signature in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.proname in ('storefront_admin_save_product','storefront_admin_save_category','storefront_admin_set_stock','storefront_admin_set_product_status','storefront_admin_set_order_status','storefront_admin_overview') loop
    execute format('revoke all on function %s from public, anon, authenticated',signature);
    execute format('grant execute on function %s to authenticated',signature);
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('storefront-media','storefront-media',true,5242880,array['image/jpeg','image/png','image/webp','image/avif']);
create policy "Darciana admin upload" on storage.objects for insert to authenticated with check (bucket_id='storefront-media' and (select private.storefront_is_admin()));
create policy "Darciana admin media list" on storage.objects for select to authenticated using (bucket_id='storefront-media' and (select private.storefront_is_admin()));
create policy "Darciana media insert guard" on storage.objects as restrictive for insert to anon, authenticated with check (bucket_id<>'storefront-media' or (select private.storefront_is_admin()));
create policy "Darciana media update guard" on storage.objects as restrictive for update to anon, authenticated using (bucket_id<>'storefront-media' or (select private.storefront_is_admin())) with check (bucket_id<>'storefront-media' or (select private.storefront_is_admin()));
create policy "Darciana media delete guard" on storage.objects as restrictive for delete to anon, authenticated using (bucket_id<>'storefront-media' or (select private.storefront_is_admin()));
commit;
notify pgrst,'reload schema';

-- Review the resulting policies and run the Supabase database security advisors.
select schemaname,tablename,policyname,roles from pg_policies where policyname like 'Darciana%' or policyname='Store admins read activity';
