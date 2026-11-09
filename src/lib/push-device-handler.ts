import { createHash, timingSafeEqual } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { installationSchema, registrationSchema, pushError } from './push.ts';

export const hashInstallationSecret = (secret: string) =>
  createHash('sha256').update(secret).digest('hex');
const validSecret = (secret: string, hash: string) => {
  const expected = Buffer.from(hashInstallationSecret(secret));
  const actual = Buffer.from(hash);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};
export async function handlePushDevice(request: Request, db: SupabaseClient | null) {
  const origin = request.headers.get('origin');
  const allowed = ['https://localhost', 'capacitor://localhost', 'https://dacianastore.in'];
  if (process.env.NODE_ENV !== 'production')
    allowed.push('http://127.0.0.1:5173', 'http://localhost:5173');
  const headers: Record<string, string> = { 'Cache-Control': 'no-store', Vary: 'Origin' };
  if (origin && allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Methods'] = 'POST, DELETE, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
  }
  const reply = (body: object, status = 200) => Response.json(body, { status, headers });
  if (origin && !allowed.includes(origin)) return reply({ error: 'Origin not allowed.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (!['POST', 'DELETE'].includes(request.method))
    return reply({ error: 'Method not allowed.' }, 405);
  if (!db) return reply({ error: 'Notification server is not configured.' }, 503);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ error: 'JSON required.' }, 415);
  const text = await request.text();
  if (text.length > 6500) return reply({ error: 'Request is too large.' }, 413);
  let input: unknown;
  try {
    input = JSON.parse(text);
  } catch {
    return reply({ error: 'Invalid JSON.' }, 400);
  }
  const parsed = (request.method === 'POST' ? registrationSchema : installationSchema).safeParse(
    input,
  );
  if (!parsed.success) return reply({ error: 'Invalid device registration.' }, 400);
  let userId: string | undefined;
  if (request.method === 'POST') {
    const accessToken = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    if (!accessToken || accessToken.length > 8192)
      return reply({ error: 'Sign in to enable notifications.' }, 401);
    const { data, error } = await db.auth.getUser(accessToken);
    if (error || !data.user) return reply({ error: 'Sign in to enable notifications.' }, 401);
    userId = data.user.id;
  }
  const { id, secret } = parsed.data;
  const { data: existing, error } = await db
    .from('storefront_push_devices')
    .select('secret_hash')
    .eq('id', id)
    .maybeSingle();
  if (error) return reply({ error: pushError(error) }, 503);
  if (existing && !validSecret(secret, existing.secret_hash))
    return reply({ error: 'Device verification failed.' }, 403);
  if (request.method === 'DELETE') {
    // The installation capability allows revocation even after the session expires.
    if (existing) {
      const result = await db
        .from('storefront_push_devices')
        .delete()
        .eq('id', id)
        .eq('secret_hash', hashInstallationSecret(secret));
      if (result.error) return reply({ error: pushError(result.error) }, 503);
    }
    return reply({ removed: true });
  }
  const registration = registrationSchema.parse(input);
  const result = await db.from('storefront_push_devices').upsert(
    {
      id,
      secret_hash: hashInstallationSecret(secret),
      user_id: userId,
      token: registration.token,
      announcements: registration.announcements,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (result.error) return reply({ error: pushError(result.error) }, 503);
  return reply({ registered: true });
}
