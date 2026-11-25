'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adminSession, adminError } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import { notifyOrderChange } from '@/lib/order-notifications';
import { sendAdminPush } from '@/lib/push-server';
import { persistAdminImage } from '@/lib/media-upload';
import { validImageChange } from '@/lib/media';
import {
  productSchema,
  categorySchema,
  stockSchema,
  statusSchema,
  orderStatusSchema,
  paymentStatusSchema,
  shippingAreaSchema,
  deleteProductSchema,
} from '@/lib/admin-validation';
export type AdminResult = { error?: string; success?: string; id?: string; url?: string };
export async function adminSignIn(_: AdminResult, form: FormData): Promise<AdminResult> {
  const credentials = z
    .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
    .safeParse({ email: String(form.get('email') ?? '').trim(), password: form.get('password') });
  if (!credentials.success) return { error: 'Enter your email and password.' };
  const db = await createClient();
  if (!db) return { error: 'Supabase is not configured yet.' };
  const { error } = await db.auth.signInWithPassword(credentials.data);
  if (error)
    return { error: 'Sign-in failed. Check your email, password, and email confirmation.' };
  redirect('/admin');
}
export async function adminSignOut() {
  const db = await createClient();
  if (db) await db.auth.signOut();
  redirect('/admin');
}
async function mutate(rpc: string, args: Record<string, unknown>): Promise<AdminResult> {
  const session = await adminSession();
  if (!session) return { error: 'Admin access is required. Please sign in again.' };
  const { data, error } = await session.db.rpc(rpc, args);
  if (error) {
    console.error('Admin mutation failed', rpc, error.code);
    return { error: adminError(error) };
  }
  revalidatePath('/admin', 'layout');
  revalidatePath('/', 'layout');
  return { success: 'Changes saved.', id: typeof data === 'string' ? data : undefined };
}
export async function saveProduct(input: unknown): Promise<AdminResult> {
  const result = productSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };
  const session = await adminSession();
  if (!session) return { error: 'Admin access is required.' };
  let previous: {
    thumbnail_url: string | null;
    product_variants: { id: string; image_url: string | null }[];
  } | null = null;
  if (result.data.id) {
    const record = await session.db
      .from('products')
      .select('thumbnail_url,product_variants(id,image_url)')
      .eq('id', result.data.id)
      .single();
    if (record.error) return { error: adminError(record.error) };
    previous = record.data;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (
    !validImageChange(result.data.thumbnail_url, previous?.thumbnail_url, base) ||
    result.data.variants.some(
      (variant) =>
        !validImageChange(
          variant.image_url,
          previous?.product_variants.find((saved) => saved.id === variant.id)?.image_url,
          base,
        ),
    )
  )
    return { error: 'Upload new images using the image upload button.' };
  return mutate('storefront_admin_save_product', { p_product: result.data });
}
export async function deleteProduct(input: unknown): Promise<AdminResult> {
  const result = deleteProductSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };
  const deleted = await mutate('storefront_admin_delete_product', {
    p_product_id: result.data.id,
    p_expected_updated_at: result.data.expected_updated_at,
    p_confirmation: result.data.confirmation,
  });
  return deleted.error ? deleted : { ...deleted, success: 'Product permanently deleted.' };
}
export async function saveCategory(input: unknown): Promise<AdminResult> {
  const result = categorySchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };
  const session = await adminSession();
  if (!session) return { error: 'Admin access is required.' };
  let previous: string | null = null;
  if (result.data.id) {
    const record = await session.db
      .from('categories')
      .select('image_url')
      .eq('id', result.data.id)
      .single();
    if (record.error) return { error: adminError(record.error) };
    previous = record.data.image_url;
  }
  if (!validImageChange(result.data.image_url, previous, process.env.NEXT_PUBLIC_SUPABASE_URL))
    return { error: 'Upload new images using the image upload button.' };
  return mutate('storefront_admin_save_category', { p_category: result.data });
}
export async function saveShippingArea(input: unknown): Promise<AdminResult> {
  const result = shippingAreaSchema.safeParse(input);
  return result.success
    ? mutate('storefront_admin_save_shipping_area', { p_area: result.data })
    : { error: result.error.issues[0].message };
}
export async function saveStock(input: unknown): Promise<AdminResult> {
  const result = stockSchema.safeParse(input);
  return result.success
    ? mutate('storefront_admin_set_stock', {
        p_variant_id: result.data.id,
        p_stock: result.data.stock,
        p_expected_updated_at: result.data.expected_updated_at,
      })
    : { error: result.error.issues[0].message };
}
export async function saveBulkStock(input: unknown): Promise<{
  updated: string[];
  failed: { id: string; error: string }[];
  error?: string;
}> {
  const parsed = z.array(stockSchema).min(1).max(2500).safeParse(input);
  if (!parsed.success || new Set(parsed.data?.map((row) => row.id)).size !== parsed.data?.length)
    return {
      updated: [],
      failed: [],
      error: 'Select rows and enter a whole stock quantity from 0 to 1,000,000.',
    };
  const session = await adminSession();
  if (!session)
    return { updated: [], failed: [], error: 'Admin access is required. Please sign in again.' };
  const updated: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (let offset = 0; offset < parsed.data.length; offset += 5) {
    const batch = parsed.data.slice(offset, offset + 5);
    const results = await Promise.allSettled(
      batch.map((row) =>
        session.db.rpc('storefront_admin_set_stock', {
          p_variant_id: row.id,
          p_stock: row.stock,
          p_expected_updated_at: row.expected_updated_at,
        }),
      ),
    );
    results.forEach((result, index) => {
      const id = batch[index].id;
      if (result.status === 'rejected') {
        failed.push({ id, error: 'Could not confirm this update. Refresh before trying again.' });
      } else if (result.value.error) {
        failed.push({ id, error: adminError(result.value.error) });
      } else {
        updated.push(id);
      }
    });
  }
  if (updated.length) {
    revalidatePath('/admin', 'layout');
    revalidatePath('/', 'layout');
  }
  return { updated, failed };
}
export async function saveProductStatus(input: unknown): Promise<AdminResult> {
  const result = statusSchema.safeParse(input);
  return result.success
    ? mutate('storefront_admin_set_product_status', {
        p_product_id: result.data.id,
        p_status: result.data.status,
        p_expected_updated_at: result.data.expected_updated_at,
      })
    : { error: result.error.issues[0].message };
}
export async function saveOrderStatus(input: unknown): Promise<AdminResult> {
  const result = orderStatusSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };
  const saved = await mutate('storefront_admin_set_order_status', {
    p_order_id: result.data.id,
    p_status: result.data.status,
    p_expected_status: result.data.expected_status,
  });
  if (saved.error) return saved;
  const session = await adminSession();
  if (!session) return { success: 'Status saved. Sign in again to send a notification.' };
  const notification = await notifyOrderChange(
    {
      orderId: result.data.id,
      status: result.data.status,
      actorId: session.user.id,
    },
    session.db,
    sendAdminPush,
  );
  revalidatePath('/admin/notifications');
  return { success: `Status saved. ${notification.error ?? notification.success}` };
}
export async function savePaymentStatus(input: unknown): Promise<AdminResult> {
  const result = paymentStatusSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };
  const saved = await mutate('storefront_admin_set_payment_status', {
    p_order_id: result.data.id,
    p_status: result.data.status,
    p_expected_status: result.data.expected_status,
    p_expected_updated_at: result.data.expected_updated_at,
  });
  if (saved.error) return saved;
  return { success: 'Payment status saved.' };
}
export async function uploadAdminImage(form: FormData): Promise<AdminResult> {
  return persistAdminImage(form, { getSession: adminSession });
}
