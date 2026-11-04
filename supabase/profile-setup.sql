-- Run once AFTER address-setup.sql. Preserves existing addresses and orders.
begin;
create table public.storefront_customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check(length(btrim(name)) between 2 and 100),
  phone text not null check(phone ~ '^(\+91[ -]?)?[6-9][0-9]{9}$')
);
alter table public.storefront_customer_profiles enable row level security;
revoke all on public.storefront_customer_profiles from public,anon,authenticated;
grant select,insert,update on public.storefront_customer_profiles to authenticated;
create policy "Read own profile" on public.storefront_customer_profiles for select to authenticated using ((select auth.uid())=user_id);
create policy "Create own profile" on public.storefront_customer_profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy "Update own profile" on public.storefront_customer_profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

create table public.storefront_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(btrim(name)) between 2 and 100),
  phone text not null check(phone ~ '^(\+91[ -]?)?[6-9][0-9]{9}$'),
  address text not null check(length(btrim(address)) between 8 and 300),
  city text not null check(length(btrim(city)) between 2 and 100),
  state text not null check(length(btrim(state)) between 2 and 100),
  pincode text not null check(pincode ~ '^[1-9][0-9]{5}$'),
  shipping_area_id uuid references public.storefront_shipping_areas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index storefront_delivery_addresses_user_idx on public.storefront_delivery_addresses(user_id);
create index storefront_delivery_addresses_area_idx on public.storefront_delivery_addresses(shipping_area_id);
alter table public.storefront_delivery_addresses enable row level security;
revoke all on public.storefront_delivery_addresses from public,anon,authenticated;
grant select on public.storefront_delivery_addresses to authenticated;
create policy "Read own addresses" on public.storefront_delivery_addresses for select to authenticated using ((select auth.uid())=user_id);
insert into public.storefront_delivery_addresses(user_id,name,phone,address,city,state,pincode,shipping_area_id)
  select user_id,name,phone,address,city,state,pincode,shipping_area_id from public.storefront_saved_addresses;

-- The existing checkout trigger still saves its validated address atomically.
-- Archive each different address rather than replacing previously saved ones.
create function private.storefront_archive_address() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
  if not exists(select 1 from public.storefront_delivery_addresses a where a.user_id=new.user_id and a.name=new.name and a.phone=new.phone and a.address=new.address and a.city=new.city and a.state=new.state and a.pincode=new.pincode and a.shipping_area_id is not distinct from new.shipping_area_id) then
    insert into public.storefront_delivery_addresses(user_id,name,phone,address,city,state,pincode,shipping_area_id)
      values(new.user_id,new.name,new.phone,new.address,new.city,new.state,new.pincode,new.shipping_area_id);
  end if;
  return new;
end $$;
revoke all on function private.storefront_archive_address() from public,anon,authenticated;
create trigger storefront_archive_address after insert or update on public.storefront_saved_addresses for each row execute function private.storefront_archive_address();

create function private.storefront_save_address(p_address jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare
  customer_id uuid:=auth.uid();
  address_id uuid:=nullif(p_address->>'id','')::uuid;
  saved public.storefront_delivery_addresses%rowtype;
begin
  if customer_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(customer_id::text,0));
  if address_id is not null then
    select * into saved from public.storefront_delivery_addresses where id=address_id and user_id=customer_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
  else
    select id into address_id from public.storefront_delivery_addresses where user_id=customer_id and name=btrim(p_address->>'name') and phone=btrim(p_address->>'phone') and address=btrim(p_address->>'address') and city=btrim(p_address->>'city') and state=btrim(p_address->>'state') and pincode=btrim(p_address->>'pincode') and shipping_area_id is not distinct from nullif(p_address->>'shipping_area_id','')::uuid limit 1;
  end if;
  if address_id is null then
    insert into public.storefront_delivery_addresses(user_id,name,phone,address,city,state,pincode,shipping_area_id)
    values(customer_id,btrim(p_address->>'name'),btrim(p_address->>'phone'),btrim(p_address->>'address'),btrim(p_address->>'city'),btrim(p_address->>'state'),btrim(p_address->>'pincode'),nullif(p_address->>'shipping_area_id','')::uuid) returning id into address_id;
  else
    update public.storefront_delivery_addresses set name=btrim(p_address->>'name'),phone=btrim(p_address->>'phone'),address=btrim(p_address->>'address'),city=btrim(p_address->>'city'),state=btrim(p_address->>'state'),pincode=btrim(p_address->>'pincode'),shipping_area_id=nullif(p_address->>'shipping_area_id','')::uuid where id=address_id and user_id=customer_id;
  end if;
  select * into saved from public.storefront_delivery_addresses where id=address_id and user_id=customer_id;
  insert into public.storefront_saved_addresses(user_id,name,phone,address,city,state,pincode,shipping_area_id)
    values(customer_id,saved.name,saved.phone,saved.address,saved.city,saved.state,saved.pincode,saved.shipping_area_id)
    on conflict(user_id) do update set name=excluded.name,phone=excluded.phone,address=excluded.address,city=excluded.city,state=excluded.state,pincode=excluded.pincode,shipping_area_id=excluded.shipping_area_id;
  return address_id;
end $$;
revoke all on function private.storefront_save_address(jsonb) from public,anon,authenticated;
grant execute on function private.storefront_save_address(jsonb) to authenticated;
create function public.storefront_save_address(p_address jsonb) returns uuid language sql security invoker set search_path='' as $$ select private.storefront_save_address(p_address); $$;
revoke all on function public.storefront_save_address(jsonb) from public,anon,authenticated;
grant execute on function public.storefront_save_address(jsonb) to authenticated;
commit;
notify pgrst,'reload schema';
