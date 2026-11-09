import 'server-only';
import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import { readProductMedia } from './storefront-data';
import type { ProductMediaResult } from './product-media';

export const getProductMedia = cache(async (productId: string): Promise<ProductMediaResult> => {
  const config = supabaseConfig();
  if (!config) return { media: null, error: 'More photos couldn’t load.' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return readProductMedia(db, productId);
});
