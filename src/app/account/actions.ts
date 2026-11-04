'use server';
import { revalidatePath } from 'next/cache';
import { savedAddressSchema, customerProfileSchema } from '@/lib/checkout';
import { createClient } from '@/lib/supabase/server';

export async function saveAddress(
  input: unknown,
): Promise<{ error?: string; saved?: boolean; id?: string }> {
  const parsed = savedAddressSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return { error: 'Please sign in again to save your address.' };
  if (parsed.data.shipping_area_id) {
    const { data, error } = await db
      .from('storefront_shipping_areas')
      .select('id')
      .eq('id', parsed.data.shipping_area_id)
      .eq('is_active', true)
      .maybeSingle();
    if (error || !data)
      return { error: 'That delivery area is unavailable. Select another area or clear it.' };
  }
  const { data, error } = await db.rpc('storefront_save_address', { p_address: parsed.data });
  if (error) {
    // Keep single-address checkout working until the address-book upgrade is applied.
    if (!parsed.data.id && (error.code === 'PGRST202' || error.code === '42883')) {
      const fields = { ...parsed.data };
      delete fields.id;
      const fallback = await db
        .from('storefront_saved_addresses')
        .upsert({ ...fields, user_id: user.id }, { onConflict: 'user_id' });
      if (!fallback.error) {
        revalidatePath('/account');
        revalidatePath('/checkout');
        return { saved: true };
      }
    }
    return { error: 'Your address could not be saved. Please try again.' };
  }
  revalidatePath('/account');
  revalidatePath('/checkout');
  revalidatePath('/account/addresses');
  return { saved: true, id: typeof data === 'string' ? data : undefined };
}

export async function saveProfile(input: unknown): Promise<{ error?: string; saved?: boolean }> {
  const parsed = customerProfileSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await createClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return { error: 'Sign in again to update your profile.' };
  const { error } = await db
    .from('storefront_customer_profiles')
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: 'user_id' });
  if (error) return { error: 'Could not save your profile. Try again.' };
  revalidatePath('/account');
  return { saved: true };
}

export async function deleteAccount(
  input: unknown,
): Promise<{ error?: string; deleted?: boolean }> {
  const value = input as { password?: unknown; confirmation?: unknown } | null;
  if (
    !value ||
    typeof value.password !== 'string' ||
    !value.password ||
    value.password.length > 128 ||
    value.confirmation !== 'DELETE'
  )
    return { error: 'Enter your password and type DELETE to confirm.' };
  const db = await createClient();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!db || !user) return { error: 'Sign in again to delete your account.' };
  const { data, error } = await db.functions.invoke('delete-account', {
    body: { password: value.password, confirmation: 'DELETE' },
  });
  if (error || data?.deleted !== true) {
    let message = 'Account deletion is unavailable. Try again later.';
    if (error && 'context' in error && error.context instanceof Response) {
      const body = await error.context.json().catch(() => null);
      if (typeof body?.error === 'string') message = body.error;
    }
    return { error: message };
  }
  await db.auth.signOut({ scope: 'local' });
  revalidatePath('/account');
  return { deleted: true };
}
