import { contentWriter } from '@/lib/store-content-server';
import { firebaseConfigured, firebaseMessaging } from '@/lib/firebase-server';
import { deliverPush } from '@/lib/push-delivery';
import { handleNewOrderPush } from '@/lib/order-push-handler';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const db = contentWriter();
    return await handleNewOrderPush(request, {
      db,
      secret: process.env.ORDER_PUSH_WEBHOOK_SECRET,
      send:
        db && firebaseConfigured() ? (input) => deliverPush(input, db, firebaseMessaging()) : null,
    });
  } catch {
    return Response.json(
      { error: 'Order notifications are unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
