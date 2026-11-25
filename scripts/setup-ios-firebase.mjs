import { readFile, writeFile, chmod } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { cert } from 'firebase-admin/app';

const project = 'daciana-store';
const bundleId = 'com.luwangtech.daciana';
const account = JSON.parse(
  await readFile(new URL('../.secrets/firebase-service-account.json', import.meta.url), 'utf8'),
);
if (account.project_id !== project)
  throw new Error('Use the existing Daciana Firebase project credentials.');
const token = await cert(account).getAccessToken();
async function api(path, body) {
  const response = await fetch(`https://firebase.googleapis.com/v1beta1/${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Firebase configuration request failed (HTTP ${response.status}).`);
  return response.json();
}
const collection = `projects/${project}/iosApps`;
let app = (await api(collection)).apps?.find((item) => item.bundleId === bundleId);
if (!app) {
  let operation = await api(collection, { bundleId, displayName: 'Daciana iOS' });
  for (let attempt = 0; !operation.done && attempt < 25; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    operation = await api(operation.name);
  }
  if (!operation.done || operation.error)
    throw new Error('Firebase iOS registration has not completed. Check Firebase console.');
  app = operation.response;
  console.log('Registered Daciana iOS in the existing Firebase project.');
}
if (app.bundleId !== bundleId || !app.name) throw new Error('Unexpected Firebase iOS app.');
const config = await api(`${app.name}/config`);
const data = Buffer.from(config.configFileContents, 'base64');
const field = (name) =>
  execFileSync('plutil', ['-extract', name, 'raw', '-o', '-', '-'], {
    input: data,
    encoding: 'utf8',
  }).trim();
if (field('PROJECT_ID') !== project || field('BUNDLE_ID') !== bundleId)
  throw new Error('Firebase client configuration does not match Daciana.');
const output = new URL('../ios/App/App/GoogleService-Info.plist', import.meta.url);
await writeFile(output, data, { mode: 0o600 });
await chmod(output, 0o600);
console.log(
  'Saved verified ios/App/App/GoogleService-Info.plist. APNs key setup and device testing are still required.',
);
