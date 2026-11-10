import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushDelivery, PushResult } from './push-delivery.ts';
import { adminOrderPath } from './push.ts';
import { money } from './money.ts';

type Dependencies = {
  db: SupabaseClient | null;
  secret: string | undefined;
  send: ((input: PushDelivery) => Promise<PushResult>) | null;
};
const bodySchema = z.object({ order_id: z.uuid() }).strict();
export async function handleNewOrderPush(request: Request, { db, secret, send }: Dependencies) {
  const reply = (body: object, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  if (!secret || !/^[a-f0-9]{64}$/.test(secret))
    return reply({ error: 'Order notifications are not configured.' }, 503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || !timingSafeEqual(Buffer.from(token), Buffer.from(secret)))
    return reply({ error: 'Unauthorized.' }, 401);
  if (!db || !send) return reply({ error: 'Order notifications are not configured.' }, 503);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ error: 'JSON required.' }, 415);
  const text = await request.text();
  if (text.length > 1000) return reply({ error: 'Request too large.' }, 413);
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(text));
  } catch {
    return reply({ error: 'Invalid request.' }, 400);
  }
  if (!parsed.success) return reply({ error: 'Invalid request.' }, 400);
  const order = await db
    .from('storefront_order_requests')
    .select('id,order_total,item_total')
    .eq('id', parsed.data.order_id)
    .maybeSingle();
  if (order.error) return reply({ error: 'Order lookup failed.' }, 503);
  if (!order.data) return reply({ error: 'Order not found.' }, 404);
  try {
    const result = await send({
      eventKey: `new-order:${order.data.id}`,
      actorId: null,
      audience: 'admin_order',
      orderId: order.data.id,
      title: 'New Daciana order',
      body: `Order #${order.data.id.slice(0, 8).toUpperCase()} · ${money(Number(order.data.order_total ?? order.data.item_total))}`,
      path: adminOrderPath(order.data.id)!,
    });
    if (result.duplicate) return reply({ received: true, duplicate: true });
    return result.error
      ? reply({ error: 'Order notification could not be sent.' }, 503)
      : reply({ received: true, sent: result.sent ?? 0, failed: result.failed ?? 0 });
  } catch {
    return reply({ error: 'Order notification could not be sent.' }, 503);
  }
}
