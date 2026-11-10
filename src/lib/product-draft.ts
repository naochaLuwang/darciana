import type { ProductInput } from './admin-validation.ts';
import { roundRupees } from './money.ts';

type VariantInput = ProductInput['variants'][number];
export type DraftVariant = Omit<VariantInput, 'price' | 'stock' | 'discount_value'> & {
  key: string;
  price: string;
  stock: string;
  discount_value: string;
};

export function createDraftVariant(key = crypto.randomUUID()): DraftVariant {
  return {
    key,
    id: null,
    title: 'Standard',
    sku: `DA-${crypto.randomUUID().toUpperCase()}`,
    price: '',
    stock: '0',
    image_url: '',
    hex_code: '',
    is_default: true,
    discount_type: 'none',
    discount_value: '',
  };
}

export function variantFromDraft(draft: DraftVariant): VariantInput {
  return {
    id: draft.id,
    title: draft.title,
    sku: draft.sku,
    price: roundRupees(Number(draft.price)),
    stock: Number(draft.stock),
    image_url: draft.image_url,
    hex_code: draft.hex_code,
    is_default: draft.is_default,
    discount_type: draft.discount_type,
    discount_value:
      draft.discount_type === 'none'
        ? 0
        : draft.discount_type === 'amount'
          ? roundRupees(Number(draft.discount_value))
          : Number(draft.discount_value),
  };
}
