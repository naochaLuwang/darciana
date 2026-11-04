import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
export type CustomerProfile = { name: string; phone: string };
export async function getCustomerProfile(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('storefront_customer_profiles')
    .select('name,phone')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    profile: data as CustomerProfile | null,
    error: error ? 'Profile saving is unavailable. Try again later.' : null,
  };
}
