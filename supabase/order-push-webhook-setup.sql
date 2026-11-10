-- Run after admin-order-push-setup.sql in the hosted Supabase SQL Editor.
-- Store ORDER_PUSH_WEBHOOK_SECRET in Vault as daciana_order_push_secret first.
-- The same secret belongs only in the website's server environment.
begin;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;

create or replace function private.storefront_notify_new_order()
returns trigger language plpgsql security definer set search_path='' as $$
declare webhook_secret text;
begin
  select decrypted_secret into webhook_secret from vault.decrypted_secrets
    where name='daciana_order_push_secret' limit 1;
  if webhook_secret is null or webhook_secret !~ '^[a-f0-9]{64}$' then return new; end if;
  perform net.http_post(
    url:='https://dacianastore.in/api/push/new-order',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||webhook_secret),
    body:=jsonb_build_object('order_id',new.id),
    timeout_milliseconds:=5000
  );
  return new;
exception when others then
  -- Notifications must not roll back a valid order. No customer data or secret
  -- is included in the warning; pg_net response logs expose transport failures.
  raise warning 'New-order push scheduling failed';
  return new;
end;
$$;
revoke all on function private.storefront_notify_new_order() from public,anon,authenticated;
drop trigger if exists storefront_new_order_push on public.storefront_order_requests;
create trigger storefront_new_order_push after insert on public.storefront_order_requests
  for each row execute function private.storefront_notify_new_order();
commit;
