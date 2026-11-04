import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';
const PRODUCT = '33333333-3333-4333-8333-333333333333';
const VARIANT = '44444444-4444-4444-8444-444444444444';
const REQUEST = '55555555-5555-4555-8555-555555555555';
const shipping = {
  name: 'Test Customer',
  phone: '9876543210',
  address: '12 Example Street',
  city: 'Kolkata',
  state: 'West Bengal',
  pincode: '700001',
  notes: '',
};
const items = [{ product_id: PRODUCT, variant_id: VARIANT, quantity: 2 }];

test('database checkout enforces authentication, trusted prices, ownership and idempotency', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('${USER}'), ('${OTHER}');
      create table public.products (id uuid primary key, name text, status text, currency text, has_variants boolean, base_price numeric, discount_type text, discount_value numeric, thumbnail_url text);
      create table public.product_variants (id uuid primary key, product_id uuid references public.products, title text, price numeric, stock int, currency text, discount_type text, discount_value numeric, image_url text);
      insert into public.products values ('${PRODUCT}', 'Test Product', 'active', 'INR', false, 399, 'amount', 100, null);
      insert into public.product_variants values ('${VARIANT}', '${PRODUCT}', 'Standard', 399, 3, 'INR', 'none', 0, null);
    `);
    await db.exec(await readFile(new URL('../supabase/setup.sql', import.meta.url), 'utf8'));
    const submit = (requestId = REQUEST, cart = items, total = 598, address = shipping) =>
      db.query(
        'select public.storefront_submit_request($1::uuid,$2::jsonb,$3::jsonb,$4::numeric) as result',
        [requestId, JSON.stringify(cart), JSON.stringify(address), total],
      );
    await db.exec('set role anon');
    await assert.rejects(() => submit(), /permission denied/);
    await db.exec('set role authenticated');
    await assert.rejects(() => submit(), /AUTH_REQUIRED/);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [USER]);
    await assert.rejects(() => submit(REQUEST, items, 1), /PRICE_CHANGED/);
    await assert.rejects(
      () => submit(REQUEST, [{ ...items[0], quantity: 4 }], 1196),
      /UNAVAILABLE/,
    );
    await assert.rejects(() => submit(REQUEST, [items[0], items[0]], 1196), /INVALID_ITEMS/);
    await assert.rejects(
      () => submit(REQUEST, items, 598, { ...shipping, pincode: '000000' }),
      /INVALID_ADDRESS/,
    );
    const first = (await submit()).rows[0].result;
    assert.equal(first.item_total, 598);
    const second = (await submit()).rows[0].result;
    assert.equal(second.id, first.id);
    assert.equal((await db.query('select * from public.storefront_order_requests')).rows.length, 1);
    await assert.rejects(
      () => db.query('update public.storefront_order_requests set item_total = 1'),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query('delete from public.storefront_order_requests'),
      /permission denied/,
    );
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [OTHER]);
    assert.equal((await db.query('select * from public.storefront_order_requests')).rows.length, 0);
    await db.exec('reset role');
    assert.equal(
      (await db.query('select stock from public.product_variants')).rows[0].stock,
      3,
      'requests do not reserve stock',
    );
  } finally {
    await db.close();
  }
});
