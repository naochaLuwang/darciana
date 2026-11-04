-- Run in the Supabase SQL Editor after admin-setup.sql.
-- Create/confirm this account through Supabase Auth first. No password is set here.
do $$ declare owner_id uuid; begin
  select id into owner_id from auth.users where lower(email)='luwangtech0@gmail.com' and email_confirmed_at is not null;
  if owner_id is null then raise exception 'Create and confirm the Auth account luwangtech0@gmail.com first.'; end if;
  insert into private.storefront_admins(user_id) values(owner_id) on conflict(user_id) do nothing;
end $$;
select u.email,a.created_at from private.storefront_admins a join auth.users u on u.id=a.user_id where lower(u.email)='luwangtech0@gmail.com';
