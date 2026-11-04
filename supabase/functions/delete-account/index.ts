import { createClient } from '@supabase/supabase-js';
import { createDeleteAccountHandler } from './handler.mjs';

function injectedKey(name: string, legacy: string) {
  try {
    return JSON.parse(Deno.env.get(name) ?? '{}').default ?? Deno.env.get(legacy);
  } catch {
    return Deno.env.get(legacy);
  }
}
Deno.serve(
  createDeleteAccountHandler({
    createClient,
    url: Deno.env.get('SUPABASE_URL'),
    publicKey: injectedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY'),
    secretKey: injectedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'),
  }),
);
