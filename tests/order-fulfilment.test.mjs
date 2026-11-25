import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { orderStatusSchema, paymentStatusSchema } from '../src/lib/admin-validation.ts';
import { orderTransitions, orderStatusOptions } from '../src/lib/order-status.ts';
import { notifyOrderChange } from '../src/lib/order-notifications.ts';
import { orderEmail } from '../src/lib/order-email.ts';

const customer = '11111111-1111-4111-8111-111111111111';
const owner = '22222222-2222-4222-8222-222222222222';
const id = '33333333-3333-4333-8333-333333333333';
const upgrade = () =>
  readFile(new URL('../supabase/order-fulfilment-setup.sql', import.meta.url), 'utf8');

test('delivery and payment validation enforce forward stages and independent payment changes', () => {
  for (const [expected_status, options] of Object.entries(orderTransitions))
    for (const status of options)
      assert.equal(orderStatusSchema.safeParse({ id, expected_status, status }).success, true);
  for (const [expected_status, status] of [
    ['awaiting_confirmation', 'delivered'],
    ['processing', 'processing'],
    ['shipped', 'processing'],
    ['shipped', 'cancelled'],
    ['out_for_delivery', 'cancelled'],
    ['delivered', 'cancelled'],
    ['completed', 'processing'],
    ['cancelled', 'shipped'],
  ])
    assert.equal(orderStatusSchema.safeParse({ id, expected_status, status }).success, false);
  for (const [current, enabled] of [
    ['awaiting_confirmation', ['awaiting_confirmation', 'processing', 'cancelled']],
    ['processing', ['processing', 'shipped', 'cancelled']],
    ['shipped', ['shipped', 'out_for_delivery']],
    ['out_for_delivery', ['out_for_delivery', 'delivered']],
    ['delivered', ['delivered']],
    ['cancelled', ['cancelled']],
    ['confirmed', ['confirmed', 'processing', 'cancelled']],
    ['completed', ['completed']],
  ]) {
    assert.deepEqual(
      orderStatusOptions(current)
        .filter((option) => !option.disabled)
        .map((option) => option.value),
      enabled,
    );
  }
  assert.equal(
    paymentStatusSchema.safeParse({
      id,
      status: 'paid',
      expected_status: 'unpaid',
      expected_updated_at: '2026-11-01T12:00:00Z',
    }).success,
    true,
  );
  assert.equal(
    paymentStatusSchema.safeParse({
      id,
      status: 'paid',
      expected_status: 'paid',
      expected_updated_at: '2026-11-01T12:00:00Z',
    }).success,
    false,
  );
  assert.equal(
    paymentStatusSchema.safeParse({ id, status: 'paid', expected_status: 'unpaid' }).success,
    false,
  );
});

