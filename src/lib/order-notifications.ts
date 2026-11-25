import type { SupabaseClient } from '@supabase/supabase-js';
import type { PushDelivery, PushResult } from './push-delivery.ts';
import { orderPush } from './push.ts';

// Call after a successful, authorized mutation. Recipients always come from the saved order.
export async function notifyOrderChange(
  input: { orderId: string; status: string; actorId: string },
  db: SupabaseClient,
  send: (notification: PushDelivery) => Promise<PushResult>,
): Promise<PushResult> {
  try {
    const { data: order, error } = await db
      .from('storefront_order_requests')
      .select('user_id,status')
      .eq('id', input.orderId)
      .single();
    if (error || !order?.user_id) return { error: 'Customer notification is unavailable.' };
    if (order.status !== input.status)
      return {
        success: 'A newer status has already been saved; the older notification was skipped.',
      };
    const message = orderPush(input.status);
    if (!message) return { error: 'Customer notification is unavailable.' };
    const notification = await send({
      ...message,
      audience: 'order',
      actorId: input.actorId,
      userId: order.user_id,
      eventKey: `order:${input.orderId}:${input.status}`,
    });
    return notification.duplicate
      ? { success: 'Customer notification was already requested.' }
      : notification;
  } catch {
    return { error: 'Customer notification could not be confirmed. Check notification history.' };
  }
}
