import { readFile } from 'node:fs/promises';
export async function initializeStoreDatabase(
  db,
  customer = '11111111-1111-4111-8111-111111111111',
  owner = '22222222-2222-4222-8222-222222222222',
) {
  await db.exec(`
      create role anon; create role authenticated; create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
      insert into auth.users(id,email,email_confirmed_at) values('${customer}','customer@example.com',now()),('${owner}','luwangtech0@gmail.com',now());
      create type public.product_status as enum('active','inactive'); create type public.discount_kind as enum('none','amount','percentage');
      create table public.categories(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,parent_id uuid references public.categories,image_url text,created_at timestamptz default now());
      create table public.products(id uuid primary key default gen_random_uuid(),name text not null,slug text unique not null,description text,brand text,status public.product_status not null default 'inactive',has_variants boolean not null default false,base_price numeric,currency text default 'INR',thumbnail_url text,category_id uuid references public.categories,discount_type public.discount_kind default 'none',discount_value numeric default 0,created_at timestamptz default now(),updated_at timestamptz default now());
      create table public.product_variants(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products,sku text unique not null,title text not null,price numeric not null,currency text default 'INR',stock integer not null,is_default boolean default false,image_url text,discount_type public.discount_kind default 'none',discount_value numeric default 0,hex_code text,created_at timestamptz default now(),updated_at timestamptz default now());
      create unique index one_default_option on public.product_variants(product_id) where is_default;
      create table public.product_categories(product_id uuid references public.products,category_id uuid references public.categories,primary key(product_id,category_id));
      create table public.product_images(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products,url text not null,alt text,position integer,created_at timestamptz default now());
      create table public.variant_images(id uuid primary key default gen_random_uuid(),product_variant_id uuid not null references public.product_variants,url text not null,alt text,position integer,created_at timestamptz default now());
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon,authenticated; grant select,insert,update,delete on storage.objects to anon,authenticated;
      create policy legacy_storage_policy on storage.objects for all to anon,authenticated using(true) with check(true);
      grant select,insert,update,delete on public.products,public.categories,public.product_variants,public.product_categories to authenticated;
      create policy legacy_product_policy on public.products for all to authenticated using(true) with check(true);
    `);
  await db.exec(await readFile(new URL('../../supabase/setup.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/admin-setup.sql', import.meta.url), 'utf8'));
  await db.exec(
    await readFile(new URL('../../supabase/product-delete-setup.sql', import.meta.url), 'utf8'),
  );
  await db.exec(await readFile(new URL('../../supabase/grant-owner.sql', import.meta.url), 'utf8'));
}
