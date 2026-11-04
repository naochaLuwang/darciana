'use server';
import { revalidatePath } from 'next/cache';
import { checkoutSchema, paymentModeSchema } from '@/lib/checkout';
import type { PaymentMode } from '@/lib/payment';
import { createClient } from '@/lib/supabase/server';
export async function submitCheckout(input: unknown): Promise<{
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
        error: 'That delivery area is unavailable. Refresh the page and select an available area.',
      };
    if (error.message.includes('LEGACY_REQUEST'))
      return {
        error:
          'This request was already received with an earlier checkout. Check your account for its details.',
      };
    if (error.message.includes('INVALID_PAYMENT_MODE')) return { error: 'Select a payment mode.' };
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
  revalidatePath('/account');
  return {
    orderId: data.id,
    total: data.order_total,
    shippingPrice: data.shipping_price,
    areaName: data.shipping_area_name,
    paymentMode: returnedPayment.data,
  };
}
