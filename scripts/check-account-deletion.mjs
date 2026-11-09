import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
const local = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const base = process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!base || !key) throw new Error('Set the public Supabase URL and publishable key.');

// Read-only smoke check. No account is created, signed in, revoked or deleted.
const endpoint = new URL('/functions/v1/delete-account', base);
try {
  const preflight = await fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://localhost',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-client-info',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (preflight.status === 404)
    throw new Error('delete-account is not deployed. Deploy supabase/functions/delete-account.');
  const origin = preflight.headers.get('access-control-allow-origin');
  const allowed = preflight.headers.get('access-control-allow-headers')?.toLowerCase() || '';
  if (
    !preflight.ok ||
    !['*', 'https://localhost'].includes(origin) ||
    !['authorization', 'apikey', 'content-type', 'x-client-info'].every((value) =>
      allowed.split(',').some((header) => header.trim() === value),
    )
  )
    throw new Error(`Native app CORS preflight failed (HTTP ${preflight.status}).`);
  console.log('PASS delete-account is deployed and accepts the Android app CORS preflight.');

  const unauthenticated = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json', Origin: 'https://localhost' },
    body: JSON.stringify({ confirmation: 'DELETE' }),
    signal: AbortSignal.timeout(15000),
  });
  if (![401, 403].includes(unauthenticated.status))
    throw new Error(`Expected unsigned deletion to be rejected (HTTP ${unauthenticated.status}).`);
  console.log('PASS unauthenticated account deletion is rejected.');
  console.log('Authenticated deletion and data removal still require a disposable customer test.');
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exitCode = 1;
}
