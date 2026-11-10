import test from 'node:test';
import assert from 'node:assert/strict';
import {
  requestPasswordReset,
  applyNewPassword,
  recoveryGrant,
  readRecoveryGrant,
} from '../src/lib/password-recovery.ts';
const userId = '11111111-1111-4111-8111-111111111111';
test('password recovery uses a validated address, generic confirmation and the fixed caller callback', async () => {
  const calls = [];
  const db = {
    auth: {
      resetPasswordForEmail: async (...args) => {
        calls.push(args);
        return { error: null };
      },
    },
  };
  assert.ok((await requestPasswordReset(db, 'invalid', 'https://store.test/auth/callback')).error);
  assert.equal(calls.length, 0);
  assert.equal(
    (await requestPasswordReset(db, ' customer@example.com ', 'https://store.test/auth/callback'))
      .message,
    'If an account exists, we’ll email a reset link. Open it on this device.',
  );
  assert.deepEqual(calls, [
    ['customer@example.com', { redirectTo: 'https://store.test/auth/callback' }],
  ]);
  assert.ok(
    (await requestPasswordReset(null, 'customer@example.com', 'https://store.test/auth/callback'))
      .error,
  );
});
test('new passwords require a live recovery grant for the verified caller and matching strong passwords', async () => {
  const writes = [];
  let id = userId;
  const db = {
    auth: {
      getUser: async () => ({ data: { user: { id } }, error: null }),
      updateUser: async (input) => {
        writes.push(input);
        return { error: null };
      },
    },
  };
  const value = {
    password: 'new-test-password',
    confirmation: 'new-test-password',
    user_id: 'victim',
  };
  assert.equal(readRecoveryGrant(recoveryGrant(userId)), userId);
  assert.equal(readRecoveryGrant(JSON.stringify({ userId, expires: Date.now() - 1 })), null);
  assert.equal(readRecoveryGrant('bad'), null);
  assert.ok((await applyNewPassword(db, value, null)).error);
  assert.ok(
    (await applyNewPassword(db, { password: 'short', confirmation: 'short' }, userId)).error,
  );
  assert.ok((await applyNewPassword(db, { ...value, confirmation: 'different' }, userId)).error);
  id = '22222222-2222-4222-8222-222222222222';
  assert.ok((await applyNewPassword(db, value, userId)).error);
  assert.equal(writes.length, 0);
  id = userId;
  assert.equal((await applyNewPassword(db, value, userId)).updated, true);
  assert.deepEqual(writes, [{ password: 'new-test-password' }]);
});
