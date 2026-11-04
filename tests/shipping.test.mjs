import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { shippingAreaSchema } from '../src/lib/admin-validation.ts';
import { checkoutSchema } from '../src/lib/checkout.ts';
import { totalWithShipping } from '../src/lib/shipping.ts';

test('shipping validation requires an actual area selection and valid INR charges', () => {
  const area = {
    id: null,
    expected_updated_at: null,
    name: '  Central   Market  ',
    price: 50,
    is_active: true,
  };
  assert.equal(shippingAreaSchema.parse(area).name, 'Central Market');
  for (const price of [-1, 10.123, Infinity, 100001])
    assert.equal(shippingAreaSchema.safeParse({ ...area, price }).success, false);
  assert.equal(shippingAreaSchema.safeParse({ ...area, price: 0 }).success, true);
  assert.equal(totalWithShipping(19.99, 40.1), 60.09);
  assert.equal(
    checkoutSchema.safeParse({ shippingAreaId: 'typed-area-name', expectedShippingPrice: 0 })
      .success,
    false,
  );
});

test('shipping SQL protects prices, active areas, snapshots, legacy requests and idempotent retries', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  try {
    await initializeStoreDatabase(db, customer, owner);
    const legacy = (
      await db.query(
        "insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping) values($1,gen_random_uuid(),'[]',299,'{}') returning id",
        [customer],
      )
    ).rows[0].id;
    await db.exec(
      await readFile(new URL('../supabase/shipping-setup.sql', import.meta.url), 'utf8'),
    );
    const old = (
      await db.query(
        'select shipping_price,order_total from public.storefront_order_requests where id=$1',
        [legacy],
      )
    ).rows[0];
    assert.equal(old.shipping_price, null);
    assert.equal(old.order_total, null);
    await db.exec(
      "insert into public.products(id,name,slug,status,has_variants,base_price,currency,discount_type,discount_value) values('33333333-3333-4333-8333-333333333333','Test balm','test-balm','active',false,399,'INR','amount',100);insert into public.product_variants(id,product_id,sku,title,price,stock,currency,is_default,discount_type,discount_value) values('44444444-4444-4444-8444-444444444444','33333333-3333-4333-8333-333333333333','BALM','Standard',399,10,'INR',true,'none',0)",
    );
    const login = async (id, role = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec(`set role ${role}`);
    };
    const save = (area) =>
      db.query('select public.storefront_admin_save_shipping_area($1::jsonb) as id', [
        JSON.stringify(area),
      ]);
    const area = (name, price, is_active = true) => ({
      id: null,
      expected_updated_at: null,
      name,
      price,
      is_active,
    });
    await login(owner);
    const central = (await save(area('Central Market', 50))).rows[0].id;
    const free = (await save(area('Town Centre', 0))).rows[0].id;
    const inactive = (await save(area('Outside Area', 75, false))).rows[0].id;
    await assert.rejects(() => save(area(' central   market ', 60)), /unique constraint/);
    await login('', 'anon');
    assert.equal((await db.query('select * from public.storefront_shipping_areas')).rows.length, 2);
    await assert.rejects(() => save(area('Forbidden', 10)), /permission denied/);
    await login(customer);
    assert.equal(
      (await db.query('select * from public.storefront_shipping_areas where id=$1', [inactive]))
        .rows.length,
      0,
    );
    await assert.rejects(() => save(area('Forbidden', 10)), /ADMIN_REQUIRED/);
    await assert.rejects(
      () => db.query('update public.storefront_shipping_areas set price=0'),
      /permission denied/,
    );
    const items = [
      {
        product_id: '33333333-3333-4333-8333-333333333333',
        variant_id: '44444444-4444-4444-8444-444444444444',
        quantity: 1,
      },
    ];
    const address = {
      name: 'Test Customer',
      phone: '9876543210',
      address: '12 Example Street',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700001',
      notes: '',
    };
    const key = '66666666-6666-4666-8666-666666666666';
    const submit = (shipping, total = 349, request = key) =>
      db.query(
        'select public.storefront_submit_request($1::uuid,$2::jsonb,$3::jsonb,$4) as result',
        [request, JSON.stringify(items), JSON.stringify(shipping), total],
      );
    await assert.rejects(() => submit(address), /AREA_REQUIRED/);
    await assert.rejects(
      () => submit({ ...address, area_id: inactive, expected_price: 75 }, 374),
      /AREA_UNAVAILABLE/,
    );
    await assert.rejects(
      () =>
        submit(
          { ...address, area_id: '77777777-7777-4777-8777-777777777777', expected_price: 0 },
          299,
        ),
      /AREA_UNAVAILABLE/,
    );
    await assert.rejects(
      () => submit({ ...address, area_id: central, expected_price: 0 }, 299),
      /SHIPPING_PRICE_CHANGED/,
    );
    await assert.rejects(
      () => submit({ ...address, area_id: central, expected_price: 50 }, 299),
      /PRICE_CHANGED/,
    );
    const placed = (await submit({ ...address, area_id: central, expected_price: 50 })).rows[0]
      .result;
    assert.equal(placed.item_total, 299);
    assert.equal(placed.shipping_price, 50);
    assert.equal(placed.order_total, 349);
    assert.equal(placed.shipping_area_name, 'Central Market');
    await login(owner);
    const before = (
      await db.query(
        'select *,updated_at::text as updated_at from public.storefront_shipping_areas where id=$1',
        [central],
      )
    ).rows[0];
    await save({
      id: central,
      name: 'Central District',
      price: 80,
      is_active: false,
      expected_updated_at: before.updated_at,
    });
    await assert.rejects(
      () =>
        save({
          id: central,
          name: 'Stale edit',
          price: 100,
          is_active: true,
          expected_updated_at: before.updated_at,
        }),
      /CONFLICT/,
    );
    await login(customer);
    const retried = (await submit({ ...address, area_id: central, expected_price: 50 })).rows[0]
      .result;
    assert.deepEqual(
      retried,
      placed,
      'retry returns the original delivery snapshot even after area changes',
    );
    await assert.rejects(
      () =>
        submit(
          { ...address, area_id: central, expected_price: 80 },
          379,
          '88888888-8888-4888-8888-888888888888',
        ),
      /AREA_UNAVAILABLE/,
    );
    const noCharge = (
      await submit(
        { ...address, area_id: free, expected_price: 0 },
        299,
        '99999999-9999-4999-8999-999999999999',
      )
    ).rows[0].result;
    assert.equal(noCharge.shipping_price, 0);
    assert.equal(noCharge.order_total, 299);
    const saved = (
      await db.query(
        'select shipping_area_name,shipping_price,order_total from public.storefront_order_requests where id=$1',
        [placed.id],
      )
    ).rows[0];
    assert.equal(saved.shipping_area_name, 'Central Market');
    assert.equal(Number(saved.order_total), 349);
  } finally {
    await db.close();
  }
});
