import type { SupabaseClient } from '@supabase/supabase-js';
import {
  savedAddressSchema,
  customerProfileSchema,
  checkoutSchema,
  paymentModeSchema,
} from './checkout';
import type { PaymentMode } from './payment';

export function createCustomerActions(
  createClient: () => Promise<SupabaseClient | null>,
  invalidate: (path: string) => void,
) {
  async function saveAddress(
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
          invalidate('/account');
          invalidate('/checkout');
          return { saved: true };
        }
      }
      return { error: 'Your address could not be saved. Please try again.' };
    }
    invalidate('/account');
    invalidate('/checkout');
    invalidate('/account/addresses');
    return { saved: true, id: typeof data === 'string' ? data : undefined };
  }

  async function saveProfile(input: unknown): Promise<{ error?: string; saved?: boolean }> {
    const parsed = customerProfileSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const db = await createClient();
    const user = db ? (await db.auth.getUser()).data.user : null;
    if (!db || !user) return { error: 'Sign in again to update your profile.' };
    const { error } = await db
      .from('storefront_customer_profiles')
      .upsert({ ...parsed.data, user_id: user.id }, { onConflict: 'user_id' });
    if (error) return { error: 'Could not save your profile. Try again.' };
    invalidate('/account');
    invalidate('/');
    return { saved: true };
  }

  async function deleteAccount(input: unknown): Promise<{ error?: string; deleted?: boolean }> {
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
    invalidate('/account');
    return { deleted: true };
  }

  async function submitCheckout(input: unknown): Promise<{
    error?: string;
    orderId?: string;
    total?: number;
    shippingPrice?: number;
    areaName?: string;
    paymentMode?: PaymentMode;
  }> {
    const parsed = checkoutSchema.safeParse(input);
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    const supabase = await createClient();
    if (!supabase) return { error: 'The shop is being set up. Please try again later.' };
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return { error: 'Your session has expired. Please sign in again to submit your request.' };
    const { data, error } = await supabase.rpc('storefront_submit_order', {
      p_request_id: parsed.data.requestId,
      p_items: parsed.data.items.map((item) => ({
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
      })),
      p_shipping: {
        ...parsed.data.shipping,
        area_id: parsed.data.shippingAreaId,
        expected_price: parsed.data.expectedShippingPrice,
      },
      p_expected_total: parsed.data.expectedTotal,
      p_payment_mode: parsed.data.paymentMode,
      p_terms_accepted: parsed.data.termsAccepted,
    });
    if (error) {
      console.error('Checkout request failed', error.code);
      if (error.code === 'PGRST202' || error.code === '42883')
        return {
          error:
            'Order requests aren’t open yet. Your bag is saved; please try again once the store opens checkout.',
        };
      if (error.message.includes('PRICE_CHANGED'))
        return {
          error:
            'An item or delivery price has changed. Refresh the page and review the updated total before trying again.',
        };
      if (error.message.includes('AREA_REQUIRED') || error.message.includes('AREA_UNAVAILABLE'))
        return {
          error:
            'That delivery area is unavailable. Refresh the page and select an available area.',
        };
      if (error.message.includes('LEGACY_REQUEST'))
        return {
          error:
            'This request was already received with an earlier checkout. Check your account for its details.',
        };
      if (error.message.includes('INVALID_PAYMENT_MODE'))
        return { error: 'Select a payment mode.' };
      if (error.message.includes('TERMS_REQUIRED'))
        return { error: 'Accept the terms and conditions.' };
      if (error.message.includes('UNAVAILABLE'))
        return {
          error:
            'An item or quantity is no longer available. Refresh your bag and review your items.',
        };
      if (error.message.includes('RATE_LIMIT'))
        return {
          error:
            'You’ve submitted several requests recently. Please wait an hour before trying again.',
        };
      return { error: 'We couldn’t save your request. Please try again. Your bag is still here.' };
    }
    const returnedPayment = paymentModeSchema.safeParse(data?.payment_mode);
    if (
      !data ||
      typeof data.id !== 'string' ||
      typeof data.order_total !== 'number' ||
      typeof data.shipping_price !== 'number' ||
      typeof data.shipping_area_name !== 'string' ||
      !returnedPayment.success
    )
      return { error: 'We couldn’t confirm your request. Please try again with the same bag.' };
    invalidate('/account');
    return {
      orderId: data.id,
      total: data.order_total,
      shippingPrice: data.shipping_price,
      areaName: data.shipping_area_name,
      paymentMode: returnedPayment.data,
    };
  }

  return { saveAddress, saveProfile, deleteAccount, submitCheckout };
}
