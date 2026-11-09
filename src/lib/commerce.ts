import { roundRupees } from './money.ts';
export { money, roundRupees } from './money.ts';

export type Category = {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  image_url: string | null;
};
export type Variant = {
  id: string;
  title: string;
  price: number;
  stock: number;
  image_url: string | null;
  hex_code: string | null;
  discount_type: string;
  discount_value: number;
  is_default: boolean;
};
export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
  category_id: string | null;
  has_variants: boolean;
  base_price: number | null;
  currency: string;
  thumbnail_url: string | null;
  discount_type: string;
  discount_value: number;
  created_at: string;
  product_variants: Variant[];
  categoryIds: string[];
};
export type CartItem = { productId: string; variantId: string; quantity: number };
export type CartLine = CartItem & { product: Product; variant: Variant; price: number };
export function discountedPrice(price: number, type: string, value: number) {
  const discount = Math.max(0, Number.isFinite(value) ? value : 0);
  return roundRupees(
    Math.max(
      0,
      type === 'percentage'
        ? price * (1 - discount / 100)
        : type === 'amount'
          ? price - discount
          : price,
    ),
  );
}
export function variantPrice(product: Product, variant: Variant) {
  return product.has_variants
    ? discountedPrice(variant.price, variant.discount_type, variant.discount_value)
    : discountedPrice(
        product.base_price ?? variant.price,
        product.discount_type,
        product.discount_value,
      );
}
export function startingPrice(product: Product) {
  return product.product_variants.length
    ? Math.min(...product.product_variants.map((variant) => variantPrice(product, variant)))
    : discountedPrice(product.base_price ?? 0, product.discount_type, product.discount_value);
}
export function parseCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter((item): item is CartItem => {
      if (
        !item ||
        typeof item !== 'object' ||
        typeof item.productId !== 'string' ||
        typeof item.variantId !== 'string' ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10 ||
        seen.has(item.variantId)
      )
        return false;
      seen.add(item.variantId);
      return true;
    })
    .slice(0, 30);
}
export function resolveCart(items: CartItem[], products: Product[]): CartLine[] {
  return items.flatMap((item) => {
    const product = products.find((product) => product.id === item.productId);
    const variant = product?.product_variants.find((variant) => variant.id === item.variantId);
    return product && variant
      ? [{ ...item, product, variant, price: variantPrice(product, variant) }]
      : [];
  });
}
export function categoryTreeIds(categories: Category[], root: string): string[] {
  const ids = new Set([root]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of categories)
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
  }
  return [...ids];
}