test('fulfilment SQL preserves historical orders, protects payments and rejects stale or skipped updates', async () => {
  const db = new PGlite();
  try {
    await initializeStoreDatabase(db, customer, owner, { fulfilment: false });
    await db.query(
      "insert into public.storefront_order_requests(id,user_id,request_key,items,item_total,shipping,status) values($1,$2,gen_random_uuid(),'[]',299,'{}','awaiting_confirmation')",
      [id, customer],
    );
    const historical = (
      await db.query(
        "insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping,status) values($1,gen_random_uuid(),'[]',499,'{}','completed') returning id",
        [customer],
      )
    ).rows[0].id;
    // Simulate the email history constraint installed before delivery tracking existed.
    await db.exec(
      "create table public.storefront_email_deliveries(order_status text check (order_status in ('awaiting_confirmation','confirmed','completed','cancelled')))",
    );
    await db.exec(await upgrade());
    await db.exec(await upgrade());
    assert.equal(
      (
        await db.query('select status from public.storefront_order_requests where id=$1', [
          historical,
        ])
      ).rows[0].status,
      'completed',
    );
    await db.exec("insert into public.storefront_email_deliveries values('shipped')");
    const login = async (who) => {
      await db.exec('reset role');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [who]);
      await db.exec('set role authenticated');
    };
    const snapshot = async () =>
      (
        await db.query(
          'select status,payment_status,payment_updated_at::text as version,item_total,shipping from public.storefront_order_requests where id=$1',
          [id],
        )
      ).rows[0];
    const stage = (status, expected) =>
      db.query('select public.storefront_admin_set_order_status($1,$2,$3)', [id, status, expected]);
    const payment = (status, expected, version) =>
      db.query('select public.storefront_admin_set_payment_status($1,$2,$3,$4::timestamptz)', [
        id,
        status,
        expected,
        version,
      ]);
    await login(customer);
    const initial = await snapshot();
    assert.equal(initial.payment_status, 'unpaid');
    await assert.rejects(() => stage('processing', 'awaiting_confirmation'), /ADMIN_REQUIRED/);
    await assert.rejects(() => payment('paid', 'unpaid', initial.version), /ADMIN_REQUIRED/);
    await assert.rejects(
      () =>
        db.query("update public.storefront_order_requests set payment_status='paid' where id=$1", [
          id,
        ]),
      /permission denied|row-level security/,
    );
    await login(owner);
    await assert.rejects(() => stage('delivered', 'awaiting_confirmation'), /INVALID_TRANSITION/);
    await stage('processing', 'awaiting_confirmation');
    await assert.rejects(() => stage('shipped', 'awaiting_confirmation'), /CONFLICT/);
    await stage('shipped', 'processing');
    await assert.rejects(() => stage('cancelled', 'shipped'), /INVALID_TRANSITION/);
    await stage('out_for_delivery', 'shipped');
    await assert.rejects(() => stage('cancelled', 'out_for_delivery'), /INVALID_TRANSITION/);
    await stage('delivered', 'out_for_delivery');
    await assert.rejects(() => stage('cancelled', 'delivered'), /INVALID_TRANSITION/);
    assert.equal((await snapshot()).payment_status, 'unpaid', 'delivery never implies payment');
    await payment('paid', 'unpaid', initial.version);
    const paid = await snapshot();
    await assert.rejects(() => payment('unpaid', 'paid', initial.version), /CONFLICT/);
    await payment('unpaid', 'paid', paid.version);
    // The status has cycled back, but a stale timestamp must still prevent overwriting it.
    await assert.rejects(() => payment('paid', 'unpaid', initial.version), /CONFLICT/);
    const unpaid = await snapshot();
    await payment('paid', 'unpaid', unpaid.version);
    assert.equal((await snapshot()).status, 'delivered', 'payment never changes delivery');
    assert.equal(Number((await snapshot()).item_total), 299, 'saved prices are unchanged');
    await db.exec('reset role');
    await db.exec(await upgrade());
    assert.equal(
      (await snapshot()).payment_status,
      'paid',
      'rerunning the upgrade preserves recorded payments',
    );
    const audit = (
      await db.query('select action from public.storefront_admin_activity where target_id=$1', [id])
    ).rows.map((row) => row.action);
    assert.deepEqual(
      audit.sort(),
      [
        'payment_paid',
        'payment_paid',
        'payment_unpaid',
        'request_delivered',
        'request_out_for_delivery',
        'request_processing',
        'request_shipped',
      ].sort(),
    );
    assert.equal(
      (
        await db.query(
          "select has_function_privilege('anon','public.storefront_admin_set_payment_status(uuid,text,text,timestamptz)','execute') as allowed",
        )
      ).rows[0].allowed,
      false,
    );
  } finally {
    await db.close();
  }
});

test('delivery notifications use the real owner, skip superseded changes and handle delivery failures without changing orders', async () => {
  let current = 'processing';
  let exists = true;
  let dbError = false;
  let throws = false;
  const notifications = [];
  const db = {
    from: (table) => {
      assert.equal(table, 'storefront_order_requests');
      return {
        select: () => ({
          eq: (_, key) => {
            assert.equal(key, id);
            return {
              single: async () => ({
                data: exists ? { user_id: customer, status: current } : null,
                error: dbError ? { code: 'fail' } : null,
              }),
            };
          },
        }),
      };
    },
  };
  const send = async (notification) => {
    if (throws) throw new Error('provider unavailable');
    notifications.push(notification);
    return { success: 'Sent to 1 device.', sent: 1 };
  };
  for (const status of ['processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled']) {
    current = status;
    const result = await notifyOrderChange({ orderId: id, status, actorId: owner }, db, send);
    assert.equal(result.sent, 1);
    assert.equal(notifications.at(-1).userId, customer);
    assert.equal(notifications.at(-1).actorId, owner);
    assert.equal(notifications.at(-1).audience, 'order');
    assert.equal(notifications.at(-1).eventKey, `order:${id}:${status}`);
    assert.equal(notifications.at(-1).path, '/account');
  }
  const count = notifications.length;
  await notifyOrderChange({ orderId: id, status: 'processing', actorId: owner }, db, send);
  assert.equal(notifications.length, count, 'older changes do not notify after a newer stage');
  exists = false;
  assert.ok(
    (await notifyOrderChange({ orderId: id, status: 'processing', actorId: owner }, db, send))
      .error,
  );
  exists = true;
  dbError = true;
  assert.ok(
    (await notifyOrderChange({ orderId: id, status: 'cancelled', actorId: owner }, db, send)).error,
  );
  dbError = false;
  throws = true;
  assert.ok(
    (await notifyOrderChange({ orderId: id, status: 'cancelled', actorId: owner }, db, send)).error,
  );
  const duplicate = await notifyOrderChange(
    { orderId: id, status: 'cancelled', actorId: owner },
    db,
    async () => ({ duplicate: true, error: 'duplicate' }),
  );
  assert.equal(duplicate.error, undefined);
  assert.match(duplicate.success, /already requested/);
  for (const status of ['processing', 'shipped', 'out_for_delivery', 'delivered']) {
    const email = orderEmail({
      id,
      status,
      items: [],
      item_total: 299,
      shipping_price: 0,
      order_total: 299,
    });
    assert.ok(email.subject.length);
    assert.doesNotMatch(email.text, /undefined/);
  }
});
