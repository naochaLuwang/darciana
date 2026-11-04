import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initializeStoreDatabase } from './fixtures/database.mjs';
import { customerProfileSchema } from '../src/lib/checkout.ts';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.mjs';

test('profile validation requires a name and valid phone without requiring an address', () => {
  assert.equal(
    customerProfileSchema.safeParse({ name: 'Test Customer', phone: '9876543210' }).success,
    true,
  );
  assert.equal(customerProfileSchema.safeParse({ name: 'T', phone: '123' }).success, false);
});

test('profile and address book SQL preserves old addresses, isolates customers and archives checkout addresses', async () => {
  const db = new PGlite();
  const customer = '11111111-1111-4111-8111-111111111111';
  const owner = '22222222-2222-4222-8222-222222222222';
  const address = {
    name: 'Test Customer',
    phone: '9876543210',
    address: '12 Garden Street',
    city: 'Imphal',
    state: 'Manipur',
    pincode: '795001',
    shipping_area_id: null,
  };
  const login = async (id, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${role}`);
  };
  const save = (value) =>
    db.query('select public.storefront_save_address($1::jsonb) as id', [JSON.stringify(value)]);
  try {
    await initializeStoreDatabase(db, customer, owner);
    for (const file of ['shipping-setup.sql', 'address-setup.sql'])
      await db.exec(await readFile(new URL(`../supabase/${file}`, import.meta.url), 'utf8'));
    await login(customer);
    await db.query(
      'insert into public.storefront_saved_addresses(user_id,name,phone,address,city,state,pincode) values($1,$2,$3,$4,$5,$6,$7)',
      [
        customer,
        address.name,
        address.phone,
        address.address,
        address.city,
        address.state,
        address.pincode,
      ],
    );
    await db.exec('reset role');
    await db.exec(
      await readFile(new URL('../supabase/profile-setup.sql', import.meta.url), 'utf8'),
    );
    await login(customer);
    assert.equal(
      (await db.query('select * from public.storefront_delivery_addresses')).rows.length,
      1,
    );
    assert.equal(
      (await db.query('select * from public.storefront_customer_profiles')).rows.length,
      0,
    );
    await db.query(
      'insert into public.storefront_customer_profiles(user_id,name,phone) values($1,$2,$3)',
      [customer, 'My Profile', '9876543210'],
    );
    await assert.rejects(
      () => db.query('update public.storefront_customer_profiles set user_id=$1', [owner]),
      /row-level security/,
    );
    const first = (await save({ ...address, address: '36 Market Road' })).rows[0].id;
    assert.equal(
      (await save({ ...address, address: '36 Market Road' })).rows[0].id,
      first,
      'duplicate retries reuse an address',
    );
    await save({ ...address, id: first, address: '38 Market Road' });
    assert.equal(
      (await db.query('select * from public.storefront_delivery_addresses')).rows.length,
      2,
      'editing does not add a duplicate',
    );
    await db.query(
      "update public.storefront_saved_addresses set address='72 School Street' where user_id=$1",
      [customer],
    );
    assert.equal(
      (await db.query('select * from public.storefront_delivery_addresses')).rows.length,
      3,
      'checkout/current-address writes retain previous addresses',
    );
    await assert.rejects(
      () => db.query('delete from public.storefront_delivery_addresses'),
      /permission denied/,
    );
    await login(owner);
    assert.equal(
      (await db.query('select * from public.storefront_customer_profiles')).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select * from public.storefront_delivery_addresses')).rows.length,
      0,
    );
    await assert.rejects(() => save({ ...address, id: first }), /NOT_FOUND/);
    const own = (await save({ ...address, name: 'Owner' })).rows[0].id;
    await login('', 'anon');
    await assert.rejects(
      () => db.query('select * from public.storefront_customer_profiles'),
      /permission denied/,
    );
    await assert.rejects(() => save(address), /permission denied/);
    await db.exec('reset role');
    await db.query('delete from auth.users where id=$1', [customer]);
    assert.equal(
      (
        await db.query('select * from public.storefront_delivery_addresses where user_id=$1', [
          customer,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query('select * from public.storefront_customer_profiles where user_id=$1', [
          customer,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query('select * from public.storefront_delivery_addresses where id=$1', [own])).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});

test('account deletion verifies the caller and password, revokes sessions, and ignores supplied target IDs', async () => {
  const deleted = [];
  const calls = [];
  let authenticated = true;
  let passwordOK = true;
  let revokeOK = true;
  let deleteOK = true;
  const user = { id: 'own-user', email: 'customer@example.com' };
  const handler = createDeleteAccountHandler({
    url: 'http://fixture',
    publicKey: 'public',
    secretKey: 'secret',
    createClient: (_url, key) =>
      key === 'public'
        ? {
            auth: {
              getUser: async () => ({
                data: { user: authenticated ? user : null },
                error: authenticated ? null : { message: 'invalid' },
              }),
              signInWithPassword: async ({ email, password }) => {
                assert.equal(email, user.email);
                assert.equal(password, 'test-password');
                return { data: { user }, error: passwordOK ? null : { message: 'invalid' } };
              },
            },
          }
        : {
            auth: {
              admin: {
                signOut: async (token, scope) => {
                  assert.equal(token, 'user-token');
                  assert.equal(scope, 'global');
                  calls.push('sign-out');
                  return { error: revokeOK ? null : { message: 'failed' } };
                },
                deleteUser: async (id) => {
                  calls.push('delete');
                  if (deleteOK) deleted.push(id);
                  return { error: deleteOK ? null : { message: 'failed' } };
                },
              },
            },
          },
  });
  const request = (
    body = { confirmation: 'DELETE', password: 'test-password', user_id: 'someone-else' },
    token = 'user-token',
  ) =>
    handler(
      new Request('http://fixture/delete', {
        method: 'POST',
        headers: token ? { authorization: `Bearer ${token}` } : {},
        body: JSON.stringify(body),
      }),
    );
  assert.equal((await request(undefined, '')).status, 401);
  authenticated = false;
  assert.equal((await request()).status, 401);
  authenticated = true;
  assert.equal((await request({ password: 'test-password' })).status, 400);
  passwordOK = false;
  assert.equal((await request()).status, 400);
  passwordOK = true;
  assert.equal(deleted.length, 0);
  revokeOK = false;
  assert.equal((await request()).status, 503);
  revokeOK = true;
  assert.equal(deleted.length, 0);
  deleteOK = false;
  assert.equal((await request()).status, 500);
  deleteOK = true;
  const response = await request();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true });
  assert.deepEqual(deleted, ['own-user']);
  assert.deepEqual(calls.slice(-2), ['sign-out', 'delete']);
});
