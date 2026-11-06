import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import { readStoreContent } from './storefront-data';
export const getStoreContent = cache(async () => {
  const config = supabaseConfig();
  if (!config) return { pages: [], error: 'Information is unavailable. Try again later.' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return readStoreContent(db);
});
export function contentWriter() {
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  return config && secret
    ? createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}
