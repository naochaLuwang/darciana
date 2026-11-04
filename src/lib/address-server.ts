import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SavedAddress } from './address';

export async function getSavedAddress(db: SupabaseClient, userId: string) {
  const [current, book] = await Promise.all([
    db
      .from('storefront_saved_addresses')
      .select('name,phone,address,city,state,pincode,shipping_area_id')
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('storefront_delivery_addresses')
      .select('id,name,phone,address,city,state,pincode,shipping_area_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
  ]);
  const addresses = (book.data ?? []) as SavedAddress[];
  const matching = addresses.find((item) =>
    ['name', 'phone', 'address', 'city', 'state', 'pincode', 'shipping_area_id'].every(
      (key) =>
        item[key as keyof SavedAddress] ===
        (current.data as SavedAddress | null)?.[key as keyof SavedAddress],
    ),
  );
  return {
    address: (matching ?? current.data ?? addresses[0] ?? null) as SavedAddress | null,
    addresses,
    bookError: book.error ? 'Saved addresses are unavailable. Try again later.' : null,
    error: current.error
      ? 'Your saved address could not load. Refresh the page to try again.'
      : null,
  };
}
