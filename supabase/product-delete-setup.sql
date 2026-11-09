-- Run after admin-setup.sql. Safe to rerun; this installs the operation only.
-- No catalog records are deleted by running this setup script.
begin;

create or replace function private.storefront_admin_delete_product(
  p_product_id uuid,
  p_expected_updated_at timestamptz,
  p_confirmation text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  previous public.products%rowtype;
  dependency record;
  join_condition text;
  referenced boolean;
begin
  if not private.storefront_is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_product_id is null or p_expected_updated_at is null or p_confirmation is distinct from 'DELETE'
    then raise exception 'INVALID_DELETE_CONFIRMATION'; end if;

  -- Same lock order as product/stock edits and checkout: parent before options.
  select * into previous from public.products where id = p_product_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if previous.updated_at is distinct from p_expected_updated_at then raise exception 'CONFLICT'; end if;
  perform 1 from public.product_variants where product_id = p_product_id order by id for update;

  -- The storefront stores immutable order snapshots, so removing the catalog
  -- does not remove order history. Protect records in any older integrations
  -- too, including unexpected ON DELETE CASCADE foreign keys.
  for dependency in
    select c.oid, c.conrelid, c.confrelid, c.conkey, c.confkey
    from pg_catalog.pg_constraint c
    where c.contype = 'f'
      and c.confrelid in ('public.products'::regclass, 'public.product_variants'::regclass)
      and not (c.conrelid = 'public.product_variants'::regclass and c.confrelid = 'public.products'::regclass)
      and not (c.conrelid = 'public.product_categories'::regclass and c.confrelid = 'public.products'::regclass)
      and not (c.conrelid = 'public.product_images'::regclass and c.confrelid = 'public.products'::regclass)
      and not (c.conrelid = 'public.variant_images'::regclass and c.confrelid = 'public.product_variants'::regclass)
  loop
    select string_agg(format('linked.%I = catalog.%I', child.attname, parent.attname), ' and ' order by keys.ordinality)
      into join_condition
    from unnest(dependency.conkey, dependency.confkey) with ordinality as keys(child_key, parent_key, ordinality)
    join pg_catalog.pg_attribute child on child.attrelid = dependency.conrelid and child.attnum = keys.child_key
    join pg_catalog.pg_attribute parent on parent.attrelid = dependency.confrelid and parent.attnum = keys.parent_key;
    execute format('select exists (select 1 from %s linked join %s catalog on %s where catalog.%I = $1)',
      dependency.conrelid::regclass, dependency.confrelid::regclass, join_condition,
      case when dependency.confrelid = 'public.products'::regclass then 'id' else 'product_id' end)
      into referenced using p_product_id;
    if referenced then raise exception 'PRODUCT_REFERENCED'; end if;
  end loop;

  delete from public.variant_images where product_variant_id in (select id from public.product_variants where product_id = p_product_id);
  delete from public.product_images where product_id = p_product_id;
  delete from public.product_categories where product_id = p_product_id;
  delete from public.product_variants where product_id = p_product_id;
  delete from public.products where id = p_product_id;
  insert into public.storefront_admin_activity(actor_id, action, target_id, label)
    values(auth.uid(), 'product_deleted', p_product_id, previous.name);
  return p_product_id;
end;
$$;

create or replace function public.storefront_admin_delete_product(
  p_product_id uuid, p_expected_updated_at timestamptz, p_confirmation text
) returns uuid language sql security invoker set search_path = '' as $$
  select private.storefront_admin_delete_product(p_product_id, p_expected_updated_at, p_confirmation);
$$;

revoke all on function private.storefront_admin_delete_product(uuid,timestamptz,text) from public, anon, authenticated;
revoke all on function public.storefront_admin_delete_product(uuid,timestamptz,text) from public, anon, authenticated;
grant execute on function private.storefront_admin_delete_product(uuid,timestamptz,text) to authenticated;
grant execute on function public.storefront_admin_delete_product(uuid,timestamptz,text) to authenticated;

commit;
notify pgrst, 'reload schema';

-- Read-only verification. Both values should be true.
select has_function_privilege('authenticated', 'public.storefront_admin_delete_product(uuid,timestamptz,text)', 'EXECUTE') as signed_in_can_call,
  not has_function_privilege('anon', 'public.storefront_admin_delete_product(uuid,timestamptz,text)', 'EXECUTE') as anonymous_cannot_call;
