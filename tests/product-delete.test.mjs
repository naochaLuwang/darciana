import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';

test('permanent product deletion checks authority and confirmation, preserves orders, and rolls back linked records on failure', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  try {
    await initializeStoreDatabase(db, customer, owner);
    // The upgrade can be applied again without changing catalog data or grants.
    await db.exec(
      await readFile(new URL('../supabase/product-delete-setup.sql', import.meta.url), 'utf8'),
    );
    const category = (
      await db.query(
        "insert into public.categories(name,slug) values('Cosmetics','cosmetics') returning id",
      )
    ).rows[0].id;
    const product = (
      await db.query(
        "insert into public.products(name,slug,status,base_price) values('Rose lipstick','rose-lipstick','active',299) returning id,updated_at::text as version",
      )
    ).rows[0];
    await db.query(
      "insert into public.product_variants(product_id,sku,title,price,stock) values($1,'ROSE-01','Rose',299,5),($1,'ROSE-02','Peach',299,3)",
      [product.id],
    );
    await db.query('insert into public.product_categories(product_id,category_id) values($1,$2)', [
      product.id,
      category,
    ]);
    const variant = (
      await db.query('select id from public.product_variants where product_id=$1 limit 1', [
        product.id,
      ])
    ).rows[0].id;
    await db.query(
      "insert into public.product_images(product_id,url,position) values($1,'https://example.com/product.jpg',0)",
      [product.id],
    );
    await db.query(
      "insert into public.variant_images(product_variant_id,url,position) values($1,'https://example.com/variant.jpg',0)",
      [variant],
    );
    const items = [
      {
        product_id: product.id,
        variant_id: variant,
        name: 'Rose lipstick',
        option: 'Rose',
        quantity: 1,
        unit_price: 299,
      },
    ];
    const order = (
      await db.query(
        "insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping) values($1,gen_random_uuid(),$2::jsonb,299,'{}') returning id",
        [customer, JSON.stringify(items)],
      )
    ).rows[0].id;
    const login = async (id, role = 'authenticated') => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec(`set role ${role}`);
    };
    const remove = (version = product.version, confirmation = 'DELETE') =>
      db.query('select public.storefront_admin_delete_product($1,$2,$3) as id', [
        product.id,
        version,
        confirmation,
      ]);
    const assertCatalogIntact = async () => {
      await db.exec('reset role');
      assert.equal(
        (await db.query('select count(*)::int as n from public.products where id=$1', [product.id]))
          .rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int as n from public.product_variants where product_id=$1',
            [product.id],
          )
        ).rows[0].n,
        2,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int as n from public.product_categories where product_id=$1',
            [product.id],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int as n from public.product_images where product_id=$1',
            [product.id],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            'select count(*)::int as n from public.variant_images where product_variant_id=$1',
            [variant],
          )
        ).rows[0].n,
        1,
      );
    };
    await login('', 'anon');
    await assert.rejects(() => remove(), /permission denied/);
    await login(customer);
    await assert.rejects(() => remove(), /ADMIN_REQUIRED/);
    await assert.rejects(
      () =>
        db.query('select private.storefront_admin_delete_product($1,$2,$3)', [
          product.id,
          product.version,
          'DELETE',
        ]),
      /ADMIN_REQUIRED/,
    );
    await login(owner);
    await assert.rejects(() => remove(product.version, ''), /INVALID_DELETE_CONFIRMATION/);
    await assert.rejects(() => remove('2000-01-01T00:00:00Z'), /CONFLICT/);
    await assertCatalogIntact();

    // An older integration must not lose historical rows through CASCADE.
    await db.exec(
      'create table public.legacy_order_lines(id uuid default gen_random_uuid(),variant_id uuid references public.product_variants(id) on delete cascade)',
    );
    await db.query('insert into public.legacy_order_lines(variant_id) values($1)', [variant]);
    await login(owner);
    await assert.rejects(() => remove(), /PRODUCT_REFERENCED/);
    await assertCatalogIntact();
    assert.equal(
      (await db.query('select count(*)::int as n from public.legacy_order_lines')).rows[0].n,
      1,
    );
    await db.exec('delete from public.legacy_order_lines');

    // A failure after the catalog DELETEs must restore every deleted row.
    await db.exec(`create function public.reject_delete_activity() returns trigger language plpgsql as $$ begin if new.action='product_deleted' then raise exception 'AUDIT_FAILED'; end if; return new; end $$;
      create trigger reject_delete_activity before insert on public.storefront_admin_activity for each row execute function public.reject_delete_activity();`);
    await login(owner);
    await assert.rejects(() => remove(), /AUDIT_FAILED/);
    await assertCatalogIntact();
    await db.exec('drop trigger reject_delete_activity on public.storefront_admin_activity');
    await login(owner);
    assert.equal((await remove()).rows[0].id, product.id);
    await assert.rejects(() => remove(), /NOT_FOUND/);
    await db.exec('reset role');
    for (const [table, column] of [
      ['products', 'id'],
      ['product_variants', 'product_id'],
      ['product_categories', 'product_id'],
      ['product_images', 'product_id'],
    ]) {
      assert.equal(
        (
          await db.query(`select count(*)::int as n from public.${table} where ${column}=$1`, [
            product.id,
          ])
        ).rows[0].n,
        0,
      );
    }
    assert.equal(
      (
        await db.query(
          'select count(*)::int as n from public.variant_images where product_variant_id=$1',
          [variant],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query('select count(*)::int as n from public.categories where id=$1', [category]))
        .rows[0].n,
      1,
    );
    const historical = (
      await db.query('select items,item_total from public.storefront_order_requests where id=$1', [
        order,
      ])
    ).rows[0];
    assert.deepEqual(historical.items, items);
    assert.equal(Number(historical.item_total), 299);
    const activity = (
      await db.query(
        "select actor_id,target_id,label from public.storefront_admin_activity where action='product_deleted'",
      )
    ).rows;
    assert.deepEqual(activity, [
      { actor_id: owner, target_id: product.id, label: 'Rose lipstick' },
    ]);

    // Removing registry membership takes effect even with the same identity.
    await db.query('delete from private.storefront_admins where user_id=$1', [owner]);
    await login(owner);
    await assert.rejects(() => remove(), /ADMIN_REQUIRED/);
  } finally {
    await db.close();
  }
});
