import test from 'node:test';
import assert from 'node:assert/strict';
import { pricingSchema, productPricing, priceUpdate } from '../src/lib/product-pricing.ts';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
const id = '33333333-3333-4333-8333-333333333333';
const variantId = '44444444-4444-4444-8444-444444444444';
function product() {
  return {
    id,
    name: 'Lip tint',
    slug: 'lip-tint',
    brand: 'Daciana',
    description: 'Original description',
    status: 'active',
    has_variants: false,
    base_price: 399,
    currency: 'INR',
    thumbnail_url:
      'https://example.supabase.co/storage/v1/object/public/storefront-media/products/photo.png',
    category_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    categoryIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00.123456Z',
    discount_type: 'amount',
    discount_value: 100,
    product_variants: [
      {
        id: variantId,
        title: 'Standard',
        sku: 'EXISTING-01',
        price: 399,
        stock: 7,
        image_url: null,
        hex_code: '#aabbcc',
        is_default: true,
        discount_type: 'amount',
        discount_value: 100,
        updated_at: '2026-11-01T00:00:00Z',
      },
    ],
  };
}
function patch(source, change = {}) {
  return pricingSchema.parse({
    id: source.id,
    expected_updated_at: source.updated_at,
    options: source.product_variants.map((option) => ({
      id: option.id,
      price: 500,
      discount_type: 'percentage',
      discount_value: 12.5,
      ...change,
    })),
  });
}

