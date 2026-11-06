import test from 'node:test';
import assert from 'node:assert/strict';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.mjs';

test('native deletion supports CORS and requires a verified, recent OAuth login for the caller', async () => {
  const deleted = [];
  const now = Math.floor(Date.now() / 1000);
  let claims = { sub: 'caller', amr: [{ method: 'oauth', timestamp: now }] };
  let claimsError = null;
  let user = { id: 'caller', email: 'caller@example.com', app_metadata: { provider: 'google' } };
  const handler = createDeleteAccountHandler({
    url: 'http://fixture',
    publicKey: 'public',
    secretKey: 'private',
    createClient: (_url, key) =>
      key === 'public'
        ? {
            auth: {
              getUser: async () => ({ data: { user }, error: null }),
              getClaims: async (jwt) => {
                assert.equal(jwt, 'verified-user-token');
                return { data: { claims }, error: claimsError };
              },
              signInWithPassword: async () => {
                throw new Error('OAuth must not use a fake password');
              },
            },
          }
        : {
            auth: {
              admin: {
                signOut: async () => ({ error: null }),
                deleteUser: async (id) => {
                  deleted.push(id);
                  return { error: null };
                },
              },
            },
          },
  });
  const send = (extra = {}) =>
    handler(
      new Request('http://fixture/delete-account', {
        method: 'POST',
        headers: { authorization: 'Bearer verified-user-token', origin: 'https://localhost' },
        body: JSON.stringify({
          confirmation: 'DELETE',
          reauthentication: 'google',
          user_id: 'victim',
          ...extra,
        }),
      }),
    );
  const preflight = await handler(
    new Request('http://fixture/delete-account', { method: 'OPTIONS' }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.equal((await send({ confirmation: '' })).status, 400);
  claims = { sub: 'victim', amr: [{ method: 'oauth', timestamp: now }] };
  assert.equal((await send()).status, 400);
  claims = { sub: 'caller', amr: [{ method: 'oauth', timestamp: now - 301 }] };
  assert.equal((await send()).status, 400);
  claims = { sub: 'caller', iat: now, amr: [{ method: 'token_refresh', timestamp: now }] };
  assert.equal((await send()).status, 400, 'refreshing an old session is not reauthentication');
  claims = { sub: 'caller', amr: [{ method: 'oauth', timestamp: now + 120 }] };
  assert.equal((await send()).status, 400);
  claims = { sub: 'caller', amr: [{ method: 'oauth', timestamp: now }] };
  claimsError = { message: 'Signature invalid' };
  assert.equal((await send()).status, 400);
  claimsError = null;
  user = { ...user, app_metadata: { provider: 'email' }, user_metadata: { provider: 'google' } };
  assert.equal((await send()).status, 400, 'editable user metadata grants no authority');
  assert.deepEqual(deleted, []);
  user = { ...user, app_metadata: { providers: ['google'] } };
  assert.equal((await send()).status, 200);
  assert.deepEqual(deleted, ['caller']);
});
