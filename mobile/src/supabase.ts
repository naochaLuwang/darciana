import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '@/lib/supabase/config';
import { authStorage } from './storage';

export const authStorageKey = 'daciana.auth.v1';
const config = supabaseConfig();
if (!config) throw new Error('Public Supabase configuration is missing.');
export const supabase = createSupabaseClient(config.url, config.key, {
  auth: {
    storage: authStorage,
    storageKey: authStorageKey,
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (input, init) =>
      fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(15_000) }),
  },
});

export async function createClient() {
  return supabase;
}
