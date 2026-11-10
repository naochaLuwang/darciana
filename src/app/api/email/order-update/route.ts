import { contentWriter } from '@/lib/store-content-server';
import { resendConfig, sendOrderEmail } from '@/lib/resend-server';
import { handleOrderEmail } from '@/lib/order-email-handler';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    return await handleOrderEmail(request, {
      db: contentWriter(),
      secret: process.env.ORDER_PUSH_WEBHOOK_SECRET,
      send: resendConfig() ? sendOrderEmail : null,
    });
  } catch {
    return Response.json(
      { error: 'Order email is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
