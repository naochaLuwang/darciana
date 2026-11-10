import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { orderEmail, orderEmailStatuses, type EmailOrder } from './order-email.ts';
import type { TransactionalEmail, EmailSendResult } from './resend.ts';

type Dependencies = {
  db: SupabaseClient | null;
  secret: string | undefined;
  send: ((email: TransactionalEmail) => Promise<EmailSendResult>) | null;
};
const schema = z.object({ order_id: z.uuid(), status: z.enum(orderEmailStatuses) }).strict();
export async function handleOrderEmail(request: Request, { db, secret, send }: Dependencies) {
  const reply = (body: object, status = 200) =>
    Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
  if (!secret || !/^[a-f0-9]{64}$/.test(secret))
    return reply({ error: 'Order email is not configured.' }, 503);
  const token = request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || !timingSafeEqual(Buffer.from(token), Buffer.from(secret)))
    return reply({ error: 'Unauthorized.' }, 401);
  if (!db || !send) return reply({ error: 'Order email is not configured.' }, 503);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply({ error: 'JSON required.' }, 415);
  const text = await request.text();
  if (text.length > 1000) return reply({ error: 'Request too large.' }, 413);
  let parsed;
  try {
    parsed = schema.safeParse(JSON.parse(text));
  } catch {
    return reply({ error: 'Invalid request.' }, 400);
  }
  if (!parsed.success) return reply({ error: 'Invalid request.' }, 400);
  const lookup = await db
    .from('storefront_order_requests')
    .select('id,user_id,status,items,item_total,shipping_price,order_total')
    .eq('id', parsed.data.order_id)
    .maybeSingle();
  if (lookup.error) return reply({ error: 'Order lookup failed.' }, 503);
  if (!lookup.data) return reply({ error: 'Order not found.' }, 404);
  if (lookup.data.status !== parsed.data.status)
    return reply({ received: true, skipped: 'superseded' });
  const order = lookup.data as EmailOrder & { user_id: string | null };
  const eventKey = `order-email/${order.id}/${order.status}`;
  const claim = await db
    .from('storefront_email_deliveries')
    .insert({ event_key: eventKey, order_id: order.id, order_status: order.status })
    .select('id')
    .single();
  if (claim.error?.code === '23505') return reply({ received: true, duplicate: true });
  if (claim.error) return reply({ error: 'Email history is unavailable.' }, 503);
  const finish = async (values: Record<string, unknown>) =>
    db.from('storefront_email_deliveries').update(values).eq('id', claim.data.id);
  try {
    const recipient = order.user_id ? await db.auth.admin.getUserById(order.user_id) : null;
    if (recipient?.error) throw new Error('Account lookup failed');
    const user = recipient?.data.user;
    if (!user?.email_confirmed_at || !z.email().safeParse(user.email).success) {
      const log = await finish({ status: 'skipped', failure_reason: 'no_verified_email' });
      return log.error
        ? reply({ error: 'Email history is unavailable.' }, 503)
        : reply({ received: true, skipped: 'no_verified_email' });
    }
    const result = await send({ ...orderEmail(order), to: user.email!, eventKey });
    const log = await finish({
      status: result.error ? 'failed' : 'sent',
      provider_id: result.id ?? null,
      failure_reason: result.error ?? null,
    });
    return result.error || log.error
      ? reply({ error: 'Order email could not be completed.' }, 503)
      : reply({ received: true, sent: true });
  } catch {
    await finish({ status: 'failed', failure_reason: 'sending_failed' });
    return reply({ error: 'Order email could not be completed.' }, 503);
  }
}
