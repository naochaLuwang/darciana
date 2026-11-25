import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppleRevocation } from '../supabase/functions/delete-account/apple.mjs';
import { createDeleteAccountHandler } from '../supabase/functions/delete-account/handler.mjs';

const encode = (value) => Buffer.from(value).toString('base64url');
const rsa = await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
);
const ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
]);
const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(await crypto.subtle.exportKey('pkcs8', ec.privateKey)).toString('base64')}\n-----END PRIVATE KEY-----`;
const jwk = {
  ...(await crypto.subtle.exportKey('jwk', rsa.publicKey)),
  kid: 'fixture-apple',
  alg: 'RS256',
  use: 'sig',
};
const nonce = 'a'.repeat(64);
const nonceHash = Buffer.from(
  await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce)),
).toString('hex');
const now = Math.floor(Date.now() / 1000);
const standard = {
  iss: 'https://appleid.apple.com',
  aud: 'com.luwangtech.daciana',
  sub: 'apple-caller',
  nonce: nonceHash,
  iat: now,
  exp: now + 300,
};
async function token(overrides = {}) {
  const unsigned = `${encode(JSON.stringify({ alg: 'RS256', kid: jwk.kid }))}.${encode(JSON.stringify({ ...standard, ...overrides }))}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    rsa.privateKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${encode(signature)}`;
}

test('Apple deletion verifies signature, audience, nonce, identity and freshness before exchanging any code', async () => {
  const requests = [];
  const revoke = createAppleRevocation({
    keyId: 'KEY1234567',
    privateKey,
    fetcher: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
      if (url.endsWith('/token')) {
        const body = options.body;
        assert.equal(body.get('client_id'), standard.aud);
        assert.equal(body.get('grant_type'), 'authorization_code');
        assert.equal(body.get('code'), 'single-use-code');
        assert.equal(body.has('redirect_uri'), false, 'native authorization has no web redirect');
        const jwt = body.get('client_secret').split('.');
        const claims = JSON.parse(Buffer.from(jwt[1], 'base64url'));
        assert.equal(claims.iss, 'VJ6CZ336M8');
        assert.equal(claims.sub, standard.aud);
        assert.ok(claims.exp - claims.iat <= 300);
        assert.equal(
          await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            ec.publicKey,
            Buffer.from(jwt[2], 'base64url'),
            new TextEncoder().encode(`${jwt[0]}.${jwt[1]}`),
          ),
          true,
        );
        return Response.json({ refresh_token: 'private-refresh', id_token: await token() });
      }
      assert.equal(url, 'https://appleid.apple.com/auth/revoke');
      assert.equal(options.body.get('token'), 'private-refresh');
      assert.equal(options.body.get('token_type_hint'), 'refresh_token');
      return new Response(null, { status: 200 });
    },
  });
  const proof = {
    identityToken: await token(),
    nonce,
    authorizationCode: 'single-use-code',
    subject: 'apple-caller',
  };
  for (const override of [
    { aud: 'another-app' },
    { iss: 'https://attacker.example' },
    { sub: 'another-user' },
    { nonce: 'wrong' },
    { iat: now - 301 },
    { iat: now + 120 },
    { exp: now - 1 },
  ]) {
    await assert.rejects(revoke({ ...proof, identityToken: await token(override) }));
  }
  const tampered = proof.identityToken.split('.');
  tampered[1] = encode(JSON.stringify({ ...standard, sub: 'forged' }));
  await assert.rejects(revoke({ ...proof, identityToken: tampered.join('.') }));
  assert.ok(
    requests.every((request) => request.url.endsWith('/keys')),
    'invalid proofs never exchange/revoke',
  );
  requests.length = 0;
  await revoke(proof);
  assert.deepEqual(
    requests.map((r) => r.url),
    [
      'https://appleid.apple.com/auth/keys',
      'https://appleid.apple.com/auth/token',
      'https://appleid.apple.com/auth/revoke',
    ],
  );
});

test('Apple code exchange/revocation failure does not report success', async () => {
  const proof = {
    identityToken: await token(),
    nonce,
    authorizationCode: 'used-code',
    subject: 'apple-caller',
  };
  for (const failure of ['used-code', 'wrong-code-owner', 'revoke']) {
    const requests = [];
    const revoke = createAppleRevocation({
      keyId: 'KEY1234567',
      privateKey,
      fetcher: async (url) => {
        requests.push(url);
        if (url.endsWith('/keys')) return Response.json({ keys: [jwk] });
        if (url.endsWith('/token'))
          return failure === 'used-code'
            ? Response.json({ error: 'invalid_grant' }, { status: 400 })
            : Response.json({
                refresh_token: 'private-refresh',
                id_token: await token(
                  failure === 'wrong-code-owner' ? { sub: 'another-user' } : {},
                ),
              });
        return new Response(null, { status: 503 });
      },
    });
    await assert.rejects(revoke(proof));
    if (failure !== 'revoke')
      assert.equal(
        requests.some((url) => url.endsWith('/revoke')),
        false,
      );
  }
});

test('Apple-linked accounts require Apple revocation before session revocation and deletion', async () => {
  const events = [];
  let proofError = false;
  let available = true;
  const options = {
    url: 'http://fixture',
    publicKey: 'public',
    secretKey: 'secret',
    revokeApple: async (proof) => {
      assert.equal(
        proof.subject,
        'apple-caller',
        'identity comes from verified user, never request',
      );
      if (proofError) throw new Error('Wrong Apple account');
      events.push('apple-revoked');
    },
    createClient: (_url, key) =>
      key === 'public'
        ? {
            auth: {
              getUser: async () => ({
                data: {
                  user: {
                    id: 'caller',
                    email: 'relay@privaterelay.appleid.com',
                    app_metadata: { providers: ['apple', 'email'] },
                    identities: [{ provider: 'apple', identity_data: { sub: 'apple-caller' } }],
                  },
                },
              }),
              signInWithPassword: async () => {
                throw new Error('Password must not bypass Apple revocation');
              },
            },
          }
        : {
            auth: {
              admin: {
                signOut: async () => {
                  events.push('sessions-revoked');
                  return { error: null };
                },
                deleteUser: async (id) => {
                  assert.equal(id, 'caller');
                  events.push('deleted');
                  return { error: null };
                },
              },
            },
          },
  };
  const send = (extra = {}) =>
    createDeleteAccountHandler({ ...options, revokeApple: available ? options.revokeApple : null })(
      new Request('http://fixture/delete-account', {
        method: 'POST',
        headers: { authorization: 'Bearer caller-token' },
        body: JSON.stringify({
          confirmation: 'DELETE',
          reauthentication: 'apple',
          identityToken: awaitableToken,
          authorizationCode: 'new-code',
          nonce,
          subject: 'attacker',
          userId: 'victim',
          ...extra,
        }),
      }),
    );
  const awaitableToken = await token();
  assert.equal(
    (await send({ reauthentication: 'password', password: 'valid-password' })).status,
    400,
  );
  assert.equal((await send({ nonce: '' })).status, 400);
  available = false;
  assert.equal((await send()).status, 503);
  available = true;
  proofError = true;
  assert.equal((await send()).status, 400);
  assert.deepEqual(events, []);
  proofError = false;
  assert.equal((await send()).status, 200);
  assert.deepEqual(events, ['apple-revoked', 'sessions-revoked', 'deleted']);
});
