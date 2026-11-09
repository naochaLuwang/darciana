import { z } from 'zod';
import { isStoreMediaUrl } from './media.ts';

const price = z.number().finite().int('Use whole rupees, without decimals.').min(0).max(1000000);
export const imageUrl = z.union([
  z.literal(''),
  z
    .url()
    .max(2048)
    .refine(
      (value) =>
        value.startsWith('https://') ||
        isStoreMediaUrl(value, process.env.NEXT_PUBLIC_SUPABASE_URL),
      'Use an HTTPS image URL.',
    ),
]);
// A percentage is a rate, not a rupee amount; retain fractional percentage rates.
const discount = {
  discount_type: z.enum(['none', 'amount', 'percentage']),
  discount_value: z
    .number()
    .finite()
    .min(0)
    .max(1000000)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001,
      'Use no more than two decimal places for a percentage.',
    ),
};
export const variantSchema = z
  .object({
    id: z.uuid().nullable(),
    title: z.string().trim().min(1).max(200),
    sku: z.string().trim().min(1).max(1000),
    price,
    stock: z.number().int().min(0).max(1000000),
    image_url: imageUrl,
    hex_code: z.union([
      z.literal(''),
      z.string().regex(/^#[0-9a-f]{6}$/i, 'Use a six-digit hex colour.'),
    ]),
    is_default: z.boolean(),
    ...discount,
  })
  .refine(
    (value) => value.discount_type !== 'percentage' || value.discount_value <= 100,
    'Percentage discounts cannot exceed 100%.',
  )
  .refine(
    (value) => value.discount_type !== 'amount' || value.discount_value <= value.price,
    'A discount cannot exceed the price.',
  )
  .refine(
    (value) => value.discount_type !== 'amount' || Number.isInteger(value.discount_value),
    'Use whole rupees for amount discounts.',
  );
export const productSchema = z
  .object({
    id: z.uuid().nullable(),
    expected_updated_at: z.iso.datetime({ offset: true }).nullable(),
    name: z.string().trim().min(2).max(500),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(600)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use lowercase letters, numbers, and single hyphens for the slug.',
      ),
    description: z.string().trim().max(20000),
    brand: z.string().trim().max(100),
    status: z.enum(['active', 'inactive']),
    has_variants: z.boolean(),
    base_price: price.nullable(),
    thumbnail_url: imageUrl,
    category_ids: z
      .array(z.uuid())
      .max(50)
      .refine((ids) => new Set(ids).size === ids.length, 'Select each category once.'),
    variants: z.array(variantSchema).min(1).max(100),
    ...discount,
  })
  .superRefine((value, ctx) => {
    if (value.discount_type === 'amount' && !Number.isInteger(value.discount_value))
      ctx.addIssue({
        code: 'custom',
        message: 'Use whole rupees for amount discounts.',
        path: ['discount_value'],
      });
    if (value.id && !value.expected_updated_at)
      ctx.addIssue({
        code: 'custom',
        message: 'Refresh this product before saving.',
        path: ['expected_updated_at'],
      });
    if (!value.has_variants && (value.variants.length !== 1 || value.base_price === null))
      ctx.addIssue({
        code: 'custom',
        message: 'A simple product needs one stock option and a base price.',
        path: ['variants'],
      });
    if (value.variants.filter((variant) => variant.is_default).length !== 1)
      ctx.addIssue({
        code: 'custom',
        message: 'Choose exactly one default option.',
        path: ['variants'],
      });
    if (new Set(value.variants.map((variant) => variant.sku)).size !== value.variants.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Each option needs a different SKU.',
        path: ['variants'],
      });
    const ids = value.variants.flatMap((variant) => (variant.id ? [variant.id] : []));
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate product options are not allowed.',
        path: ['variants'],
      });
    if (
      (value.discount_type === 'percentage' && value.discount_value > 100) ||
      (value.discount_type === 'amount' &&
        value.base_price !== null &&
        value.discount_value > value.base_price)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'The product discount exceeds its price.',
        path: ['discount_value'],
      });
  });
export type ProductInput = z.infer<typeof productSchema>;
export const categorySchema = z
  .object({
    id: z.uuid().nullable(),
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    parent_id: z.uuid().nullable(),
    image_url: imageUrl,
  })
  .refine(
    (category) => !category.id || category.id !== category.parent_id,
    'A category cannot be its own parent.',
  );
export type CategoryInput = z.infer<typeof categorySchema>;
export const shippingAreaSchema = z
  .object({
    id: z.uuid().nullable(),
    expected_updated_at: z.iso.datetime({ offset: true }).nullable(),
    name: z
      .string()
      .trim()
      .min(2, 'Enter an area name.')
      .max(160)
      .transform((name) => name.replace(/\s+/g, ' ')),
    price: price.refine((value) => value <= 100000, 'Delivery price cannot exceed ₹1,00,000.'),
    is_active: z.boolean(),
  })
  .refine((area) => !area.id || !!area.expected_updated_at, 'Refresh this area before saving.');
export const stockSchema = z.object({
  id: z.uuid(),
  stock: z.number().int().min(0).max(1000000),
  expected_updated_at: z.iso.datetime({ offset: true }),
});
export const statusSchema = z.object({
  id: z.uuid(),
  status: z.enum(['active', 'inactive']),
  expected_updated_at: z.iso.datetime({ offset: true }),
});
export const deleteProductSchema = z.object({
  id: z.uuid(),
  expected_updated_at: z.iso.datetime({ offset: true }),
  confirmation: z.literal('DELETE', { error: 'Type DELETE to confirm.' }),
});
export const orderStatusSchema = z.object({
  id: z.uuid(),
  expected_status: z.enum(['awaiting_confirmation', 'confirmed', 'completed', 'cancelled']),
  status: z.enum(['confirmed', 'completed', 'cancelled']),
});
export const orderTransitions: Record<string, string[]> = {
  awaiting_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};
export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 600);
}
export function imageKind(bytes: Uint8Array): { extension: string; mime: string } | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { extension: 'jpg', mime: 'image/jpeg' };
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value))
    return { extension: 'png', mime: 'image/png' };
  const text = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP')
    return { extension: 'webp', mime: 'image/webp' };
  if (text(4, 8) === 'ftyp' && ['avif', 'avis'].includes(text(8, 12)))
    return { extension: 'avif', mime: 'image/avif' };
  return null;
}
