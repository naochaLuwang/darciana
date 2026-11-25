export const orderStatuses = [
  'awaiting_confirmation',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];
export const orderStatusLabels: Record<OrderStatus, string> = {
  awaiting_confirmation: 'Request received',
  confirmed: 'Confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
export const orderTransitions: Record<string, OrderStatus[]> = {
  awaiting_confirmation: ['processing', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  completed: [],
  cancelled: [],
};
export function orderStatusLabel(status: string) {
  return orderStatusLabels[status as OrderStatus] ?? status.replaceAll('_', ' ');
}
export function orderStatusOptions(current: string) {
  return orderStatuses
    .filter((status) => status === current || (status !== 'confirmed' && status !== 'completed'))
    .map((status) => ({
      value: status,
      label: orderStatusLabel(status),
      disabled: status !== current && !(orderTransitions[current] ?? []).includes(status),
    }));
}