test('price input rejects fractional rupees, invalid discounts and duplicate option identifiers', () => {
  const source = product();
  const valid = patch(source);
  assert.equal(pricingSchema.safeParse(valid).success, true);
  for (const change of [
    { price: 1.5 },
    { price: -1 },
    { discount_value: 101 },
    { discount_value: 1.001 },
    { discount_type: 'amount', discount_value: 500.5 },
    { discount_type: 'amount', discount_value: 501 },
  ]) {
    assert.equal(
      pricingSchema.safeParse({ ...valid, options: [{ ...valid.options[0], ...change }] }).success,
      false,
    );
  }
  assert.equal(
    pricingSchema.safeParse({ ...valid, options: [valid.options[0], valid.options[0]] }).success,
    false,
  );
  assert.equal(pricingSchema.safeParse({ ...valid, expected_updated_at: '' }).success, false);
});
test('simple pricing changes synchronize the stock option while preserving server-owned catalog data', () => {
  const source = product();
  const original = structuredClone(source);
  const input = patch(source);
  const update = priceUpdate(source, input);
  assert.equal(update.base_price, 500);
  assert.equal(update.discount_type, 'percentage');
  assert.equal(update.discount_value, 12.5);
  assert.equal(update.variants[0].price, 500);
  assert.equal(update.variants[0].discount_value, 12.5);
  for (const key of ['sku', 'stock', 'title', 'is_default', 'hex_code'])
    assert.equal(update.variants[0][key], source.product_variants[0][key]);
  for (const key of ['name', 'slug', 'brand', 'description', 'status', 'thumbnail_url'])
    assert.equal(update[key], source[key]);
  assert.deepEqual(update.category_ids, source.categoryIds);
  assert.equal(update.expected_updated_at, source.updated_at);
  assert.deepEqual(source, original);
  // Extra client fields cannot rename products or change stock.
  const injected = pricingSchema.parse({
    ...input,
    name: 'Changed',
    options: [{ ...input.options[0], stock: 999, sku: 'Changed' }],
  });
  assert.equal(priceUpdate(source, injected).variants[0].stock, 7);
  assert.equal(priceUpdate(source, injected).name, 'Lip tint');
});
test('variant prices remain independent and require the exact saved option set', () => {
  const source = product();
  source.has_variants = true;
  source.base_price = null;
  source.product_variants.push({
    ...source.product_variants[0],
    id: '44444444-4444-4444-8444-444444444445',
    title: 'Rose',
    sku: 'EXISTING-02',
    is_default: false,
  });
  const input = patch(source);
  input.options[0] = {
    ...input.options[0],
    price: 700,
    discount_type: 'amount',
    discount_value: 50,
  };
  const update = priceUpdate(source, input);
  assert.equal(update.base_price, null);
  assert.equal(update.discount_type, 'none');
  assert.equal(update.discount_value, 0);
  assert.equal(update.variants[0].price, 700);
  assert.equal(update.variants[0].discount_value, 50);
  assert.equal(update.variants[1].price, 500);
  assert.equal(update.variants[1].discount_value, 12.5);
  assert.throws(
    () => priceUpdate(source, { ...input, options: input.options.slice(0, 1) }),
    /options have changed/,
  );
  assert.throws(
    () =>
      priceUpdate(source, {
        ...input,
        options: [
          input.options[0],
          { ...input.options[1], id: '44444444-4444-4444-8444-444444444446' },
        ],
      }),
    /options have changed/,
  );
  input.options[0].discount_type = 'none';
  input.options[0].discount_value = 99;
  assert.equal(priceUpdate(source, input).variants[0].discount_value, 0);
  const projected = productPricing(source);
  assert.equal('description' in projected, false);
  assert.equal('sku' in projected.options[0], false);
  assert.equal('stock' in projected.options[0], false);
});
test('real product-save transaction protects concurrent stock edits, preserves image rows and synchronizes prices', async () => {
  const db = new PGlite();
  try {
    await initializeStoreDatabase(db);
    await db.exec(`insert into public.products(id,name,slug,base_price,status,discount_type,discount_value) values('${id}','Lip tint','lip-tint',399,'active','none',0);
   insert into public.product_variants(id,product_id,title,sku,price,stock,is_default) values('${variantId}','${id}','Standard','EXISTING-01',399,7,true);
   insert into public.product_images(product_id,url,position) values('${id}','https://example.test/photo.png',0);`);
    const load = async () => {
      const base = (
        await db.query(
          `select *,to_char(updated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as updated_at from public.products where id=$1`,
          [id],
        )
      ).rows[0];
      return {
        ...base,
        categoryIds: [],
        product_variants: (
          await db.query('select * from public.product_variants where product_id=$1', [id])
        ).rows,
      };
    };
    const snapshot = await load();
    const input = patch(snapshot);
    const old = priceUpdate(snapshot, input);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      '22222222-2222-4222-8222-222222222222',
    ]);
    await db.exec('set role authenticated');
    const version = (
      await db.query(
        'select updated_at::text as version from public.product_variants where id=$1',
        [variantId],
      )
    ).rows[0].version;
    await db.query('select public.storefront_admin_set_stock($1,9,$2::timestamptz)', [
      variantId,
      version,
    ]);
    await assert.rejects(
      () =>
        db.query('select public.storefront_admin_save_product($1::jsonb)', [JSON.stringify(old)]),
      /CONFLICT/,
    );
    const fresh = await load();
    const update = priceUpdate(fresh, patch(fresh));
    await db.query('select public.storefront_admin_save_product($1::jsonb)', [
      JSON.stringify(update),
    ]);
    const saved = await load();
    assert.equal(Number(saved.base_price), 500);
    assert.equal(Number(saved.product_variants[0].price), 500);
    assert.equal(saved.product_variants[0].stock, 9);
    assert.equal(saved.product_variants[0].sku, 'EXISTING-01');
    assert.equal(Number(saved.discount_value), 12.5);
    await db.exec('reset role');
    assert.equal(
      (
        await db.query(
          'select count(*)::int as count from public.product_images where product_id=$1',
          [id],
        )
      ).rows[0].count,
      1,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      '11111111-1111-4111-8111-111111111111',
    ]);
    await db.exec('set role authenticated');
    await assert.rejects(
      () =>
        db.query('select public.storefront_admin_save_product($1::jsonb)', [
          JSON.stringify(update),
        ]),
      /ADMIN_REQUIRED/,
    );
  } finally {
    await db.close();
  }
});
