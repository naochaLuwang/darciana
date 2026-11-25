import { money, roundRupees } from './money.ts';
import { orderStatuses, orderStatusLabel } from './order-status.ts';

export const orderEmailStatuses = orderStatuses;
export type OrderEmailStatus = (typeof orderEmailStatuses)[number];
export type EmailOrder = {
  id: string;
  status: OrderEmailStatus;
  items: { name: string; option?: string | null; quantity: number; unit_price: number }[];
  item_total: number;
  shipping_price: number | null;
  order_total: number | null;
  created_at?: string;
  payment_status?: 'unpaid' | 'paid';
  shipping?: { payment_mode?: string };
};
const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
const copy: Record<OrderEmailStatus, { title: string; message: string }> = {
  awaiting_confirmation: {
    title: 'Order received',
    message: 'We’ve received your order request. We’ll email you as it moves through delivery.',
  },
  confirmed: {
    title: 'Order confirmed',
    message: 'Your order is confirmed. We’re getting it ready for you.',
  },
  processing: {
    title: 'Order processing',
    message: 'We’re processing your order and getting it ready to ship.',
  },
  shipped: {
    title: 'Order shipped',
    message: 'Your order has shipped and is on its way to you.',
  },
  out_for_delivery: {
    title: 'Order out for delivery',
    message: 'Your order is out for delivery. Please be available to receive it.',
  },
  delivered: {
    title: 'Order delivered',
    message: 'Your order has been delivered. Thank you for shopping with Daciana.',
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

export function orderEmail(order: EmailOrder, audience: 'customer' | 'admin' = 'customer') {
  const admin = audience === 'admin';
  const status = orderStatusLabel(order.status);
  const reference = order.id.slice(0, 8).toUpperCase();
  const title =
    admin && order.status === 'awaiting_confirmation'
      ? 'New order request'
      : copy[order.status].title;
  const message = admin
    ? order.status === 'awaiting_confirmation'
      ? 'A new order request is ready for your review. Open the order to confirm the details and start processing.'
      : `Order #${reference} is now ${status.toLowerCase()}. Open the order to review the latest details.`
    : copy[order.status].message;
  const url = admin
    ? `https://dacianastore.in/admin/orders/${order.id}`
    : 'https://dacianastore.in/account';
  const cta = admin ? 'Open order in admin' : 'View your orders';
  const total = money(order.order_total ?? order.item_total);
  const totalLabel = order.order_total == null ? 'Items total' : 'Total';
  const delivery = order.shipping_price == null ? 'To be confirmed' : money(order.shipping_price);
  const payment =
    order.payment_status === 'paid'
      ? 'Paid'
      : order.payment_status === 'unpaid'
        ? 'Unpaid'
        : 'Not recorded';
  const modes: Record<string, string> = {
    cash_on_delivery: 'Cash on delivery',
    manual_upi: 'Manual UPI',
  };
  const paymentMode = modes[order.shipping?.payment_mode ?? ''];
  const created = order.created_at ? new Date(order.created_at) : null;
  const date =
    created && Number.isFinite(created.getTime())
      ? `${new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(created)} IST`
      : null;
  const items = order.items.map((item) => ({
    ...item,
    amount: money(roundRupees(item.unit_price) * item.quantity),
  }));
  const details = `Order #${reference}${date ? `\nPlaced: ${date}` : ''}\nStatus: ${status}\n${items.map((item) => `${item.name}${item.option ? ` — ${item.option}` : ''} × ${item.quantity} · ${item.amount}`).join('\n')}\nDelivery: ${delivery}\n${totalLabel}: ${total}\nPayment status: ${payment}${paymentMode ? `\nPayment method: ${paymentMode}` : ''}`;
  const summaryRow = (label: string, value: string, bold = false) =>
    `<tr><td style="padding:7px 0;color:#71655e;${bold ? 'font-weight:bold;color:#38271d;' : ''}">${label}</td><td align="right" style="padding:7px 0;${bold ? 'font-weight:bold;font-size:20px;' : ''}">${escapeHtml(value)}</td></tr>`;
  return {
    subject: `${admin ? '[Admin] ' : ''}${title} · Daciana #${reference}`,
    text: `${title}\n\n${message}\n\n${details}\n\n${cta}: ${url}\n\n${admin ? 'You’re receiving this operational alert as a Daciana admin.' : 'Need help? Reply to this email.'}\nDaciana · Stationery & Cosmetics`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${title} · Daciana</title></head>
<body style="margin:0;padding:0;background:#faf9f7;color:#38271d;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(`${title} · Order #${reference}. ${message}`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf9f7"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border:1px solid #e8e0d8;border-radius:12px">
<tr><td style="padding:28px 24px 22px;border-bottom:1px solid #eee7e1"><p style="margin:0;font-family:Georgia,serif;font-size:30px;line-height:1.2">Daciana</p><p style="margin:6px 0 0;font-size:12px;color:#71655e">STATIONERY &amp; COSMETICS</p>${admin ? '<p style="margin:12px 0 0;font-size:12px;color:#71655e">Admin order alert</p>' : ''}</td></tr>
<tr><td style="padding:28px 24px 24px"><span style="display:inline-block;background:${order.status === 'cancelled' ? '#fcece9' : '#f3eeea'};color:#663b34;border-radius:4px;padding:5px 10px;font-size:12px;font-weight:bold">${status}</span>
<h1 style="font-size:26px;line-height:1.25;margin:18px 0 12px">${title}</h1><p style="margin:0 0 24px;color:#61534b;line-height:1.7">${escapeHtml(message)}</p>
<p style="margin:0;font-weight:bold">Order #${reference}</p>${date ? `<p style="margin:4px 0 0;color:#71655e;font-size:12px">Placed ${escapeHtml(date)}</p>` : ''}
<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:20px;table-layout:fixed"><thead><tr><th scope="col" align="left" style="padding:10px 0;border-bottom:1px solid #e8e0d8;font-size:12px;color:#71655e">Product</th><th scope="col" align="center" width="36" style="padding:10px 0;border-bottom:1px solid #e8e0d8;font-size:12px;color:#71655e">Qty</th><th scope="col" align="right" width="80" style="padding:10px 0;border-bottom:1px solid #e8e0d8;font-size:12px;color:#71655e">Amount</th></tr></thead><tbody>
${items.map((item) => `<tr><td style="padding:14px 12px 14px 0;vertical-align:top;border-bottom:1px solid #eee7e1;overflow-wrap:anywhere;word-break:break-word"><strong>${escapeHtml(item.name)}</strong>${item.option ? `<br><span style="font-size:12px;color:#71655e">${escapeHtml(item.option)}</span>` : ''}<br><span style="font-size:12px;color:#71655e">${money(item.unit_price)} each</span></td><td align="center" style="padding:14px 0;vertical-align:top;border-bottom:1px solid #eee7e1">${item.quantity}</td><td align="right" style="padding:14px 0;vertical-align:top;border-bottom:1px solid #eee7e1;white-space:nowrap">${item.amount}</td></tr>`).join('')}
</tbody></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px">${order.order_total != null ? summaryRow('Items subtotal', money(order.item_total)) : ''}${summaryRow('Delivery', delivery)}${summaryRow(totalLabel, total, true)}</table>
${order.order_total == null ? '<p style="font-size:12px;color:#71655e;margin:8px 0 0">Delivery and the final order total will be confirmed separately.</p>' : ''}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:18px;border-top:1px solid #eee7e1">${summaryRow('Payment status', payment)}${paymentMode ? summaryRow('Payment method', paymentMode) : ''}</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px"><tr><td bgcolor="#38271d" style="border-radius:6px;mso-padding-alt:14px 20px"><a href="${url}" style="display:inline-block;padding:14px 20px;color:#fff;font-weight:bold;text-decoration:none">${cta}</a></td></tr></table>
<p style="font-size:12px;color:#71655e;margin:22px 0 0">${admin ? 'Customer contact and delivery details are available in the admin order page.' : 'Need help with your order? Reply to this email and we’ll help.'}</p></td></tr>
<tr><td style="padding:18px 24px;border-top:1px solid #eee7e1;font-size:12px;color:#71655e">Daciana · Stationery &amp; Cosmetics${admin ? '<br>You’re receiving this operational alert as a Daciana admin.' : ''}</td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`,
  };
}
