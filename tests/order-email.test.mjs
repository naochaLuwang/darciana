import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { handleOrderEmail } from '../src/lib/order-email-handler.ts';
import { orderEmail } from '../src/lib/order-email.ts';
import { sendResendEmail } from '../src/lib/resend.ts';
const customer = '11111111-1111-4111-8111-111111111111';
const orderId = '33333333-3333-4333-8333-333333333333';
const secret = 'a'.repeat(64);
const sql = async (name) => readFile(new URL(`../supabase/${name}`, import.meta.url), 'utf8');
const sample = () => ({
  id: orderId,
  user_id: customer,
  status: 'awaiting_confirmation',
  items: [
    { name: '<script>unsafe</script> & Cream', option: 'Rose', quantity: 2, unit_price: 299.5 },
  ],
  item_total: 600,
  shipping_price: 49.5,
  order_total: 649.5,
});
function fixture() {
  const state = {
    order: sample(),
    user: { id: customer, email: 'customer@example.com', email_confirmed_at: '2026-01-01' },
    logs: new Map(),
    sent: [],
    lookups: 0,
  };
  const db = {
    auth: {
      admin: {
        getUserById: async (id) => {
          assert.equal(id, customer);
          return { data: { user: state.user }, error: null };
        },
      },
    },
    from: (table) => {
      let input, update;
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          state.lookups++;
          return { data: state.order, error: null };
        },
        insert: (row) => {
          input = row;
          return q;
        },
        single: async () => {
          assert.equal(table, 'storefront_email_deliveries');
          if (state.logs.has(input.event_key)) return { data: null, error: { code: '23505' } };
          const row = { ...input, id: String(state.logs.size + 1), status: 'sending' };
          state.logs.set(input.event_key, row);
          return { data: { id: row.id }, error: null };
        },
        update: (values) => {
          update = values;
          return {
            eq: async (_, id) => {
              const row = [...state.logs.values()].find((row) => row.id === id);
              Object.assign(row, update);
              return { error: null };
            },
          };
        },
      };
      return q;
    },
  };
  return {
    state,
    deps: {
      db,
      secret,
      send: async (input) => {
        state.sent.push(input);
        return { id: 'provider-id' };
      },
    },
  };
}
const request = (body = { order_id: orderId, status: 'awaiting_confirmation' }, token = secret) =>
  new Request('https://store.test/api/email/order-update', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

test('order email trusts only the webhook, actual status and verified order owner, and permanently deduplicates', async () => {
  const { state, deps } = fixture();
  assert.equal((await handleOrderEmail(request(undefined, 'b'.repeat(64)), deps)).status, 401);
  assert.equal(state.lookups, 0);
  assert.equal(
    (
      await handleOrderEmail(
        request({ order_id: orderId, status: 'confirmed', to: 'victim@example.com' }),
        deps,
      )
    ).status,
    400,
  );
  assert.equal(
    (await handleOrderEmail(request({ order_id: orderId, status: 'confirmed' }), deps)).status,
    200,
  );
  assert.equal(state.sent.length, 0);
  assert.equal((await handleOrderEmail(request(), deps)).status, 200);
  assert.equal(state.sent[0].to, 'customer@example.com');
  assert.equal(state.sent[0].eventKey, `order-email/${orderId}/awaiting_confirmation`);
  assert.equal(state.logs.values().next().value.status, 'sent');
  assert.equal((await (await handleOrderEmail(request(), deps)).json()).duplicate, true);
  assert.equal(state.sent.length, 1);
  state.order.status = 'confirmed';
  await handleOrderEmail(request({ order_id: orderId, status: 'confirmed' }), deps);
  assert.equal(state.sent.length, 2);
  state.order = null;
  assert.equal((await handleOrderEmail(request(), deps)).status, 404);
});
test('unverified recipients are skipped and ambiguous provider failures are recorded without duplicate sends', async () => {
  const { state, deps } = fixture();
  state.user.email_confirmed_at = null;
  const result = await handleOrderEmail(request(), deps);
  assert.equal((await result.json()).skipped, 'no_verified_email');
  assert.equal(state.sent.length, 0);
  state.order.status = 'confirmed';
  state.user.email_confirmed_at = '2026-01-01';
  deps.send = async () => {
    state.sent.push('attempt');
    return { error: 'network_unknown' };
  };
  assert.equal(
    (await handleOrderEmail(request({ order_id: orderId, status: 'confirmed' }), deps)).status,
    503,
  );
  assert.equal(state.logs.get(`order-email/${orderId}/confirmed`).status, 'failed');
  await handleOrderEmail(request({ order_id: orderId, status: 'confirmed' }), deps);
  assert.equal(state.sent.length, 1);
});
test('Resend requests use the configured sender, stable idempotency key, escaped HTML and whole rupees', async () => {
  const body = orderEmail(sample());
  assert.match(body.html, /&lt;script&gt;unsafe&lt;\/script&gt; &amp; Cream/);
  assert.ok(!body.html.includes('<script>'));
  assert.match(body.text, /Total: ₹650/);
  assert.match(body.text, /Delivery: ₹50/);
  assert.match(body.text, /× 2 · ₹600/);
  const historical = orderEmail({ ...sample(), shipping_price: null, order_total: null });
  assert.match(historical.text, /Delivery: To be confirmed/);
  assert.match(historical.text, /Items total: ₹600/);
  const email = {
    ...body,
    to: 'customer@example.com',
    eventKey: `order-email/${orderId}/awaiting_confirmation`,
  };
  const config = {
    key: 're_test_key',
    from: 'Daciana <noreply@dacianastore.in>',
    replyTo: 'luwangtech0@gmail.com',
  };
  const result = await sendResendEmail(email, config, async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    assert.equal(options.headers['Idempotency-Key'], email.eventKey);
    const payload = JSON.parse(options.body);
    assert.equal(payload.from, config.from);
    assert.equal(payload.reply_to, config.replyTo);
    assert.deepEqual(payload.to, [email.to]);
    return Response.json({ id: 'accepted' });
  });
  assert.equal(result.id, 'accepted');
  assert.equal(
    (
      await sendResendEmail(email, config, async () =>
        Response.json({ error: 'rejected' }, { status: 403 }),
      )
    ).error,
    'provider_rejected',
  );
  assert.equal(
    (
      await sendResendEmail(email, config, async () => {
        throw Error('timeout');
      })
    ).error,
    'network_unknown',
  );
});
test('email SQL protects history and schedules only future inserts or changed statuses without blocking orders', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role service_role bypassrls');
    await initializeStoreDatabase(db, customer);
    const insert = () =>
      db.query(
        "insert into public.storefront_order_requests(user_id,request_key,items,item_total,shipping) values($1,gen_random_uuid(),'[]',100,'{}') returning id",
        [customer],
      );
    await insert();
    await db.exec(await sql('order-email-setup.sql'));
    await db.exec(await sql('order-email-setup.sql'));
    await db.exec(`create schema net;create schema vault;
      create table vault.decrypted_secrets(name text,decrypted_secret text);
      create table net.requests(id bigserial primary key,url text,headers jsonb,body jsonb);
      create function net.http_post(url text,body jsonb default '{}',params jsonb default '{}',headers jsonb default '{}',timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$ declare request_id bigint; begin
        if current_setting('test.transport_fail',true)='yes' then raise exception 'transport down';end if;
        insert into net.requests(url,headers,body) values(url,headers,body) returning id into request_id;return request_id;end $$;`);
    const hook = (await sql('order-email-webhook-setup.sql')).replace(
      /^create extension[^\n]*\n/gm,
      '',
    );
    await db.exec(hook);
    assert.equal((await db.query('select * from net.requests')).rows.length, 0);
    await db.query('insert into vault.decrypted_secrets values($1,$2)', [
      'daciana_order_push_secret',
      secret,
    ]);
    const id = (await insert()).rows[0].id;
    let requests = (await db.query('select * from net.requests')).rows;
    assert.deepEqual(requests[0].body, { order_id: id, status: 'awaiting_confirmation' });
    assert.equal(requests[0].url, 'https://dacianastore.in/api/email/order-update');
    assert.equal(requests[0].headers.Authorization, `Bearer ${secret}`);
    await db.exec(hook);
    await db.query(
      "update public.storefront_order_requests set status='awaiting_confirmation' where id=$1",
      [id],
    );
    assert.equal((await db.query('select * from net.requests')).rows.length, 1);
    await db.query("update public.storefront_order_requests set status='confirmed' where id=$1", [
      id,
    ]);
    requests = (await db.query('select * from net.requests')).rows;
    assert.equal(requests.length, 2);
    assert.equal(requests[1].body.status, 'confirmed');
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select * from public.storefront_email_deliveries'),
      /permission denied/,
    );
    await assert.rejects(
      db.query('select private.storefront_notify_order_email()'),
      /permission denied/,
    );
    await db.exec('reset role;set role service_role');
    await db.query(
      'insert into public.storefront_email_deliveries(event_key,order_id,order_status) values($1,$2,$3)',
      ['event', id, 'confirmed'],
    );
    await assert.rejects(
      db.query(
        'insert into public.storefront_email_deliveries(event_key,order_id,order_status) values($1,$2,$3)',
        ['event', id, 'confirmed'],
      ),
      /duplicate key/,
    );
    await db.exec("reset role;select set_config('test.transport_fail','yes',false)");
    await db.query("update public.storefront_order_requests set status='completed' where id=$1", [
      id,
    ]);
    assert.equal(
      (await db.query('select status from public.storefront_order_requests where id=$1', [id]))
        .rows[0].status,
      'completed',
    );
    await db.query('delete from auth.users where id=$1', [customer]);
    assert.equal(
      (await db.query('select order_id from public.storefront_email_deliveries')).rows[0].order_id,
      null,
    );
  } finally {
    await db.close();
  }
});
