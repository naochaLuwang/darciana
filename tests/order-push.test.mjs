import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { handleNewOrderPush } from '../src/lib/order-push-handler.ts';
const customer = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const orderId = '33333333-3333-4333-8333-333333333333';
const secret = 'a'.repeat(64);
const sql = async (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8');

test('new-order webhook authenticates, reads the actual order, excludes supplied recipients and deduplicates', async () => {
  let lookups = 0;
  let exists = true;
  let duplicate = false;
  const sent = [];
  const db = {
    from: (table) => {
      assert.equal(table, 'storefront_order_requests');
      return {
        select: () => ({
          eq: (_, id) => {
            assert.equal(id, orderId);
            return {
              maybeSingle: async () => {
                lookups++;
                return {
                  data: exists ? { id: orderId, order_total: 480.5, item_total: 400 } : null,
                  error: null,
                };
              },
            };
          },
        }),
      };
    },
  };
  const deps = {
    db,
    secret,
    send: async (input) => {
      sent.push(input);
      return duplicate ? { duplicate: true, error: 'Already requested' } : { sent: 2 };
    },
  };
  const request = (token = secret, body = { order_id: orderId }) =>
    new Request('https://store.test/api/push/new-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  assert.equal((await handleNewOrderPush(request('b'.repeat(64)), deps)).status, 401);
  assert.equal(lookups, 0);
  assert.equal(
    (await handleNewOrderPush(request(secret, { order_id: orderId, user_id: owner }), deps)).status,
    400,
  );
  assert.equal((await handleNewOrderPush(request(secret, { order_id: 'bad' }), deps)).status, 400);
  exists = false;
  assert.equal((await handleNewOrderPush(request(), deps)).status, 404);
  assert.equal(sent.length, 0);
  exists = true;
  const result = await handleNewOrderPush(request(), deps);
  assert.equal(result.status, 200);
  assert.equal(sent[0].audience, 'admin_order');
  assert.equal(sent[0].actorId, null);
  assert.equal(sent[0].eventKey, `new-order:${orderId}`);
  assert.equal(sent[0].body, 'Order #33333333 · ₹481');
  assert.equal(sent[0].path, `/admin/orders/${orderId}`);
  duplicate = true;
  const repeated = await handleNewOrderPush(request(), deps);
  assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).duplicate, true);
});

test('guest push registrations stay private and admin recipients require current enrollment', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role service_role bypassrls');
    await initializeStoreDatabase(db, customer, owner);
    await db.exec(await sql('push-setup.sql'));
    await db.exec(await sql('admin-order-push-setup.sql'));
    await db.exec(await sql('push-setup.sql'));
    await db.exec(await sql('admin-order-push-setup.sql'));
    await db.exec('set role service_role');
    for (const [index, userId] of [
      [1, null],
      [2, customer],
      [3, owner],
    ])
      await db.query(
        'insert into public.storefront_push_devices(id,secret_hash,user_id,token,announcements) values($1,$2,$3,$4,$5)',
        [
          `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`,
          secret,
          userId,
          `token-${index}-` + 'x'.repeat(40),
          userId !== owner,
        ],
      );
    assert.equal(
      (await db.query('select * from public.storefront_admin_push_devices()')).rows.length,
      1,
    );
    await db.exec('reset role; set role authenticated');
    await assert.rejects(
      db.query('select * from public.storefront_admin_push_devices()'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select token from public.storefront_push_devices'),
      /permission denied/,
    );
    await db.exec('reset role; set role anon');
    await assert.rejects(
      db.query('select * from public.storefront_admin_push_devices()'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select * from public.storefront_push_devices'),
      /permission denied/,
    );
    await db.exec('reset role');
    await db.query('delete from private.storefront_admins where user_id=$1', [owner]);
    await db.exec('set role service_role');
    assert.equal(
      (await db.query('select * from public.storefront_admin_push_devices()')).rows.length,
      0,
    );
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [customer]);
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.storefront_push_devices where user_id is null',
        )
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          'select count(*)::int n from public.storefront_push_devices where user_id=$1',
          [customer],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test('database hook schedules only new orders, protects its secret, reruns safely and never fails checkout on transport errors', async () => {
  const db = new PGlite();
  try {
    await initializeStoreDatabase(db, customer, owner);
    await db.exec(`create schema net;create schema vault;
   create table vault.decrypted_secrets(name text,decrypted_secret text);
   create table net.requests(id bigserial primary key,url text,headers jsonb,body jsonb);
   create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$ declare request_id bigint; begin
    if current_setting('test.transport_fail',true)='yes' then raise exception 'transport down';end if;
    insert into net.requests(url,headers,body) values(url,headers,body) returning id into request_id;return request_id;end $$;`);
    const insert = () =>
      db.query(
        "insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping) values($1,gen_random_uuid(),'[]',100,'{}') returning id",
        [customer],
      );
    await insert();
    const hook = (await sql('order-push-webhook-setup.sql')).replace(
      /^create extension[^\n]*\n/gm,
      '',
    );
    await db.exec(hook);
    assert.equal((await db.query('select * from net.requests')).rows.length, 0);
    await db.query('insert into vault.decrypted_secrets values($1,$2)', [
      'daciana_order_push_secret',
      secret,
    ]);
    const created = (await insert()).rows[0].id;
    let requests = (await db.query('select * from net.requests')).rows;
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].body, { order_id: created });
    assert.equal(requests[0].headers.Authorization, `Bearer ${secret}`);
    assert.equal(requests[0].url, 'https://dacianastore.in/api/push/new-order');
    await db.exec(hook);
    await db.query("update public.storefront_order_requests set status='confirmed' where id=$1", [
      created,
    ]);
    assert.equal((await db.query('select * from net.requests')).rows.length, 1);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select * from vault.decrypted_secrets'), /permission denied/);
    await assert.rejects(
      db.query('select private.storefront_notify_new_order()'),
      /permission denied/,
    );
    await db.exec("reset role;select set_config('test.transport_fail','yes',false)");
    await insert();
    assert.equal(
      (await db.query('select count(*)::int n from public.storefront_order_requests')).rows[0].n,
      3,
    );
    assert.equal((await db.query('select * from net.requests')).rows.length, 1);
    await db.exec(
      "select set_config('test.transport_fail','no',false);delete from vault.decrypted_secrets",
    );
    await insert();
    assert.equal((await db.query('select * from net.requests')).rows.length, 1);
  } finally {
    await db.close();
  }
});
