-- Run once AFTER setup.sql, admin-setup.sql, and shipping-setup.sql.
-- One private delivery address per account. Existing orders are unchanged.
begin;
create table public.storefront_saved_addresses (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 100),
  phone text not null check (phone ~ '^(\+91[ -]?)?[6-9][0-9]{9}$'),
  address text not null check (length(btrim(address)) between 8 and 300),
  city text not null check (length(btrim(city)) between 2 and 100),
  state text not null check (length(btrim(state)) between 2 and 100),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  shipping_area_id uuid references public.storefront_shipping_areas(id) on delete set null
);
create index storefront_saved_addresses_area_idx on public.storefront_saved_addresses(shipping_area_id);
alter table public.storefront_saved_addresses enable row level security;
revoke all on public.storefront_saved_addresses from public,anon,authenticated;
grant select,insert,update on public.storefront_saved_addresses to authenticated;
create policy "Read own saved address" on public.storefront_saved_addresses for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Insert own saved address" on public.storefront_saved_addresses for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Update own saved address" on public.storefront_saved_addresses for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Checkout writes orders through a private, validated definer function. This
-- trigger saves the delivery details in the SAME transaction, including RPC
-- callers. Idempotent order retries don't insert again or overwrite a newer
-- profile. There is no public function that can write another user's address.
create function private.storefront_save_order_address() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or auth.uid() is distinct from new.user_id then
    raise exception 'AUTH_REQUIRED';
  end if;
  insert into public.storefront_saved_addresses(user_id,name,phone,address,city,state,pincode,shipping_area_id)
  values(new.user_id,new.shipping->>'name',new.shipping->>'phone',new.shipping->>'address',new.shipping->>'city',new.shipping->>'state',new.shipping->>'pincode',new.shipping_area_id)
  on conflict(user_id) do update set
    name=excluded.name, phone=excluded.phone, address=excluded.address,
    city=excluded.city, state=excluded.state, pincode=excluded.pincode,
    shipping_area_id=excluded.shipping_area_id;
  return new;
end $$;
revoke all on function private.storefront_save_order_address() from public,anon,authenticated;
create trigger storefront_save_order_address after insert on public.storefront_order_requests
  for each row execute function private.storefront_save_order_address();
commit;
notify pgrst,'reload schema';

select policyname,roles from pg_policies where tablename='storefront_saved_addresses';
