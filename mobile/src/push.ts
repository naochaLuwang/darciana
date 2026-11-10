import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { PushNotifications } from '@capacitor/push-notifications';
import { z } from 'zod';
import { notificationPath, adminOrderPath } from '@/lib/push';
import { supabase } from './supabase';
import { authStorage } from './storage';
import { navigateApp, notify } from './navigation';
import { refreshScreens } from './query';

const storageKey = 'daciana.push.v1';
const preferencesSchema = z.object({
  id: z.uuid(),
  secret: z.string().regex(/^[0-9a-f]{64}$/),
  enabled: z.boolean(),
  announcements: z.boolean(),
  owner: z.uuid().nullable(),
  registered: z.boolean(),
});
export type PushPreferences = z.infer<typeof preferencesSchema>;
let listeners: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();
let registration: { resolve: (token: string) => void; reject: (error: Error) => void } | null =
  null;
let readingPreferences: Promise<PushPreferences> | undefined;

const supported = () => Capacitor.getPlatform() === 'android';
const changed = () => window.dispatchEvent(new Event('daciana:push-changed'));
function serial<T>(operation: () => Promise<T>): Promise<T> {
  const task = queue.then(operation, operation);
  queue = task.catch(() => {});
  return task;
}
export function getPushPreferences(): Promise<PushPreferences> {
  readingPreferences ??= readPreferences().finally(() => {
    readingPreferences = undefined;
  });
  return readingPreferences;
}
async function readPreferences(): Promise<PushPreferences> {
  const raw = await authStorage.getItem(storageKey);
  let parsed;
  try {
    parsed = preferencesSchema.safeParse(raw ? JSON.parse(raw) : null);
  } catch {
    parsed = null;
  }
  if (parsed?.success) return parsed.data;
  const next: PushPreferences = {
    id: crypto.randomUUID(),
    secret: [...crypto.getRandomValues(new Uint8Array(32))]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join(''),
    enabled: false,
    announcements: false,
    owner: null,
    registered: false,
  };
  await save(next);
  return next;
}
async function save(preferences: PushPreferences) {
  await authStorage.setItem(storageKey, JSON.stringify(preferences));
  changed();
}
async function deviceRequest(
  method: 'POST' | 'DELETE',
  preferences: PushPreferences,
  token?: string,
) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (method === 'POST' && preferences.owner) {
    const { data } = await supabase.auth.getSession();
    if (!data.session || data.session.user.id !== preferences.owner)
      throw new Error('Sign in again to link account notifications.');
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }
  const base = import.meta.env.VITE_API_URL || 'https://dacianastore.in';
  const response = await fetch(new URL('/api/push/devices', base), {
    method,
    headers,
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      id: preferences.id,
      secret: preferences.secret,
      ...(method === 'POST' ? { token, announcements: preferences.announcements } : {}),
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(result?.error ?? 'Notifications are unavailable. Please try again.');
}
async function ensureListeners() {
  listeners ??= (async () => {
    await PushNotifications.addListener('registration', ({ value }) => {
      if (registration) registration.resolve(value);
      // Token refresh events outside an explicit registration also update the server.
      else
        void serial(async () => {
          const preferences = await getPushPreferences();
          if (!preferences.enabled) return;
          await deviceRequest('POST', preferences, value);
          await save({ ...preferences, registered: true });
        }).catch(() => {});
    });
    await PushNotifications.addListener('registrationError', () =>
      registration?.reject(
        new Error(
          'This device could not register for notifications. Check Google Play services and try again.',
        ),
      ),
    );
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      async ({ notification }) => {
        if (notification.data?.kind === 'admin_order') {
          const path = adminOrderPath(notification.data.order_id);
          if (!path) return;
          try {
            const { data, error } = await supabase.rpc('storefront_is_admin');
            if (error || data !== true) {
              navigateApp('/account');
              return;
            }
            await Browser.open({ url: new URL(path, 'https://dacianastore.in').href });
          } catch {
            notify('Reconnect to open this order.');
            navigateApp('/account');
          }
          return;
        }
        const path = notificationPath(notification.data?.path);
        refreshScreens();
        navigateApp(path ?? '/account');
      },
    );
    await PushNotifications.addListener('pushNotificationReceived', () => {
      refreshScreens();
    });
    await PushNotifications.createChannel({
      id: 'orders',
      name: 'Order updates',
      importance: 4,
      visibility: 0,
      description: 'Updates about your orders',
    });
    await PushNotifications.createChannel({
      id: 'admin_orders',
      name: 'New orders',
      importance: 4,
      visibility: 0,
      description: 'New customer orders for store admins',
    });
    await PushNotifications.createChannel({
      id: 'announcements',
      name: 'Store announcements',
      importance: 3,
      visibility: 0,
      description: 'Offers, new arrivals and store news',
    });
  })().catch((error) => {
    listeners = undefined;
    throw error;
  });
  await listeners;
}
async function register(preferences: PushPreferences) {
  await ensureListeners();
  const token = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      registration = null;
      reject(new Error('Registration timed out. Please try again.'));
    }, 20000);
    registration = {
      resolve: (value) => {
        clearTimeout(timeout);
        registration = null;
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        registration = null;
        reject(error);
      },
    };
    void PushNotifications.register().catch(() =>
      registration?.reject(new Error('Notifications could not be enabled.')),
    );
  });
  // Mark as pending before the request: a network timeout may still save remotely.
  await save({ ...preferences, registered: true });
  await deviceRequest('POST', preferences, token);
}
async function disable(preferences: PushPreferences) {
  const next = { ...preferences, enabled: false, owner: null };
  await save(next);
  // Invalidate FCM locally as well as revoking the server association.
  await PushNotifications.unregister().catch(() => {});
  await PushNotifications.removeAllDeliveredNotifications().catch(() => {});
  if (preferences.registered) {
    await deviceRequest('DELETE', preferences);
    next.registered = false;
    await save(next);
  }
}
export function disablePush() {
  return serial(async () => {
    if (supported()) await disable(await getPushPreferences());
  });
}
export function detachPushAccount() {
  return serial(async () => {
    if (!supported()) return;
    const preferences = await getPushPreferences();
    if (!preferences.owner) return;
    // Invalidate the old private token before retaining the guest opt-in. A
    // failed revocation stays pending and is retried after reconnection.
    try {
      await disable(preferences);
    } finally {
      const current = await getPushPreferences();
      await save({ ...current, enabled: preferences.enabled, owner: null });
    }
  });
}
export function enablePush(announcements: boolean) {
  return serial(async () => {
    if (!supported()) throw new Error('Push notifications are available in the Android app.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error('Could not read notification preferences. Please try again.');
    let permission = await PushNotifications.checkPermissions();
    if (permission.receive !== 'granted') permission = await PushNotifications.requestPermissions();
    if (permission.receive !== 'granted')
      throw new Error('Allow notifications in Android Settings → Apps → Daciana → Notifications.');
    const preferences = await getPushPreferences();
    const next = {
      ...preferences,
      enabled: true,
      announcements,
      owner: data.session?.user.id ?? null,
    };
    try {
      await register(next);
      await save({ ...next, registered: true });
    } catch (error) {
      await save({ ...next, enabled: false, registered: true });
      await PushNotifications.unregister().catch(() => {});
      await deviceRequest('DELETE', next).catch(() => {});
      throw error;
    }
  });
}
export function restorePush(userId: string | null) {
  return serial(async () => {
    if (!supported()) return;
    await ensureListeners();
    const preferences = await getPushPreferences();
    if (!preferences.enabled) {
      if (preferences.registered) await disable(preferences);
      return;
    }
    if ((await PushNotifications.checkPermissions()).receive !== 'granted') {
      await disable(preferences);
      return;
    }
    let next = preferences;
    if (preferences.owner !== userId) {
      if (preferences.owner) await disable(preferences).catch(() => {});
      next = { ...(await getPushPreferences()), enabled: true, owner: userId };
      await save(next);
    }
    await register(next);
    await save({ ...next, registered: true });
  }).catch(() => {
    /* Retry on the next app resume or network reconnection. */
  });
}
export function pushUnavailableNotice() {
  notify('Notification preferences are saved on this device. Reconnect to finish updating them.');
}
