import { timingSafeEqual } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
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
    .select('*')
    .eq('id', parsed.data.order_id)
    .maybeSingle();
  if (lookup.error) return reply({ error: 'Order lookup failed.' }, 503);
  if (!lookup.data) return reply({ error: 'Order not found.' }, 404);
  if (lookup.data.status !== parsed.data.status)
    return reply({ received: true, skipped: 'superseded' });
  const order = lookup.data as EmailOrder & { user_id: string | null };
  const database = db;
  const sendEmail = send;
  type Outcome = 'sent' | 'failed' | 'duplicate' | 'no_verified_email';
  type Recipient = { user_id: string; email: string };
  async function deliver(audience: 'customer' | 'admin', admin?: Recipient): Promise<Outcome> {
    // Keep the original customer key so upgrading cannot resend old receipts.
    const eventKey =
      audience === 'customer'
        ? `order-email/${order.id}/${order.status}`
        : `order-email-admin/${order.id}/${order.status}/${admin!.user_id}`;
    let claimId: string | undefined;
    const finish = (values: Record<string, unknown>) =>
      database.from('storefront_email_deliveries').update(values).eq('id', claimId!);
    try {
      const claim = await database
        .from('storefront_email_deliveries')
        .insert({
          event_key: eventKey,
          order_id: order.id,
          order_status: order.status,
          audience,
          recipient_id: admin?.user_id ?? order.user_id,
        })
        .select('id')
        .single();
      if (claim.error?.code === '23505') return 'duplicate';
      if (claim.error || !claim.data) return 'failed';
      claimId = claim.data.id;
      let email = admin?.email;
      if (audience === 'customer') {
        const recipient = order.user_id
          ? await database.auth.admin.getUserById(order.user_id)
          : null;
        if (recipient?.error) throw new Error('Account lookup failed');
        email = recipient?.data.user?.email_confirmed_at ? recipient.data.user.email : undefined;
      }
      if (!z.email().safeParse(email).success) {
        const log = await finish({ status: 'skipped', failure_reason: 'no_verified_email' });
        return log.error ? 'failed' : 'no_verified_email';
      }
      const result = await sendEmail({ ...orderEmail(order, audience), to: email!, eventKey });
      const log = await finish({
        status: result.error ? 'failed' : 'sent',
        provider_id: result.id ?? null,
        failure_reason: result.error ?? null,
      });
      return result.error || log.error ? 'failed' : 'sent';
    } catch {
      if (claimId) {
        await Promise.resolve(finish({ status: 'failed', failure_reason: 'sending_failed' })).catch(
          () => null,
        );
      }
      return 'failed';
    }
  }
  // Recipient discovery failures must not prevent the customer receipt.
  let adminLookupFailed = false;
  const lookupAdmins = await database.rpc('storefront_order_email_admins').then(
    (result) => {
      const parsed = z
        .array(z.object({ user_id: z.uuid(), email: z.string() }))
        .safeParse(result.data);
      if (result.error || !parsed.success) {
        adminLookupFailed = true;
        return [];
      }
      return [...new Map(parsed.data.map((recipient) => [recipient.user_id, recipient])).values()];
    },
    () => {
      adminLookupFailed = true;
      return [];
    },
  );
  const tasks = [
    () => deliver('customer'),
    ...lookupAdmins.map((admin) => () => deliver('admin', admin)),
  ];
  const outcomes: Outcome[] = [];
  // Each recipient gets a private message and independent history. Limit bursts
  // within this webhook. Other concurrent webhooks share the provider quota.
  for (let offset = 0; offset < tasks.length; offset += 2) {
    if (offset) await setTimeout(1000);
    outcomes.push(...(await Promise.all(tasks.slice(offset, offset + 2).map((task) => task()))));
  }
  const counts = (values: Outcome[]) => ({
    sent: values.filter((value) => value === 'sent').length,
    failed: values.filter((value) => value === 'failed').length,
    duplicate: values.filter((value) => value === 'duplicate').length,
    skipped: values.filter((value) => value === 'no_verified_email').length,
  });
  const failed = adminLookupFailed || outcomes.includes('failed');
  return reply(
    {
      received: true,
      sent: outcomes.includes('sent'),
      duplicate: !failed && outcomes.every((value) => value === 'duplicate'),
      ...(outcomes[0] === 'no_verified_email' ? { skipped: 'no_verified_email' } : {}),
      customer: outcomes[0],
      admins: { ...counts(outcomes.slice(1)), lookupFailed: adminLookupFailed },
      ...(failed ? { error: 'Some order emails could not be completed.' } : {}),
    },
    failed ? 503 : 200,
  );
}
