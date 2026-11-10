-- Run after setup.sql. Service-only email history; no old orders are sent.
begin;
create table if not exists public.storefront_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  order_id uuid references public.storefront_order_requests(id) on delete set null,
  order_status text not null check (order_status in ('awaiting_confirmation','confirmed','completed','cancelled')),
  status text not null default 'sending' check (status in ('sending','sent','failed','skipped')),
  provider_id text,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index if not exists storefront_email_deliveries_order_idx on public.storefront_email_deliveries(order_id);
alter table public.storefront_email_deliveries enable row level security;
revoke all on public.storefront_email_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.storefront_email_deliveries to service_role;
comment on table public.storefront_email_deliveries is 'Transactional order-email deduplication and provider acceptance history. No recipient addresses or email bodies are stored here.';
notify pgrst,'reload schema';
commit;
