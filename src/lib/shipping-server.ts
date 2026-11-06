import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import type { DeliveryArea } from './shipping';
import { readDeliveryAreas } from './storefront-data';
export async function getDeliveryAreas(): Promise<{ areas: DeliveryArea[]; error: string | null }> {
  const config = supabaseConfig();
  if (!config)
    return { areas: [], error: 'Delivery areas are not available yet. Please try again later.' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return readDeliveryAreas(db);
}
