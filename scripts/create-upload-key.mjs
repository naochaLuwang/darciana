import { mkdir, writeFile, chmod } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomBytes, X509Certificate } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const directory = resolve(root, '.secrets/android');
const config = resolve(root, '.secrets/android-release.env');
const keystore = resolve(directory, 'daciana-upload.p12');
if (existsSync(config) || existsSync(keystore))
  throw new Error(
    'Upload signing files already exist. Reuse and back them up; this command never rotates or overwrites a key.',
  );
const java =
  process.env.DACIANA_JAVA_HOME || '/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home';
const keytool = resolve(java, 'bin/keytool');
if (!existsSync(keytool)) throw new Error('Set DACIANA_JAVA_HOME to a JDK with keytool.');
await mkdir(directory, { recursive: true, mode: 0o700 });
await chmod(resolve(root, '.secrets'), 0o700);
await chmod(directory, 0o700);
const password = randomBytes(32).toString('hex');
const credentials = {
  DACIANA_ANDROID_KEYSTORE: keystore,
  DACIANA_ANDROID_KEY_ALIAS: 'daciana-upload',
  DACIANA_ANDROID_STORE_PASSWORD: password,
  DACIANA_ANDROID_KEY_PASSWORD: password,
};
await writeFile(
  config,
  Object.entries(credentials)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join('\n') + '\n',
  { flag: 'wx', mode: 0o600 },
);
const env = { ...process.env, ...credentials };
execFileSync(
  keytool,
  [
    '-genkeypair',
    '-alias',
    credentials.DACIANA_ANDROID_KEY_ALIAS,
    '-keyalg',
    'RSA',
    '-keysize',
    '2048',
    '-sigalg',
    'SHA256withRSA',
    '-validity',
    '10000',
    '-storetype',
    'PKCS12',
    '-keystore',
    keystore,
    '-dname',
    'CN=Daciana Upload',
    '-storepass:env',
    'DACIANA_ANDROID_STORE_PASSWORD',
    '-keypass:env',
    'DACIANA_ANDROID_KEY_PASSWORD',
    '-noprompt',
  ],
  { env, stdio: 'pipe' },
);
await chmod(keystore, 0o600);
const certificate = execFileSync(
  keytool,
  [
    '-exportcert',
    '-rfc',
    '-alias',
    credentials.DACIANA_ANDROID_KEY_ALIAS,
    '-keystore',
    keystore,
    '-storepass:env',
    'DACIANA_ANDROID_STORE_PASSWORD',
  ],
  { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
);
await mkdir(resolve(root, 'artifacts/play-store'), { recursive: true });
await writeFile(resolve(root, 'artifacts/play-store/upload-certificate.pem'), certificate);
const x509 = new X509Certificate(certificate);
await writeFile(
  resolve(root, 'artifacts/play-store/upload-certificate.json'),
  JSON.stringify(
    {
      alias: credentials.DACIANA_ANDROID_KEY_ALIAS,
      sha1: x509.fingerprint,
      sha256: x509.fingerprint256,
      validFrom: x509.validFrom,
      validTo: x509.validTo,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Private upload keystore created. Passwords are only in .secrets/android-release.env. Public certificate exported to artifacts/play-store.',
);
