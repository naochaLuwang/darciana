import { existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { NATIVE_AUTH_REDIRECT } from '../src/lib/brand.ts';

const envPath = fileURLToPath(new URL('../.env.local', import.meta.url));
const local = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || local.NEXT_PUBLIC_SUPABASE_URL;
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || local.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!projectUrl || !publicKey) throw new Error('Set the public Supabase URL and publishable key.');

// An intentionally invalid link exercises Supabase's redirect allowlist without
// signing in, sending mail, consuming a real confirmation link or changing a user.
const callbacks = ['https://dacianastore.in/auth/callback', NATIVE_AUTH_REDIRECT];
let failed = false;
for (const callback of callbacks) {
  try {
    const url = new URL('/auth/v1/verify', projectUrl);
    url.searchParams.set('type', 'signup');
    url.searchParams.set('token', `redirect-diagnostic-invalid-${randomUUID()}`);
    url.searchParams.set('redirect_to', callback);
    const response = await fetch(url, {
      headers: { apikey: publicKey },
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const location = response.headers.get('location');
    const destination = location ? new URL(location) : null;
    const expected = new URL(callback);
    const accepted =
      [302, 303, 307, 308].includes(response.status) &&
      destination?.protocol === expected.protocol &&
      destination?.host === expected.host &&
      destination?.pathname === expected.pathname;
    const returned = destination
      ? `${destination.protocol}//${destination.host}${destination.pathname}`
      : `HTTP ${response.status}, no redirect`;
    console.log(`${accepted ? 'PASS' : 'FAIL'} ${callback} → ${returned}`);
    if (!accepted) failed = true;
  } catch {
    console.error(
      `Could not check ${callback}. Check your connection and public project settings.`,
    );
    failed = true;
  }
}
if (failed) {
  console.error(
    '\nIn Supabase Auth → URL Configuration, set Site URL to https://dacianastore.in and add both callback URLs above. Then rerun this command.',
  );
  process.exitCode = 1;
}
