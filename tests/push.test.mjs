import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { announcementSchema, notificationPath, orderPush } from '../src/lib/push.ts';
import { handlePushDevice, hashInstallationSecret } from '../src/lib/push-device-handler.ts';
import { deliverPush } from '../src/lib/push-delivery.ts';

const customer = '11111111-1111-4111-8111-111111111111';
const installation = {
  id: '22222222-2222-4222-8222-222222222222',
  secret: 'a'.repeat(64),
  token: 'device-token-'.repeat(5),
  announcements: false,
};
test('push payloads require confirmation and restrict notification taps to storefront routes', () => {
  for (const path of ['/', '/shop', '/account', '/product/a-lipstick', '/more/privacy-policy'])
    assert.equal(notificationPath(path), path);
  for (const path of [
    '//evil.test',
    'https://evil.test',
    '/admin',
    '/api/push',
    '/shop?redirect=evil',
    '/product/../admin',
    '/product/foo%2fbar',
    '/account#anything',
    null,
  ])
    assert.equal(notificationPath(path), null);
  const input = {
    requestId: installation.id,
    title: 'New arrivals',
    body: 'Shop the latest.',
    path: '/shop',
    confirm: true,
  };
  assert.equal(announcementSchema.safeParse(input).success, true);
  for (const value of [
    { confirm: false },
    { body: '' },
    { title: 'x'.repeat(81) },
    { requestId: '' },
    { path: '/admin' },
  ])
    assert.equal(announcementSchema.safeParse({ ...input, ...value }).success, false);
  assert.equal(orderPush('shipped'), null, 'only supported order statuses have templates');
  assert.equal(orderPush('confirmed').path, '/account');
});

test('device registration validates the caller and requires installation proof for replacement or revocation', async () => {
  let existing = null;
  const writes = [];
  const db = {
    auth: {
      getUser: async (token) => ({
        data: { user: token === 'valid-jwt' ? { id: customer } : null },
        error: null,
      }),
    },
    from: (table) => {
      assert.equal(table, 'storefront_push_devices');
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }),
        }),
        upsert: async (row) => {
          writes.push(row);
          existing = { secret_hash: row.secret_hash };
          return { error: null };
        },
        delete: () => ({
          eq: (_, id) => ({
            eq: async (_, hash) => {
              assert.equal(id, installation.id);
              assert.equal(hash, existing.secret_hash);
              writes.push('deleted');
              return { error: null };
            },
          }),
        }),
      };
    },
  };
  const request = (method, body = installation, jwt = 'valid-jwt', origin = 'https://localhost') =>
    new Request('https://dacianastore.in/api/push/devices', {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}`, origin },
      body: method === 'OPTIONS' ? undefined : JSON.stringify(body),
    });
  const preflight = await handlePushDevice(request('OPTIONS'), db);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://localhost');
  assert.equal((await handlePushDevice(request('POST', installation, 'bad-jwt'), db)).status, 401);
  assert.equal(
    (await handlePushDevice(request('POST', installation, 'valid-jwt', 'https://evil.test'), db))
      .status,
    403,
  );
  assert.equal(
    (await handlePushDevice(request('POST', { ...installation, secret: 'guess' }), db)).status,
    400,
  );
  assert.equal(
    (await handlePushDevice(request('POST', { ...installation, user_id: 'victim' }), db)).status,
    200,
  );
  assert.equal(writes[0].user_id, customer, 'client cannot choose the recipient account');
  assert.equal(writes[0].secret_hash, hashInstallationSecret(installation.secret));
  assert.notEqual(writes[0].secret_hash, installation.secret);
  assert.equal(
    (await handlePushDevice(request('POST', { ...installation, secret: 'b'.repeat(64) }), db))
      .status,
    403,
  );
  assert.equal(
    (await handlePushDevice(request('DELETE', { ...installation, secret: 'b'.repeat(64) }, ''), db))
      .status,
    403,
  );
  assert.equal(
    (await handlePushDevice(request('DELETE', installation, ''), db)).status,
    200,
    'installation can revoke after logout',
  );
  assert.equal(writes.at(-1), 'deleted');
});

test('push tables deny direct customer reads and writes, cascade device cleanup and deduplicate events', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values('${customer}');`,
    );
    const sql = await readFile(new URL('../supabase/push-setup.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql);
    const rls = await db.query(
      "select relname,relrowsecurity from pg_class where relname in ('storefront_push_devices','storefront_push_deliveries')",
    );
    assert.equal(rls.rows.length, 2);
    assert.ok(rls.rows.every((row) => row.relrowsecurity));
    await db.exec('set role authenticated');
    await assert.rejects(
      db.query('select token from public.storefront_push_devices'),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "insert into public.storefront_push_deliveries(event_key,audience,title,body,path) values('x','announcements','Hi','Hello','/')",
      ),
      /permission denied/,
    );
    await db.exec('reset role; set role service_role');
    await db.query(
      'insert into public.storefront_push_devices(id,secret_hash,user_id,token) values($1,$2,$3,$4)',
      [installation.id, hashInstallationSecret(installation.secret), customer, installation.token],
    );
    await db.query(
      "insert into public.storefront_push_deliveries(event_key,created_by,audience,title,body,path) values('once',$1,'announcements','Hi','Hello','/')",
      [customer],
    );
    await assert.rejects(
      db.query(
        "insert into public.storefront_push_deliveries(event_key,audience,title,body,path) values('once','announcements','Hi','Hello','/')",
      ),
      /duplicate key/,
    );
    await db.exec(`reset role; delete from auth.users where id='${customer}'`);
    assert.equal(
      (await db.query('select count(*)::int n from public.storefront_push_devices')).rows[0].n,
      0,
    );
    assert.equal(
      (await db.query('select created_by from public.storefront_push_deliveries')).rows[0]
        .created_by,
      null,
    );
  } finally {
    await db.close();
  }
});

