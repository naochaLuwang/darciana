-- Run in the Supabase SQL Editor after admin-setup.sql.
-- Adds this verified account without replacing any existing administrators.
-- Safe to rerun. No account is created and no password is set here.
begin;
do $$ declare admin_id uuid; begin
  select id into admin_id from auth.users
    where lower(email)='dacianaenterprises@gmail.com' and email_confirmed_at is not null;
  if admin_id is null then
    raise exception 'Sign up and verify dacianaenterprises@gmail.com first.';
  end if;
  insert into private.storefront_admins(user_id) values(admin_id)
    on conflict(user_id) do nothing;
end $$;
select u.email,a.created_at from private.storefront_admins a
  join auth.users u on u.id=a.user_id
  where lower(u.email)='dacianaenterprises@gmail.com';
commit;
