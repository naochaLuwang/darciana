import 'server-only';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export function firebaseConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64);
}
export function firebaseMessaging() {
  const name = 'daciana-push';
  let app = getApps().find((value) => value.name === name);
  if (!app) {
    const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    if (!encoded) throw new Error('Firebase server credentials are not configured.');
    const account = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as ServiceAccount;
    app = initializeApp({ credential: cert(account) }, name);
  }
  return getMessaging(app);
}
