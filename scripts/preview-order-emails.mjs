import { mkdir, writeFile } from 'node:fs/promises';
import { orderEmail } from '../src/lib/order-email.ts';

// Synthetic snapshots only. No credentials, network calls or real customer data.
const order = {
  id: '33333333-3333-4333-8333-333333333333',
  status: 'processing',
  created_at: '2026-11-25T08:30:00Z',
  payment_status: 'unpaid',
  shipping: { payment_mode: 'cash_on_delivery' },
  items: [
    {
      name: 'Colors Queen Cushion Foundation',
      option: 'Shade 03 · Natural Beige',
      quantity: 2,
      unit_price: 399,
    },
    { name: 'Everyday Notebook', option: null, quantity: 1, unit_price: 120 },
  ],
  item_total: 918,
  shipping_price: 50,
  order_total: 968,
};
const directory = new URL('../artifacts/emails/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const [name, snapshot, audience] of [
  ['customer-processing', order, 'customer'],
  ['admin-new-order', { ...order, status: 'awaiting_confirmation' }, 'admin'],
  ['customer-delivered', { ...order, status: 'delivered', payment_status: 'paid' }, 'customer'],
  ['customer-unconfirmed-total', { ...order, shipping_price: null, order_total: null }, 'customer'],
]) {
  const email = orderEmail(snapshot, audience);
  await writeFile(new URL(`${name}.html`, directory), email.html);
  await writeFile(new URL(`${name}.txt`, directory), `${email.subject}\n\n${email.text}\n`);
}
console.log(
  'Created four local HTML/plain-text email previews in artifacts/emails. No emails sent.',
);
