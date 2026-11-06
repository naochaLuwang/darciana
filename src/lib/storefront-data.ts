import type { SupabaseClient } from '@supabase/supabase-js';
import type { Category, Product } from './commerce';
import type { SavedAddress } from './address';
import type { DeliveryArea } from './shipping';
import { buildContentPages, type SettingRow } from './store-content';

export async function readCatalog(db: SupabaseClient) {
  const [products, categories] = await Promise.all([
    db
      .from('products')
      .select(
        'id,name,slug,description,brand,category_id,has_variants,base_price,currency,thumbnail_url,discount_type,discount_value,created_at,product_variants(id,title,price,stock,image_url,hex_code,discount_type,discount_value,is_default),product_categories(category_id)',
      )
      .eq('status', 'active')
      .eq('currency', 'INR')
      .order('created_at', { ascending: false })
      .limit(1000),
    db.from('categories').select('id,name,slug,parent_id,image_url').order('name').limit(1000),
  ]);
  if (products.error || categories.error) {
    console.error('Catalog request failed', products.error?.code, categories.error?.code);
    return {
      products: [] as Product[],
      categories: [] as Category[],
      error: 'We couldn’t load the shop. Please refresh and try again.',
    };
  }
  return {
    products: (products.data ?? []).map(({ product_categories, ...product }) => ({
      ...product,
      categoryIds: [
        ...new Set([
          ...(product.category_id ? [product.category_id] : []),
          ...product_categories.map((link) => link.category_id),
        ]),
      ],
    })) as Product[],
    categories: (categories.data ?? []) as Category[],
    error: null,
  };
}

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

export async function readDeliveryAreas(
  db: SupabaseClient,
): Promise<{ areas: DeliveryArea[]; error: string | null }> {
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

export async function readStoreContent(db: SupabaseClient) {
  const { data, error } = await db
    .from('site_settings')
    .select('id,key,content,updated_at')
    .order('updated_at', { ascending: false })
    .limit(512);
  return {
    pages: buildContentPages((data ?? []) as SettingRow[]),
    error: error ? 'Information is unavailable. Try again later.' : null,
  };
}
