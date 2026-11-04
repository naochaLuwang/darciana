import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { addressSchema } from '../src/lib/checkout.ts';

const address = {
  name: 'Test Customer',
  phone: '9876543210',
  address: '12 Example Street',
  city: 'Imphal',
  state: 'Manipur',
  pincode: '795001',
  shipping_area_id: null,
};

test('saved addresses validate contact details and allow an area to be selected later', () => {
  assert.equal(addressSchema.parse({ ...address, name: '  Test Customer  ' }).name, address.name);
  for (const change of [
    { phone: '12345' },
    { address: 'short' },
    { pincode: '000000' },
    { shipping_area_id: 'typed area' },
  ])
    assert.equal(addressSchema.safeParse({ ...address, ...change }).success, false);
  assert.equal(
    addressSchema.parse({ ...address, user_id: 'forged', notes: 'private note' }).user_id,
    undefined,
  );
  assert.equal(addressSchema.parse({ ...address, notes: 'one order only' }).notes, undefined);
});

test('saved address SQL isolates accounts and saves checkout atomically without changing history or newer profiles on retry', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  const area = 'aaaaaaaa-1111-4111-8111-111111111111';
  const product = '33333333-3333-4333-8333-333333333333';
  const variant = '44444444-4444-4444-8444-444444444444';
  const request = '66666666-6666-4666-8666-666666666666';
  try {
    await initializeStoreDatabase(db, customer, owner);
    for (const file of ['shipping-setup.sql', 'address-setup.sql', 'checkout-setup.sql'])
      await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), 'utf8'));
    await db.query('insert into public.storefront_shipping_areas(id,name,price) values($1,$2,50)', [
      area,
      'Central Market',
    ]);
    await db.query(
      "insert into public.products(id,name,slug,status,has_variants,base_price,currency) values($1,'Balm','balm','active',false,299,'INR')",
      [product],
    );
    await db.query(
      "insert into public.product_variants(id,product_id,sku,title,price,stock,currency,is_default) values($1,$2,'BALM','Standard',299,10,'INR',true)",
      [variant, product],
    );
    const login = async (id, role = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec(`set role ${role}`);
    };
    const save = (id, name = address.name) =>
      db.query(
        'insert into public.storefront_saved_addresses(user_id,name,phone,address,city,state,pincode,shipping_area_id) values($1,$2,$3,$4,$5,$6,$7,$8) on conflict(user_id) do update set name=excluded.name',
        [
          id,
          name,
          address.phone,
          address.address,
          address.city,
          address.state,
          address.pincode,
          area,
        ],
      );
    await login('', 'anon');
    await assert.rejects(
      () =>
        db.query("select public.storefront_submit_order(null,'[]','{}',0,'cash_on_delivery',true)"),
      /permission denied/,
    );
    await assert.rejects(
      () => db.query('select * from public.storefront_saved_addresses'),
      /permission denied/,
    );
    await login('', 'authenticated');
    await assert.rejects(
      () =>
        db.query("select public.storefront_submit_order(null,'[]','{}',0,'cash_on_delivery',true)"),
      /AUTH_REQUIRED/,
    );
    await login(customer);
    await assert.rejects(() => save(owner), /row-level security/);
    await save(customer);
    await save(customer, 'Updated Customer');
    assert.equal(
      (await db.query('select name from public.storefront_saved_addresses')).rows[0].name,
      'Updated Customer',
    );
    await assert.rejects(
      () => db.query('update public.storefront_saved_addresses set user_id=$1', [owner]),
      /row-level security/,
    );
    await assert.rejects(
      () => db.query("update public.storefront_saved_addresses set phone='123'"),
      /check constraint/,
    );
    await assert.rejects(
      () => db.query('select private.storefront_save_order_address()'),
      /permission denied/,
    );
    await login(owner);
    assert.equal(
      (await db.query('select * from public.storefront_saved_addresses')).rows.length,
      0,
      'admin membership grants no access to private saved addresses',
    );
    await save(owner, 'Owner Address');
    assert.equal(
      (
        await db.query(
          'update public.storefront_saved_addresses set name=$1 where user_id=$2 returning *',
          ['Forbidden', customer],
        )
      ).rows.length,
      0,
    );
    await login(customer);
    const submit = (
      shipping,
      total = 349,
      paymentMode = 'cash_on_delivery',
      termsAccepted = true,
      requestKey = request,
    ) =>
      db.query('select public.storefront_submit_order($1,$2,$3,$4,$5,$6) as result', [
        requestKey,
        JSON.stringify([{ product_id: product, variant_id: variant, quantity: 1 }]),
        JSON.stringify({
          ...shipping,
          area_id: area,
          expected_price: 50,
          notes: 'This order only',
        }),
        total,
        paymentMode,
        termsAccepted,
      ]);
    await assert.rejects(() => submit(address, 349, 'card'), /INVALID_PAYMENT_MODE/);
    await assert.rejects(() => submit(address, 349, null), /INVALID_PAYMENT_MODE/);
    await assert.rejects(() => submit(address, 349, 'cash_on_delivery', false), /TERMS_REQUIRED/);
    await assert.rejects(() => submit(address, 349, 'cash_on_delivery', null), /TERMS_REQUIRED/);
    await assert.rejects(() => submit(address, 1), /PRICE_CHANGED/);
    assert.equal(
      (await db.query('select name from public.storefront_saved_addresses')).rows[0].name,
      'Updated Customer',
      'failed checkout never overwrites profile',
    );
    const result = (await submit(address)).rows[0].result;
    assert.equal(result.payment_mode, 'cash_on_delivery');
    const beforeRetry = (
      await db.query('select shipping from public.storefront_order_requests where id=$1', [
        result.id,
      ])
    ).rows[0].shipping;
    assert.equal(beforeRetry.payment_mode, 'cash_on_delivery');
    assert.equal(beforeRetry.terms_version, '2026-11-cod-v1');
    assert.ok(beforeRetry.terms_accepted_at);
    const saved = (await db.query('select * from public.storefront_saved_addresses')).rows[0];
    assert.equal(saved.name, address.name);
    assert.equal(saved.phone, address.phone);
    assert.equal(saved.shipping_area_id, area);
    assert.equal(saved.notes, undefined);
    await save(customer, 'Newer Profile');
    await submit(address);
    assert.equal(
      (await db.query('select name from public.storefront_saved_addresses')).rows[0].name,
      'Newer Profile',
      'idempotent retry must not undo profile edits',
    );
    const order = (
      await db.query('select shipping from public.storefront_order_requests where id=$1', [
        result.id,
      ])
    ).rows[0];
    assert.equal(order.shipping.name, address.name, 'profile edits never rewrite an order');
    assert.equal(
      order.shipping.terms_accepted_at,
      beforeRetry.terms_accepted_at,
      'retries preserve the original terms acceptance',
    );
    const legacyKey = '77777777-7777-4777-8777-777777777777';
    await db.query('select public.storefront_submit_request($1,$2,$3,349)', [
      legacyKey,
      JSON.stringify([{ product_id: product, variant_id: variant, quantity: 1 }]),
      JSON.stringify({ ...address, area_id: area, expected_price: 50 }),
    ]);
    await assert.rejects(
      () => submit(address, 349, 'cash_on_delivery', true, legacyKey),
      /LEGACY_REQUEST/,
    );
    assert.equal(
      (
        await db.query(
          'select shipping from public.storefront_order_requests where request_key=$1',
          [legacyKey],
        )
      ).rows[0].shipping.payment_mode,
      undefined,
      'old orders must not be relabelled as COD',
    );
    await db.exec('reset role');
    const upgrade = await readFile(
      new URL('../supabase/manual-upi-setup.sql', import.meta.url),
      'utf8',
    );
    await db.exec(upgrade);
    await db.exec(upgrade);
    await login(customer);
    assert.equal((await submit(address)).rows[0].result.payment_mode, 'cash_on_delivery');
    const olderCod = (
      await db.query('select shipping from public.storefront_order_requests where id=$1', [
        result.id,
      ])
    ).rows[0].shipping;
    assert.equal(olderCod.terms_version, '2026-11-cod-v1', 'upgrading preserves earlier COD terms');
    assert.equal(olderCod.terms_accepted_at, beforeRetry.terms_accepted_at);
    const upiKey = '88888888-8888-4888-8888-888888888888';
    const upi = (
      await submit(
        { ...address, payment_mode: 'cash_on_delivery' },
        349,
        'manual_upi',
        true,
        upiKey,
      )
    ).rows[0].result;
    assert.equal(upi.payment_mode, 'manual_upi');
    const upiOrder = (
      await db.query('select shipping,status from public.storefront_order_requests where id=$1', [
        upi.id,
      ])
    ).rows[0];
    assert.equal(upiOrder.shipping.payment_mode, 'manual_upi');
    assert.equal(upiOrder.shipping.terms_version, '2026-11-payment-v2');
    assert.equal(upiOrder.status, 'awaiting_confirmation', 'manual UPI is not treated as paid');
    await save(customer, 'Newest Profile');
    const retriedUpi = (await submit(address, 349, 'cash_on_delivery', true, upiKey)).rows[0]
      .result;
    assert.equal(
      retriedUpi.payment_mode,
      'manual_upi',
      'retry returns the original mode even if the caller changes it',
    );
    assert.equal(
      (
        await db.query('select shipping from public.storefront_order_requests where id=$1', [
          upi.id,
        ])
      ).rows[0].shipping.terms_accepted_at,
      upiOrder.shipping.terms_accepted_at,
    );
    assert.equal(
      (await db.query('select name from public.storefront_saved_addresses')).rows[0].name,
      'Newest Profile',
    );
    await assert.rejects(() => submit(address, 349, 'upi'), /INVALID_PAYMENT_MODE/);
    await login(owner);
    assert.equal(
      (await db.query('select name from public.storefront_saved_addresses')).rows[0].name,
      'Owner Address',
      'checkout never overwrites a different account',
    );
  } finally {
    await db.close();
  }
});
