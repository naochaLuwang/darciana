import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import { buildContentPages, type SettingRow } from './store-content';
export const getStoreContent = cache(async () => {
  const config = supabaseConfig();
  if (!config) return { pages: [], error: 'Information is unavailable. Try again later.' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from('site_settings')
    .select('id,key,content,updated_at')
    .order('updated_at', { ascending: false })
    .limit(512);
  return {
    pages: buildContentPages((data ?? []) as SettingRow[]),
    error: error ? 'Information is unavailable. Try again later.' : null,
  };
});
export function contentWriter() {
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  return config && secret
    ? createClient(config.url, secret, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
}
