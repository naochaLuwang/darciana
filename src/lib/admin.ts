import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Product, Variant } from './commerce';
export type AdminProduct = Omit<Product, 'product_variants'> & {
  status: 'active' | 'inactive';
  updated_at: string;
  product_variants: (Variant & { sku: string; updated_at: string })[];
};
export type AdminOrder = {
  id: string;
  user_id: string;
  created_at: string;
  status: string;
  item_total: number;
  shipping_area_name: string | null;
  shipping_price: number | null;
  order_total: number | null;
  items: { name: string; option: string; quantity: number; unit_price: number }[];
  shipping: {
    name: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    notes: string;
    payment_mode?: string;
    terms_accepted_at?: string;
    terms_version?: string;
  };
};
export const getAdminContext = cache(async () => {
  const db = await createClient();
  if (!db) return { state: 'setup' as const, db, user: null };
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (!user || error) return { state: 'signed_out' as const, db, user: null };
  const result = await db.rpc('storefront_is_admin');
  if (result.error)
    return {
      state:
        result.error.code === 'PGRST202' || result.error.code === '42883'
          ? ('setup' as const)
          : ('unavailable' as const),
      db,
      user,
    };
  return { state: result.data === true ? ('authorized' as const) : ('denied' as const), db, user };
});
export async function adminSession() {
  const context = await getAdminContext();
  return context.state === 'authorized' && context.db && context.user
    ? { db: context.db, user: context.user }
    : null;
}
export const adminProductSelect =
  'id,name,slug,description,brand,status,updated_at,category_id,has_variants,base_price,currency,thumbnail_url,discount_type,discount_value,created_at,product_variants(id,title,sku,price,stock,image_url,hex_code,discount_type,discount_value,is_default,updated_at),product_categories(category_id)';
export function normalizeAdminProduct(value: Record<string, unknown>): AdminProduct {
  const links = (value.product_categories ?? []) as { category_id: string }[];
  return {
    ...value,
    categoryIds: [
      ...new Set([
        ...(value.category_id ? [value.category_id as string] : []),
        ...links.map((link) => link.category_id),
      ]),
    ],
  } as AdminProduct;
}
export function adminError(error: { code?: string; message?: string } | null) {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.message?.includes('ADMIN_REQUIRED'))
    return 'Your admin access has changed. Sign in again or contact the owner.';
  if (error.message?.includes('CONFLICT'))
    return 'Someone changed this record. Refresh the page before saving again.';
  if (error.message?.includes('CATEGORY_CYCLE'))
    return 'That parent would create a category loop. Choose another parent.';
  if (error.message?.includes('EXISTING_VARIANTS_REQUIRED'))
    return 'Keep existing options and set unwanted options to zero stock.';
  if (error.message?.includes('PRODUCT_REFERENCED'))
    return 'This product is linked to records in another part of the store. Make it inactive, or remove those links before deleting it.';
  if (error.message?.includes('INVALID_DELETE_CONFIRMATION'))
    return 'Type DELETE to confirm permanent deletion.';
  if (error.message?.includes('NOT_FOUND'))
    return 'This record no longer exists. Refresh the page.';
  if (error.code === '23505')
    return error.message?.includes('shipping_areas')
      ? 'An area with that name already exists.'
      : 'That slug or SKU is already in use. Choose a unique value.';
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01')
    return 'Database setup is required. Follow the admin setup instructions in README.md.';
  if (error.code === '23503')
    return 'A linked category or option is no longer available. Refresh and try again.';
  return 'The change could not be saved. Check the fields and try again.';
}
