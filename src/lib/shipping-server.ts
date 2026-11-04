import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from './supabase/config';
import type { DeliveryArea } from './shipping';
export async function getDeliveryAreas(): Promise<{ areas: DeliveryArea[]; error: string | null }> {
  const config = supabaseConfig();
  if (!config)
    return { areas: [], error: 'Delivery areas are not available yet. Please try again later.' };
  const db = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db
    .from('storefront_shipping_areas')
    .select('id,name,price')
    .eq('is_active', true)
    .order('name')
    .limit(1000);
  if (error) {
    console.error('Delivery areas could not load', error.code);
    return { areas: [], error: 'Delivery areas could not load. Refresh the page to try again.' };
  }
  return { areas: data ?? [], error: null };
}
