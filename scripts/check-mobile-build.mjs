import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = resolve(root, 'mobile/dist');
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}
await walk(dist);
const env = existsSync(resolve(root, '.env.local'))
  ? parseEnv(await readFile(resolve(root, '.env.local'), 'utf8'))
  : {};
const secrets = ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY']
  .map((key) => process.env[key] || env[key])
  .filter(Boolean);
const scripts = files.filter((file) => file.endsWith('.js'));
assert.ok(scripts.length > 0, 'No mobile JavaScript was generated.');
for (const file of scripts) {
  const code = await readFile(file, 'utf8');
  assert.ok(
    !secrets.some((secret) => code.includes(secret)),
    'A server secret was found in mobile assets.',
  );
  assert.ok(
    !/sb_secret_[A-Za-z0-9_-]{15,}/.test(code),
    'A secret API key was found in mobile assets.',
  );
  assert.ok(
    !/SUPABASE_SECRET_KEY|next\/headers|next\/cache|next\/server/.test(code),
    'Server-only code was found in mobile assets.',
  );
}
assert.ok(
  !files.some((file) => file.endsWith('.map')),
  'Production source maps must not ship in the app.',
);
const index = await readFile(resolve(dist, 'index.html'), 'utf8');
assert.ok(
  index.includes('viewport-fit=cover') && index.includes('id="root"'),
  'Mobile document is missing its app root or device viewport.',
);
const config = await readFile(resolve(root, 'capacitor.config.ts'), 'utf8');
assert.ok(
  !/\burl\s*:/.test(config),
  'The production app must bundle its UI rather than load a remote server URL.',
);
console.log(
  `Mobile bundle verified: ${scripts.length} JavaScript files, local app assets, no server keys or Next.js server runtime.`,
);
