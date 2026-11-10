-- Run after admin-setup.sql and the updated push-setup.sql. Safe to rerun.
-- Only new inserts notify; existing orders are never broadcast by this script.
begin;

create or replace function private.storefront_admin_push_devices(p_after uuid default null, p_limit integer default 500)
returns table(id uuid, token text) language sql stable security definer set search_path = '' as $$
  select d.id,d.token from public.storefront_push_devices d
  join private.storefront_admins a on a.user_id=d.user_id
  where p_after is null or d.id>p_after
  order by d.id limit greatest(1,least(coalesce(p_limit,500),500));
$$;
revoke all on function private.storefront_admin_push_devices(uuid,integer) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.storefront_admin_push_devices(uuid,integer) to service_role;
create or replace function public.storefront_admin_push_devices(p_after uuid default null,p_limit integer default 500)
returns table(id uuid,token text) language sql stable security invoker set search_path='' as $$
  select * from private.storefront_admin_push_devices(p_after,p_limit);
$$;
revoke all on function public.storefront_admin_push_devices(uuid,integer) from public,anon,authenticated;
grant execute on function public.storefront_admin_push_devices(uuid,integer) to service_role;

-- Transport setup is separate so the recipient access rules can be installed
-- and tested independently of hosted-only pg_net/Vault extensions.
notify pgrst,'reload schema';
commit;
