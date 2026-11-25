-- Run after setup.sql and admin-setup.sql. Safe to rerun; no old orders are sent.
begin;
create table if not exists public.storefront_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  order_id uuid references public.storefront_order_requests(id) on delete set null,
  order_status text not null check (order_status in ('awaiting_confirmation','confirmed','processing','shipped','out_for_delivery','delivered','completed','cancelled')),
  status text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  provider_id text,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index if not exists storefront_email_deliveries_order_idx on public.storefront_email_deliveries(order_id);
-- Upgrade an existing installation that only allowed the original four statuses.
alter table public.storefront_email_deliveries drop constraint if exists storefront_email_deliveries_order_status_check;
alter table public.storefront_email_deliveries add constraint storefront_email_deliveries_order_status_check
  check (order_status in ('awaiting_confirmation','confirmed','processing','shipped','out_for_delivery','delivered','completed','cancelled'));
-- Existing customer keys are preserved when upgrading from customer-only emails.
alter table public.storefront_email_deliveries
  add column if not exists audience text not null default 'customer' check (audience in ('customer','admin')),
  add column if not exists recipient_id uuid references auth.users(id) on delete set null;
alter table public.storefront_email_deliveries enable row level security;
revoke all on public.storefront_email_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.storefront_email_deliveries to service_role;
comment on table public.storefront_email_deliveries is 'Transactional order-email deduplication and provider acceptance history. No recipient addresses or email bodies are stored here.';

-- Resolve current, verified admin accounts at send time. Never expose Auth emails
-- to browsers, or trust customer-editable user metadata for admin membership.
create or replace function private.storefront_order_email_admins()
returns table(user_id uuid,email text)
language sql stable security definer set search_path = '' as $$
  select u.id,u.email::text
  from private.storefront_admins a join auth.users u on u.id=a.user_id
  where u.email_confirmed_at is not null and nullif(btrim(u.email),'') is not null;
$$;
create or replace function public.storefront_order_email_admins()
returns table(user_id uuid,email text)
language sql stable security invoker set search_path = '' as $$
  select * from private.storefront_order_email_admins();
$$;
revoke all on function private.storefront_order_email_admins() from public,anon,authenticated;
revoke all on function public.storefront_order_email_admins() from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.storefront_order_email_admins() to service_role;
grant execute on function public.storefront_order_email_admins() to service_role;
notify pgrst,'reload schema';
commit;
