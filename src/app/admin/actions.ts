'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { adminSession, adminError } from '@/lib/admin';
import { createClient } from '@/lib/supabase/server';
import {
  productSchema,
  categorySchema,
  stockSchema,
  statusSchema,
  orderStatusSchema,
  imageKind,
  shippingAreaSchema,
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
  return result.success
    ? mutate('storefront_admin_save_product', { p_product: result.data })
    : { error: result.error.issues[0].message };
}
export async function saveCategory(input: unknown): Promise<AdminResult> {
  const result = categorySchema.safeParse(input);
  return result.success
    ? mutate('storefront_admin_save_category', { p_category: result.data })
    : { error: result.error.issues[0].message };
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
  return result.success
    ? mutate('storefront_admin_set_order_status', {
        p_order_id: result.data.id,
        p_status: result.data.status,
        p_expected_status: result.data.expected_status,
      })
    : { error: result.error.issues[0].message };
}
export async function uploadAdminImage(form: FormData): Promise<AdminResult> {
  const session = await adminSession();
  if (!session) return { error: 'Admin access is required.' };
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 12 || file.size > 5 * 1024 * 1024)
    return { error: 'Choose an image smaller than 5 MB.' };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind || kind.mime !== file.type)
    return { error: 'Use a valid JPEG, PNG, WebP, or AVIF image.' };
  const path = `${session.user.id}/${crypto.randomUUID()}.${kind.extension}`;
  const { error } = await session.db.storage
    .from('storefront-media')
    .upload(path, bytes, { contentType: kind.mime, cacheControl: '31536000', upsert: false });
  if (error) {
    console.error('Admin upload failed', error.name);
    return {
      error: 'Upload failed. Check that the storefront-media bucket and admin policies are set up.',
    };
  }
  return {
    url: session.db.storage.from('storefront-media').getPublicUrl(path).data.publicUrl,
    success: 'Image uploaded.',
  };
}
