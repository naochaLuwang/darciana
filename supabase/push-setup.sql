-- Android FCM registrations and sending history. Run in the Supabase SQL Editor.
-- Server-only tables: clients register through /api/push/devices, never directly.
begin;
create table if not exists public.storefront_push_devices (
  id uuid primary key,
  secret_hash text not null check (secret_hash ~ '^[0-9a-f]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (length(token) between 32 and 4096),
  announcements boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists storefront_push_devices_user_idx on public.storefront_push_devices(user_id);
create table if not exists public.storefront_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  audience text not null check (audience in ('announcements','order')),
  title text not null check (length(title) between 1 and 80),
  body text not null check (length(body) between 1 and 240),
  path text not null,
  status text not null default 'sending' check (status in ('sending','sent','partial','failed','empty')),
  success_count integer not null default 0,
  failure_count integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.storefront_push_devices enable row level security;
alter table public.storefront_push_deliveries enable row level security;
revoke all on public.storefront_push_devices, public.storefront_push_deliveries from public, anon, authenticated;
grant select, insert, update, delete on public.storefront_push_devices, public.storefront_push_deliveries to service_role;
comment on table public.storefront_push_devices is 'FCM tokens; server-only. Installation capability required to replace or remove a registration.';
comment on table public.storefront_push_deliveries is 'Admin-authorized sends; unique event_key prevents duplicate sends on retries.';
notify pgrst, 'reload schema';
commit;
