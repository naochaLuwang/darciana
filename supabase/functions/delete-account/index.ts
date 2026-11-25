import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { createDeleteAccountHandler } from './handler.mjs';
import { createAppleRevocation } from './apple.mjs';

function injectedKey(name: string, legacy: string) {
  try {
    return JSON.parse(Deno.env.get(name) ?? '{}').default ?? Deno.env.get(legacy);
  } catch {
    return Deno.env.get(legacy);
  }
}
function applePrivateKey() {
  try {
    const value = Deno.env.get('APPLE_SIGN_IN_PRIVATE_KEY_BASE64');
    return value ? atob(value) : undefined;
  } catch {
    return undefined;
  }
}
Deno.serve(
  createDeleteAccountHandler({
    createClient,
    url: Deno.env.get('SUPABASE_URL'),
    publicKey: injectedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
    secretKey: injectedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
    revokeApple: createAppleRevocation({
      keyId: Deno.env.get('APPLE_SIGN_IN_KEY_ID'),
      privateKey: applePrivateKey(),
    }),
  }),
);
