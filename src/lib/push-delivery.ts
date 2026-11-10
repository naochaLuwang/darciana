import type { SupabaseClient } from '@supabase/supabase-js';
import type { Messaging } from 'firebase-admin/messaging';
import { pushError } from './push.ts';

export type PushDelivery = {
  eventKey: string;
  actorId: string | null;
  audience: 'announcements' | 'order' | 'admin_order';
  userId?: string;
  orderId?: string;
  title: string;
  body: string;
  path: string;
};
export type PushResult = {
  error?: string;
  success?: string;
  sent?: number;
  failed?: number;
  duplicate?: boolean;
};
export async function deliverPush(
  input: PushDelivery,
  db: SupabaseClient,
  messaging: Pick<Messaging, 'sendEachForMulticast'>,
): Promise<PushResult> {
  if (input.audience === 'order' && !input.userId) return { error: 'Customer not found.' };
  if (input.audience === 'admin_order' && !input.orderId) return { error: 'Order not found.' };
  // Claim the event before contacting FCM. Retrying an admin action cannot resend it.
  const claim = await db
    .from('storefront_push_deliveries')
    .insert({
      event_key: input.eventKey,
      created_by: input.actorId,
      audience: input.audience,
      title: input.title,
      body: input.body,
      path: input.path,
    })
    .select('id')
    .single();
  if (claim.error)
    return {
      duplicate: claim.error.code === '23505',
      error:
        claim.error.code === '23505'
          ? 'This notification was already requested. Check sending history.'
          : pushError(claim.error),
    };
  let sent = 0;
  let failed = 0;
  let sendError = false;
  try {
    // Stable keyset pagination avoids the Data API row limit and stale offsets.
    let cursor: string | undefined;
    for (;;) {
      let lookup;
      if (input.audience === 'admin_order') {
        // This service-only RPC joins the private admin registry at send time.
        // Client roles, metadata and announcement opt-in never grant admin alerts.
        lookup = await db.rpc('storefront_admin_push_devices', {
          p_after: cursor ?? null,
          p_limit: 500,
        });
      } else {
        let query = db.from('storefront_push_devices').select('id,token').order('id').limit(500);
        query =
          input.audience === 'announcements'
            ? query.eq('announcements', true)
            : query.eq('user_id', input.userId!);
        if (cursor) query = query.gt('id', cursor);
        lookup = await query;
      }
      const { data: devices, error } = lookup as {
        data: { id: string; token: string }[] | null;
        error: { code?: string } | null;
      };
      if (error) throw new Error('Device lookup failed');
      if (!devices?.length) break;
      const result = await messaging.sendEachForMulticast({
        tokens: devices.map((device) => device.token),
        notification: { title: input.title, body: input.body },
        data: {
          path: input.path,
          notification_id: claim.data.id,
          ...(input.audience === 'admin_order'
            ? { kind: 'admin_order', order_id: input.orderId! }
            : {}),
        },
        android: {
          priority: 'high',
          ttl: 24 * 60 * 60 * 1000,
          notification: {
            channelId:
              input.audience === 'admin_order'
                ? 'admin_orders'
                : input.audience === 'order'
                  ? 'orders'
                  : 'announcements',
            icon: 'ic_stat_daciana',
            color: '#38271d',
          },
        },
      });
      sent += result.successCount;
      failed += result.failureCount;
      const invalid = result.responses.flatMap((response, index) =>
        [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token',
        ].includes(response.error?.code ?? '')
          ? [devices[index].token]
          : [],
      );
      if (invalid.length) {
        // Match the failed token, so a concurrently refreshed registration stays safe.
        const cleanup = await db.from('storefront_push_devices').delete().in('token', invalid);
        if (cleanup.error) console.error('Expired push token cleanup failed:', cleanup.error.code);
      }
      cursor = devices.at(-1)!.id;
      if (devices.length < 500) break;
    }
  } catch {
    sendError = true;
  }
  const status = sendError
    ? 'failed'
    : failed
      ? sent
        ? 'partial'
        : 'failed'
      : sent
        ? 'sent'
        : 'empty';
  const log = await db
    .from('storefront_push_deliveries')
    .update({ status, success_count: sent, failure_count: failed })
    .eq('id', claim.data.id);
  if (sendError || log.error)
    return {
      error: 'Sending could not finish. Check notification history before trying again.',
      sent,
      failed,
    };
  return {
    success:
      sent || failed
        ? `Sent to ${sent} device${sent === 1 ? '' : 's'}${failed ? `; ${failed} failed` : ''}.`
        : 'No eligible devices are registered yet.',
    sent,
    failed,
  };
}
