'use server';
import { revalidatePath } from 'next/cache';
import { adminSession, adminError, adminProductSelect, normalizeAdminProduct } from '@/lib/admin';
import {
  pricingSchema,
  priceUpdate,
  productPricing,
  type ProductPricing,
} from '@/lib/product-pricing';
export type PricingResult = {
  error?: string;
  success?: string;
  record?: ProductPricing;
  refreshRequired?: boolean;
};
export async function savePrices(input: unknown): Promise<PricingResult> {
  const parsed = pricingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const session = await adminSession();
  if (!session) return { error: 'Admin access is required. Sign in again.' };
  const product = await session.db
    .from('products')
    .select(adminProductSelect)
    .eq('id', parsed.data.id)
    .single();
  if (product.error || !product.data)
    return { error: adminError(product.error), refreshRequired: true };
  let payload: ReturnType<typeof priceUpdate>;
  try {
    payload = priceUpdate(normalizeAdminProduct(product.data), parsed.data);
  } catch {
    return {
      error:
        'Product details or options have changed. Refresh the page and review this product before saving.',
      refreshRequired: true,
    };
  }
  const saved = await session.db.rpc('storefront_admin_save_product', { p_product: payload });
  if (saved.error)
    return {
      error: adminError(saved.error),
      refreshRequired:
        saved.error.message?.includes('CONFLICT') || saved.error.message?.includes('NOT_FOUND'),
    };
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
  const updated = await session.db
    .from('products')
    .select(adminProductSelect)
    .eq('id', parsed.data.id)
    .single();
  if (updated.error || !updated.data)
    return { success: 'Prices saved. Refresh before making more changes.', refreshRequired: true };
  return { success: 'Prices saved.', record: productPricing(normalizeAdminProduct(updated.data)) };
}
