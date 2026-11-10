import { z } from 'zod';
import type { AdminProduct } from './admin';
import { productSchema, type ProductInput } from './admin-validation.ts';
import { roundRupees } from './money.ts';

const optionPriceSchema = z
  .object({
    id: z.uuid(),
    price: z.number().finite().int('Use whole rupees.').min(0).max(1000000),
    discount_type: z.enum(['none', 'amount', 'percentage']),
    discount_value: z.number().finite().min(0).max(1000000),
  })
  .superRefine((option, ctx) => {
    if (
      option.discount_type === 'percentage' &&
      (option.discount_value > 100 ||
        Math.abs(option.discount_value * 100 - Math.round(option.discount_value * 100)) > 0.00001)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use a percentage between 0 and 100, with up to two decimal places.',
        path: ['discount_value'],
      });
    if (
      option.discount_type === 'amount' &&
      (!Number.isInteger(option.discount_value) || option.discount_value > option.price)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Use a whole-rupee discount no greater than the price.',
        path: ['discount_value'],
      });
  });
export const pricingSchema = z.object({
  id: z.uuid(),
  expected_updated_at: z.iso.datetime({ offset: true }),
  options: z
    .array(optionPriceSchema)
    .min(1)
    .max(100)
    .refine(
      (options) => new Set(options.map((option) => option.id)).size === options.length,
      'Each option must appear once.',
    ),
});
export type PricingInput = z.infer<typeof pricingSchema>;
export type PriceOption = PricingInput['options'][number] & { title: string };
export type ProductPricing = {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  thumbnail_url: string | null;
  updated_at: string;
  has_variants: boolean;
  options: PriceOption[];
};
export function productPricing(product: AdminProduct): ProductPricing {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    thumbnail_url: product.thumbnail_url,
    updated_at: product.updated_at,
    has_variants: product.has_variants,
    options: product.product_variants.map((option) => {
      const type = (
        product.has_variants ? option.discount_type : product.discount_type
      ) as PriceOption['discount_type'];
      const discount = product.has_variants ? option.discount_value : product.discount_value;
      return {
        id: option.id,
        title: option.title,
        price: roundRupees(
          product.has_variants ? option.price : (product.base_price ?? option.price),
        ),
        discount_type: type,
        discount_value: type === 'none' ? 0 : type === 'amount' ? roundRupees(discount) : discount,
      };
    }),
  };
}
// Merge only allowed pricing fields into a fresh, server-owned product snapshot.
// The existing transactional RPC locks the product and checks this original version.
export function priceUpdate(product: AdminProduct, input: PricingInput): ProductInput {
  if (
    product.id !== input.id ||
    input.options.length !== product.product_variants.length ||
    input.options.some(
      (option) => !product.product_variants.some((saved) => saved.id === option.id),
    )
  )
    throw new Error('Product options have changed. Refresh the page before saving.');
  const prices = new Map(input.options.map((option) => [option.id, option]));
  const simple = input.options[0];
  return productSchema.parse({
    id: product.id,
    expected_updated_at: input.expected_updated_at,
    name: product.name,
    slug: product.slug,
    brand: product.brand ?? '',
    description: product.description ?? '',
    status: product.status,
    has_variants: product.has_variants,
    base_price: product.has_variants ? null : simple.price,
    thumbnail_url: product.thumbnail_url ?? '',
    category_ids: product.categoryIds,
    discount_type: product.has_variants ? 'none' : simple.discount_type,
    discount_value:
      product.has_variants || simple.discount_type === 'none' ? 0 : simple.discount_value,
    variants: product.product_variants.map((option) => {
      const price = prices.get(option.id)!;
      return {
        id: option.id,
        title: option.title,
        sku: option.sku,
        stock: option.stock,
        image_url: option.image_url ?? '',
        hex_code: option.hex_code ?? '',
        is_default: option.is_default,
        price: price.price,
        discount_type: price.discount_type,
        discount_value: price.discount_type === 'none' ? 0 : price.discount_value,
      };
    }),
  });
}
