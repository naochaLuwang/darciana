import { z } from 'zod';
export const shippingSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+91[ -]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number.'),
  address: z.string().trim().min(8, 'Enter a complete street address.').max(300),
  city: z.string().trim().min(2, 'Enter your city.').max(100),
  state: z.string().trim().min(2, 'Enter your state.').max(100),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit PIN code.'),
  notes: z.string().trim().max(500).default(''),
});
export const addressSchema = shippingSchema.omit({ notes: true }).extend({
  shipping_area_id: z.uuid().nullable().default(null),
});
export const savedAddressSchema = addressSchema.extend({ id: z.uuid().nullable().optional() });
export const customerProfileSchema = shippingSchema.pick({ name: true, phone: true });
export const paymentModeSchema = z.enum(['cash_on_delivery', 'manual_upi'], {
  error: 'Select a payment mode.',
});
export const checkoutSchema = z.object({
  requestId: z.uuid(),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        variantId: z.uuid(),
        quantity: z.number().int().min(1).max(10),
      }),
    )
    .min(1)
    .max(30)
    .refine(
      (items) => new Set(items.map((item) => item.variantId)).size === items.length,
      'Your bag contains duplicate items. Please refresh it.',
    ),
  expectedTotal: z.number().finite().int().min(0).max(1000000),
  shippingAreaId: z.uuid({ error: 'Select a delivery area from the list.' }),
  expectedShippingPrice: z.number().finite().int().min(0).max(100000),
  shipping: shippingSchema,
  paymentMode: z.literal('cash_on_delivery', { error: 'Select cash on delivery.' }),
  termsAccepted: z.literal(true, { error: 'Accept the terms and conditions.' }),
});
