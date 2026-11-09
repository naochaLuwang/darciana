import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { PGlite } from '@electric-sql/pglite';
import { categorySchema } from '../src/lib/admin-validation.ts';

test('admin database operations enforce membership, transactions, stock conflicts and request transitions', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  try {
    await initializeStoreDatabase(db, customer, owner);
    const login = async (id) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec('set role authenticated');
    };
    const save = (payload) =>
      db.query('select public.storefront_admin_save_product($1::jsonb) as id', [
        JSON.stringify(payload),
      ]);
    const category = (payload) =>
      db.query('select public.storefront_admin_save_category($1::jsonb) as id', [
        JSON.stringify(payload),
      ]);
    await login(customer);
    assert.equal(
      (await db.query('select public.storefront_is_admin() as allowed')).rows[0].allowed,
      false,
    );
    await assert.rejects(() => save({}), /ADMIN_REQUIRED/);
    await assert.rejects(() => category({}), /ADMIN_REQUIRED/);
    await assert.rejects(
      () => db.query("insert into public.products(name,slug) values('Intruder','intruder')"),
      /row-level security/,
    );
    await assert.rejects(
      () => db.query('insert into private.storefront_admins(user_id) values($1)', [customer]),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        db.query(
          "insert into storage.objects(bucket_id,name) values('storefront-media','not-allowed.png')",
        ),
      /row-level security/,
    );
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ user_metadata: { role: 'admin' } }),
    ]);
    assert.equal(
      (await db.query('select public.storefront_is_admin() as allowed')).rows[0].allowed,
      false,
      'editable profile claims never grant access',
    );
    await login(owner);
    assert.equal(
      (await db.query('select public.storefront_is_admin() as allowed')).rows[0].allowed,
      true,
    );
    const parent = (
      await category({
        id: null,
        name: 'Cosmetics',
        slug: 'cosmetics',
        parent_id: null,
        image_url: '',
      })
    ).rows[0].id;
    const child = (
      await category({
        id: null,
        name: 'Lip colour',
        slug: 'lip-colour',
        parent_id: parent,
        image_url: '',
      })
    ).rows[0].id;
    // Legacy catalog data predates the current single-hyphen save constraint.
    await db.exec('reset role');
    const legacy = (
      await db.query(
        "insert into public.categories(name,slug,parent_id,image_url) values('Arts & Crafts','arts--crafts',$1,'') returning id",
        [parent],
      )
    ).rows[0].id;
    await login(owner);
    const legacyImage =
      'https://example.supabase.co/storage/v1/object/public/storefront-media/categories/arts.webp';
    const updatedLegacy = categorySchema.parse({
      id: legacy,
      name: 'Arts & Crafts',
      slug: 'arts--crafts',
      parent_id: parent,
      image_url: legacyImage,
    });
    assert.equal((await category(updatedLegacy)).rows[0].id, legacy);
    const savedLegacy = (
      await db.query('select slug,image_url,parent_id from public.categories where id=$1', [legacy])
    ).rows[0];
    assert.equal(savedLegacy.slug, 'arts-crafts');
    assert.equal(savedLegacy.image_url, legacyImage);
    assert.equal(savedLegacy.parent_id, parent);
    await assert.rejects(
      () =>
        category({
          id: parent,
          name: 'Cosmetics',
          slug: 'cosmetics',
          parent_id: child,
          image_url: '',
        }),
      /CATEGORY_CYCLE/,
    );
    const payload = {
      id: null,
      expected_updated_at: null,
      name: 'Test lipstick',
      slug: 'test-lipstick',
      description: 'A test product',
      brand: 'Test',
      status: 'active',
      has_variants: false,
      base_price: 399,
      thumbnail_url: '',
      category_ids: [child],
      discount_type: 'amount',
      discount_value: 100,
      variants: [
        {
          id: null,
          title: 'Standard',
          sku: 'TEST-STANDARD',
          price: 399,
          stock: 10,
          is_default: true,
          image_url: '',
          hex_code: '',
          discount_type: 'none',
          discount_value: 0,
        },
      ],
    };
    const id = (await save(payload)).rows[0].id;
    const product = (
      await db.query('select *,updated_at::text as updated_at from public.products where id=$1', [
        id,
      ])
    ).rows[0];
    const variant = (
      await db.query(
        'select *,updated_at::text as updated_at from public.product_variants where product_id=$1',
        [id],
      )
    ).rows[0];
    assert.equal(product.category_id, child);
    assert.equal(
      variant.discount_type,
      'amount',
      'simple product prices and option prices stay aligned',
    );
    assert.equal(Number(variant.discount_value), 100);
    await assert.rejects(
      () =>
        save({
          ...payload,
          id: null,
          slug: 'bad-product',
          variants: [{ ...payload.variants[0], id: variant.id, sku: 'OTHER' }],
        }),
      /INVALID_VARIANT/,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from public.products where slug='bad-product'"))
        .rows[0].n,
      0,
      'a failed option write rolls the product insert back',
    );
    await db.query('select public.storefront_admin_set_stock($1,12,$2)', [
      variant.id,
      variant.updated_at,
    ]);
    await assert.rejects(
      () =>
        db.query('select public.storefront_admin_set_stock($1,13,$2)', [
          variant.id,
          variant.updated_at,
        ]),
      /CONFLICT/,
    );
    await assert.rejects(
      () =>
        save({
          ...payload,
          id,
          expected_updated_at: product.updated_at,
          variants: [{ ...payload.variants[0], id: variant.id }],
        }),
      /CONFLICT/,
    );
    const fresh = (
      await db.query('select *,updated_at::text as updated_at from public.products where id=$1', [
        id,
      ])
    ).rows[0];
    await db.query("select public.storefront_admin_set_product_status($1,'inactive',$2)", [
      id,
      fresh.updated_at,
    ]);
    const current = (
      await db.query('select *,updated_at::text as updated_at from public.products where id=$1', [
        id,
      ])
    ).rows[0];
    // Switching defaults succeeds even with the common unique partial index.
    await save({
      ...payload,
      id,
      expected_updated_at: current.updated_at,
      has_variants: true,
      base_price: null,
      variants: [
        { ...payload.variants[0], id: null, sku: 'TEST-NEW', is_default: true },
        { ...payload.variants[0], id: variant.id, is_default: false },
      ],
    });
    await db.query(
      "insert into storage.objects(bucket_id,name) values('storefront-media','owner-image.png')",
    );
    await db.exec('reset role');
    const request = (
      await db.query(
        "insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping) values($1,gen_random_uuid(),'[]',299,'{}') returning id",
        [customer],
      )
    ).rows[0].id;
    await login(owner);
    await db.query(
      "select public.storefront_admin_set_order_status($1,'confirmed','awaiting_confirmation')",
      [request],
    );
    await assert.rejects(
      () =>
        db.query(
          "select public.storefront_admin_set_order_status($1,'cancelled','awaiting_confirmation')",
          [request],
        ),
      /CONFLICT/,
    );
    await db.query("select public.storefront_admin_set_order_status($1,'completed','confirmed')", [
      request,
    ]);
    await assert.rejects(
      () =>
        db.query("select public.storefront_admin_set_order_status($1,'cancelled','completed')", [
          request,
        ]),
      /INVALID_TRANSITION/,
    );
    assert.ok((await db.query('select * from public.storefront_admin_activity')).rows.length >= 6);
    await login(customer);
    assert.equal((await db.query('select * from public.storefront_admin_activity')).rows.length, 0);
    await assert.rejects(
      () => db.query('select public.storefront_admin_overview()'),
      /ADMIN_REQUIRED/,
    );
    await db.exec('reset role');
    await db.query('delete from private.storefront_admins where user_id=$1', [owner]);
    await login(owner);
    assert.equal(
      (await db.query('select public.storefront_is_admin() as allowed')).rows[0].allowed,
      false,
      'revocation applies without JWT refresh',
    );
    await assert.rejects(
      () =>
        category({ id: null, name: 'Blocked', slug: 'blocked', parent_id: null, image_url: '' }),
      /ADMIN_REQUIRED/,
    );
  } finally {
    await db.close();
  }
});
