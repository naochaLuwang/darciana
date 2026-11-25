import { createPrivateKey } from 'node:crypto';
import { readFile, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const keyId = process.argv[2];
if (!/^[A-Z0-9]{10}$/.test(keyId ?? ''))
  throw new Error('Pass the 10-character Apple Sign in with Apple Key ID (not a private key).');
const key = await readFile(resolve(root, '.secrets/ios/apple-sign-in.p8'), 'utf8');
const signing = createPrivateKey(key);
if (signing.asymmetricKeyType !== 'ec' || signing.asymmetricKeyDetails?.namedCurve !== 'prime256v1')
  throw new Error('Use the P-256 Sign in with Apple .p8 downloaded from Apple Developer.');
const target = resolve(root, '.secrets/ios/apple-sign-in.env');
await writeFile(
  target,
  `APPLE_SIGN_IN_KEY_ID=${keyId}\nAPPLE_SIGN_IN_PRIVATE_KEY_BASE64=${Buffer.from(key).toString('base64')}\n`,
  { mode: 0o600 },
);
await chmod(target, 0o600);
console.log(
  'Prepared .secrets/ios/apple-sign-in.env for Supabase Edge Function secrets. Keep it private.',
);
