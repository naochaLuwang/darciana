import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import type { Category, Product } from './commerce';
import { readCatalog } from './storefront-data';
export const getCatalog = cache(async () => {
  const config = supabaseConfig();
  if (!config)
    return {
      products: [] as Product[],
      categories: [] as Category[],
      error: 'The shop is being set up. Please check back soon.',
    };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return readCatalog(db);
});
