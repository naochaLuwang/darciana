-- Hosted setup. Reuses the existing private order webhook secret in Vault.
-- Future inserts and real status transitions only; no historical backfill.
begin;
create extension if not exists pg_net with schema extensions;
create schema if not exists vault;
create extension if not exists supabase_vault with schema vault;
create or replace function private.storefront_notify_order_email()
returns trigger language plpgsql security definer set search_path='' as $$
declare webhook_secret text;
begin
  if tg_op='UPDATE' and old.status is not distinct from new.status then return new; end if;
  select decrypted_secret into webhook_secret from vault.decrypted_secrets
    where name='daciana_order_push_secret' limit 1;
  if webhook_secret is null or webhook_secret !~ '^[a-f0-9]{64}$' then return new; end if;
  perform net.http_post(
    url:='https://dacianastore.in/api/email/order-update',
    headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||webhook_secret),
    body:=jsonb_build_object('order_id',new.id,'status',new.status),
    timeout_milliseconds:=10000
  );
  return new;
exception when others then
  raise warning 'Order email scheduling failed';
  return new;
end;
$$;
revoke all on function private.storefront_notify_order_email() from public,anon,authenticated;
drop trigger if exists storefront_order_email on public.storefront_order_requests;
create trigger storefront_order_email after insert or update of status on public.storefront_order_requests
  for each row execute function private.storefront_notify_order_email();
commit;
