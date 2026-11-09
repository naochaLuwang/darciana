import 'server-only';
import { contentWriter } from './store-content-server';
import { firebaseConfigured, firebaseMessaging } from './firebase-server';
import { deliverPush, type PushDelivery, type PushResult } from './push-delivery';

// Call only after verifying the admin session (never trust a client-provided role).
export async function sendAdminPush(input: PushDelivery): Promise<PushResult> {
  const db = contentWriter();
  if (!db || !firebaseConfigured())
    return { error: 'Configure Firebase and Supabase server credentials first.' };
  try {
    return await deliverPush(input, db, firebaseMessaging());
  } catch {
    return { error: 'Firebase could not be reached. Check the server configuration.' };
  }
}
