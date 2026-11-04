export const paymentOptions = [
  {
    value: 'cash_on_delivery',
    label: 'Cash on Delivery (COD)',
    description: 'Pay in Cash upon delivery',
  },
] as const;
export type PaymentMode = (typeof paymentOptions)[number]['value'] | 'manual_upi';
export function paymentLabel(value?: string) {
  // Keep earlier orders readable after removing UPI from checkout.
  if (value === 'manual_upi') return 'Manual UPI';
  return paymentOptions.find((option) => option.value === value)?.label ?? 'Not specified';
}
