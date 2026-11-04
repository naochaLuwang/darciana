export type DeliveryArea = { id: string; name: string; price: number };
export type ShippingArea = DeliveryArea & { is_active: boolean; updated_at: string };
export function totalWithShipping(itemTotal: number, shippingPrice: number) {
  return Math.round((itemTotal + shippingPrice) * 100) / 100;
}
