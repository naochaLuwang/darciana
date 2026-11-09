import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { discountedPrice } from '../src/lib/commerce.ts';
import { totalWithShipping } from '../src/lib/shipping.ts';

test('database upgrade rounds new catalog/area amounts and checkout units while preserving history, authorization and retries', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  const product = '33333333-3333-4333-8333-333333333333';
  const variant = '44444444-4444-4444-8444-444444444444';
  const area = '55555555-5555-4555-8555-555555555555';
  const request = '66666666-6666-4666-8666-666666666666';
  try {
    await initializeStoreDatabase(db, customer, owner);
    await db.exec(
      await readFile(new URL('../supabase/shipping-setup.sql', import.meta.url), 'utf8'),
    );
    await db.exec(`insert into public.products(id,name,slug,status,has_variants,base_price,currency,discount_type,discount_value) values('${product}','Whole rupee product','whole-rupee-product','active',false,999.4,'INR','percentage',50);
      insert into public.product_variants(id,product_id,sku,title,price,stock,currency,is_default,discount_type,discount_value) values('${variant}','${product}','ROUND','Standard',999.4,10,'INR',true,'amount',19.5);
      insert into public.storefront_shipping_areas(id,name,price) values('${area}','Delivery',50.5);
      insert into public.categories(name,slug) values('Preserved category','preserved-category');`);
    const old = (
      await db.query(
        'insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping) values($1,gen_random_uuid(),\'[{"unit_price":149.75,"quantity":2}]\',299.5,\'{}\') returning id',
        [customer],
      )
    ).rows[0].id;
    const history = (
      await db.query('select * from public.storefront_order_requests where id=$1', [old])
    ).rows;
    const categories = (await db.query('select * from public.categories order by id')).rows;
    const users = (await db.query('select * from auth.users order by id')).rows;
    const upgrade = await readFile(
      new URL('../supabase/whole-rupee-setup.sql', import.meta.url),
      'utf8',
    );
    await db.exec(upgrade);
    await db.exec(upgrade);
    assert.equal(
      Number(
        (await db.query('select base_price from public.products where id=$1', [product])).rows[0]
          .base_price,
      ),
      999,
    );
    const option = (
      await db.query('select price,discount_value from public.product_variants where id=$1', [
        variant,
      ])
    ).rows[0];
    assert.equal(Number(option.price), 999);
    assert.equal(Number(option.discount_value), 20);
    assert.equal(
      Number(
        (await db.query('select price from public.storefront_shipping_areas where id=$1', [area]))
          .rows[0].price,
      ),
      51,
    );
    assert.deepEqual(
      (await db.query('select * from public.storefront_order_requests where id=$1', [old])).rows,
      history,
    );
    assert.deepEqual(
      (await db.query('select * from public.categories order by id')).rows,
      categories,
    );
    assert.deepEqual((await db.query('select * from auth.users order by id')).rows, users);
    // New writes are normalized too; percentage rates remain unchanged.
    await db.query(
      "update public.product_variants set price=149.5, discount_type='percentage', discount_value=12.5 where id=$1",
      [variant],
    );
    const updated = (
      await db.query('select price,discount_value from public.product_variants where id=$1', [
        variant,
      ])
    ).rows[0];
    assert.equal(Number(updated.price), 150);
    assert.equal(Number(updated.discount_value), 12.5);
    await db.query('update public.storefront_shipping_areas set price=50.5 where id=$1', [area]);
    await db.exec('set role authenticated');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [customer]);
    const items = [{ product_id: product, variant_id: variant, quantity: 3 }];
    const address = {
      name: 'Test Customer',
      phone: '9876543210',
      address: '12 Example Street',
      city: 'Imphal',
      state: 'Manipur',
      pincode: '795001',
      notes: '',
      area_id: area,
      expected_price: 51,
    };
    const unit = discountedPrice(999, 'percentage', 50);
    const expected = totalWithShipping(unit * 3, 51);
    assert.equal(expected, 1551);
    const submit = (total) =>
      db.query(
        'select public.storefront_submit_request($1,$2::jsonb,$3::jsonb,$4::numeric) result',
        [request, JSON.stringify(items), JSON.stringify(address), total],
      );
    await assert.rejects(submit(1549.5), /PRICE_CHANGED/);
    const first = (await submit(expected)).rows[0].result;
    assert.equal(first.item_total, 1500);
    assert.equal(first.shipping_price, 51);
    assert.equal(first.order_total, 1551);
    const snapshot = (
      await db.query('select items from public.storefront_order_requests where id=$1', [first.id])
    ).rows[0].items;
    assert.equal(snapshot[0].unit_price, 500);
    assert.equal((await submit(expected)).rows[0].result.id, first.id);
    await db.query('update public.products set base_price=1');
    assert.equal(
      Number(
        (await db.query('select base_price from public.products where id=$1', [product])).rows[0]
          .base_price,
      ),
      999,
      'RLS prevents a customer from changing the price',
    );
    await db.exec('reset role; set role anon');
    await assert.rejects(submit(expected), /permission denied/);
    await db.exec('reset role');
    // Compare JS/SQL half-rounding, including percentage floating-point boundaries.
    for (const [price, rate] of [
      [100, 54.5],
      [999, 50],
      [199.99, 15],
      [299, 12.5],
      [99.5, 0],
      [1, 50],
    ]) {
      const sql = (
        await db.query(
          'select round(greatest(0,$1::numeric*(1-$2::numeric/100)),0)::integer amount',
          [price, rate],
        )
      ).rows[0].amount;
      assert.equal(discountedPrice(price, 'percentage', rate), sql);
    }
  } finally {
    await db.close();
  }
});
