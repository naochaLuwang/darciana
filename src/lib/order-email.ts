import { money, roundRupees } from './money.ts';

export const orderEmailStatuses = [
  'awaiting_confirmation',
  'confirmed',
  'completed',
  'cancelled',
] as const;
export type OrderEmailStatus = (typeof orderEmailStatuses)[number];
export type EmailOrder = {
  id: string;
  status: OrderEmailStatus;
  items: { name: string; option?: string | null; quantity: number; unit_price: number }[];
  item_total: number;
  shipping_price: number | null;
  order_total: number | null;
};
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );

export function orderEmail(order: EmailOrder) {
  const copy: Record<OrderEmailStatus, { title: string; message: string }> = {
    awaiting_confirmation: {
      title: 'Order received',
      message: 'We’ve received your order. We’ll email you when it’s confirmed.',
    },
    confirmed: {
      title: 'Order confirmed',
      message: 'Your order is confirmed. We’re getting it ready for you.',
    },
    completed: {
      title: 'Order completed',
      message: 'Your order is complete. Thank you for shopping with Daciana.',
    },
    cancelled: {
      title: 'Order cancelled',
      message: 'Your order has been cancelled. Reply to this email if you need help.',
    },
  };
  const { title, message } = copy[order.status];
  const reference = order.id.slice(0, 8).toUpperCase();
  const total = money(order.order_total ?? order.item_total);
  const totalLabel = order.order_total == null ? 'Items total' : 'Total';
  const delivery = order.shipping_price == null ? 'To be confirmed' : money(order.shipping_price);
  const items = order.items.map(
    (item) =>
      `${item.name}${item.option ? ` — ${item.option}` : ''} × ${item.quantity} · ${money(roundRupees(item.unit_price) * item.quantity)}`,
  );
  const details = `Order #${reference}\n${items.join('\n')}\nDelivery: ${delivery}\n${totalLabel}: ${total}`;
  return {
    subject: `${title} · Daciana #${reference}`,
    text: `${title}\n\n${message}\n\n${details}\n\nView your orders: https://dacianastore.in/account\nDaciana · Stationery & Cosmetics`,
    html: `<!doctype html><html lang="en"><body style="margin:0;background:#faf9f7;color:#38271d;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px 24px;background:#ffffff;border:1px solid #e8e0d8;border-radius:12px"><p style="font-family:Georgia,serif;font-size:24px;margin:0 0 32px">Daciana</p><h1 style="font-size:24px;margin:0 0 16px">${title}</h1><p style="line-height:1.6">${message}</p><p style="font-size:14px;color:#72665d">Order #${reference}</p><ul style="padding-left:20px;line-height:1.8">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p>Delivery: ${delivery}</p><p style="font-weight:bold;font-size:20px">${totalLabel}: ${total}</p><p style="margin-top:28px"><a href="https://dacianastore.in/account" style="display:inline-block;background:#38271d;color:#ffffff;padding:14px 22px;border-radius:6px;text-decoration:none">View orders</a></p><p style="font-size:12px;color:#72665d;margin-top:32px">Stationery &amp; Cosmetics</p></main></body></html>`,
  };
}
