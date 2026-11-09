import { contentWriter } from '@/lib/store-content-server';
import { handlePushDevice } from '@/lib/push-device-handler';
export const runtime = 'nodejs';
async function handle(request: Request) {
  try {
    return await handlePushDevice(request, contentWriter());
  } catch {
    return Response.json(
      { error: 'Notifications are unavailable. Please try again.' },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': 'https://localhost',
        },
      },
    );
  }
}
export { handle as POST, handle as DELETE, handle as OPTIONS };