function deliveryFixture(devices) {
  const logs = [];
  const deletedTokens = [];
  const db = {
    from: (table) => {
      if (table === 'storefront_push_deliveries')
        return {
          insert: (input) => ({
            select: () => ({
              single: async () => {
                if (logs.some((log) => log.event_key === input.event_key))
                  return { error: { code: '23505' } };
                const log = { ...input, id: 'delivery-id' };
                logs.push(log);
                return { data: log, error: null };
              },
            }),
          }),
          update: (input) => ({
            eq: async () => {
              Object.assign(logs.at(-1), input);
              return { error: null };
            },
          }),
        };
      assert.equal(table, 'storefront_push_devices');
      let selected = devices;
      const query = {
        order() {
          selected = [...selected].sort((a, b) => a.id.localeCompare(b.id));
          return this;
        },
        limit() {
          return this;
        },
        eq(key, value) {
          selected = selected.filter((row) => row[key] === value);
          return this;
        },
        gt(key, value) {
          selected = selected.filter((row) => row[key] > value);
          return this;
        },
        then(resolve) {
          return Promise.resolve({ data: selected.slice(0, 500), error: null }).then(resolve);
        },
      };
      return {
        select: () => query,
        delete: () => ({
          in: async (_, tokens) => {
            deletedTokens.push(...tokens);
            return { error: null };
          },
        }),
      };
    },
  };
  return { db, logs, deletedTokens };
}
const draft = {
  eventKey: 'new-announcement',
  actorId: customer,
  audience: 'announcements',
  title: 'New arrivals',
  body: 'Have a look.',
  path: '/shop',
};
test('sending respects announcement opt-in, batches at 500, prunes only expired tokens and blocks duplicate retries', async () => {
  const devices = Array.from({ length: 502 }, (_, index) => ({
    id: String(index).padStart(5, '0'),
    token: `token-${index}`,
    announcements: index !== 501,
    user_id: customer,
  }));
  const fixture = deliveryFixture(devices);
  const batches = [];
  const messaging = {
    sendEachForMulticast: async (message) => {
      batches.push(message);
      const responses = message.tokens.map((token) =>
        token === 'token-0'
          ? { success: false, error: { code: 'messaging/registration-token-not-registered' } }
          : { success: true },
      );
      return {
        responses,
        successCount: responses.filter((row) => row.success).length,
        failureCount: responses.filter((row) => !row.success).length,
      };
    },
  };
  const result = await deliverPush(draft, fixture.db, messaging);
  assert.equal(result.sent, 500);
  assert.equal(result.failed, 1);
  assert.deepEqual(
    batches.map((batch) => batch.tokens.length),
    [500, 1],
  );
  assert.equal(batches[0].data.path, '/shop');
  assert.deepEqual(fixture.deletedTokens, ['token-0']);
  assert.equal(fixture.logs[0].status, 'partial');
  assert.ok((await deliverPush(draft, fixture.db, messaging)).error);
  assert.equal(batches.length, 2);
});
test('order updates target only the matching customer; empty audiences and FCM failures are recorded', async () => {
  const fixture = deliveryFixture([
    { id: '1', token: 'owner-token', user_id: customer, announcements: false },
    { id: '2', token: 'other-token', user_id: 'someone-else', announcements: true },
  ]);
  const batches = [];
  const messaging = {
    sendEachForMulticast: async (message) => {
      batches.push(message);
      return { successCount: 1, failureCount: 0, responses: [{ success: true }] };
    },
  };
  await deliverPush({ ...draft, audience: 'order', userId: customer }, fixture.db, messaging);
  assert.deepEqual(batches[0].tokens, ['owner-token']);
  assert.equal(batches[0].android.notification.channelId, 'orders');
  assert.ok(
    (
      await deliverPush(
        { ...draft, eventKey: 'no-customer', audience: 'order' },
        fixture.db,
        messaging,
      )
    ).error,
  );
  const empty = deliveryFixture([]);
  assert.equal((await deliverPush(draft, empty.db, messaging)).sent, 0);
  assert.equal(empty.logs[0].status, 'empty');
  const failed = deliveryFixture([{ id: '1', token: 'token', announcements: true }]);
  assert.ok(
    (
      await deliverPush(draft, failed.db, {
        sendEachForMulticast: async () => {
          throw Error('FCM unavailable');
        },
      })
    ).error,
  );
  assert.equal(failed.logs[0].status, 'failed');
});
