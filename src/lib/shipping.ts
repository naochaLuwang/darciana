import { roundRupees } from './money.ts';

export type DeliveryArea = { id: string; name: string; price: number };
export type ShippingArea = DeliveryArea & { is_active: boolean; updated_at: string };
export function totalWithShipping(itemTotal: number, shippingPrice: number) {
  return roundRupees(itemTotal) + roundRupees(shippingPrice);
}
