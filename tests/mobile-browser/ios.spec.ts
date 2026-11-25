import { test, expect, type Page } from '@playwright/test';
import { CUSTOMER, tokenFor, userFor } from '../fixtures/admin-api.mjs';

declare global {
  interface Window {
    iosFixture: {
      cancelled: boolean;
      proof: { nonce: string; state: string } | null;
      channels: number;
      enabled: number;
      disabled: number;
      registrations: number;
    };
  }
}

test.beforeEach(async ({ page, request }) => {
  await request.get('http://127.0.0.1:54329/__reset');
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    const bridge = window as unknown as {
      Capacitor: unknown;
      CapacitorCustomPlatform: unknown;
      iosFixture: Window['iosFixture'];
    };
    const metrics: Window['iosFixture'] = {
      cancelled: false,
      proof: null,
      channels: 0,
      enabled: 0,
      disabled: 0,
      registrations: 0,
    };
    bridge.iosFixture = metrics;
    bridge.CapacitorCustomPlatform = { name: 'ios' };
    const callbacks = new Map<string, (value: unknown) => void>();
    const methods: Record<string, string[]> = {
      DacianaApple: ['authorize'],
      DacianaMessaging: ['enable', 'disable'],
      PushNotifications: [
        'checkPermissions',
        'requestPermissions',
        'register',
        'unregister',
        'createChannel',
        'removeAllDeliveredNotifications',
      ],
      SecureStorage: ['internalGetItem', 'internalSetItem', 'internalRemoveItem'],
      Network: ['getStatus'],
      App: ['getLaunchUrl'],
      SystemBars: ['setStyle'],
      SplashScreen: ['hide'],
      Keyboard: ['hide'],
      Browser: ['open', 'close'],
    };
    let sequence = 0;
    bridge.Capacitor = {
      PluginHeaders: Object.entries(methods).map(([name, names]) => ({
        name,
        methods: [
          ...names.map((name) => ({ name, rtype: 'promise' })),
          { name: 'addListener', rtype: 'callback' },
          { name: 'removeListener', rtype: 'promise' },
        ],
      })),
      nativeCallback(
        plugin: string,
        method: string,
        options: { eventName: string },
        callback: (value: unknown) => void,
      ) {
        if (method === 'addListener') callbacks.set(`${plugin}:${options.eventName}`, callback);
        return String(++sequence);
      },
      async nativePromise(plugin: string, method: string, options: Record<string, unknown> = {}) {
        if (plugin === 'SecureStorage') {
          if (method === 'internalGetItem')
            return { data: localStorage.getItem(String(options.prefixedKey)) };
          if (method === 'internalSetItem')
            localStorage.setItem(String(options.prefixedKey), String(options.data));
          if (method === 'internalRemoveItem') {
            localStorage.removeItem(String(options.prefixedKey));
            return { success: true };
          }
        }
        if (plugin === 'Network' && method === 'getStatus')
          return { connected: true, connectionType: 'wifi' };
        if (plugin === 'DacianaApple') {
          if (metrics.cancelled) throw { code: 'CANCELLED', message: 'Cancelled' };
          metrics.proof = options as { nonce: string; state: string };
          return {
            identityToken: 'fixture-apple-id-token',
            authorizationCode: 'fixture-single-use-code',
            fullName: 'Apple Customer',
          };
        }
        if (plugin === 'DacianaMessaging') {
          if (method === 'enable') metrics.enabled++;
          if (method === 'disable') metrics.disabled++;
        }
        if (plugin === 'PushNotifications') {
          if (method === 'checkPermissions') return { receive: 'prompt' };
          if (method === 'requestPermissions') return { receive: 'granted' };
          if (method === 'createChannel') metrics.channels++;
          if (method === 'register') {
            metrics.registrations++;
            setTimeout(
              () =>
                callbacks.get('PushNotifications:registration')?.({
                  value: 'ios-fcm-token-'.repeat(6),
                }),
              0,
            );
          }
        }
        return {};
      },
    };
  });
});

async function appleSession(page: Page) {
  const user = {
    ...userFor(CUSTOMER),
    app_metadata: { provider: 'apple', providers: ['apple'] },
    user_metadata: {} as Record<string, unknown>,
  };
  await page.route('**/auth/v1/user', async (route) => {
    if (route.request().method() === 'PUT')
      user.user_metadata = route.request().postDataJSON().data;
    await route.fulfill({ json: user });
  });
  let credentials: Record<string, unknown> | undefined;
  await page.route('**/auth/v1/token?grant_type=id_token', async (route) => {
    credentials = route.request().postDataJSON();
    await route.fulfill({
      json: {
        access_token: tokenFor(CUSTOMER),
        refresh_token: 'fixture-refresh',
        expires_in: 3600,
        token_type: 'bearer',
        user,
      },
    });
  });
  return { user, credentials: () => credentials };
}

test('iOS Apple sign-in uses a hashed nonce, saves the first name and returns to checkout', async ({
  page,
}) => {
  const session = await appleSession(page);
  await page.goto('/#/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/#/account?next=checkout');
  await page.getByRole('button', { name: 'Continue with Apple', exact: true }).click();
  await expect(page).toHaveURL(/#\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Shipping info', exact: true })).toBeVisible();
  const credentials = session.credentials()!;
  expect(credentials.provider).toBe('apple');
  expect(credentials.id_token).toBe('fixture-apple-id-token');
  const digest = await page.evaluate(async (nonce) => {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce));
    return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
  }, String(credentials.nonce));
  expect(await page.evaluate(() => window.iosFixture.proof?.nonce)).toBe(digest);
  expect(await page.evaluate(() => window.iosFixture.proof?.state)).toMatch(/^[a-f0-9]{64}$/);
  expect(session.user.user_metadata.full_name).toBe('Apple Customer');
});

test('iOS cancellation keeps the guest session and Apple deletion uses fresh proof without a password', async ({
  page,
}) => {
  const session = await appleSession(page);
  await page.goto('/#/account');
  await page.evaluate(() => {
    window.iosFixture.cancelled = true;
  });
  await page.getByRole('button', { name: 'Continue with Apple', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(session.credentials()).toBeUndefined();
  await page.evaluate(() => {
    window.iosFixture.cancelled = false;
  });
  await page.getByRole('button', { name: 'Continue with Apple', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  let deletion: Record<string, unknown> | undefined;
  await page.route('**/functions/v1/delete-account', async (route) => {
    deletion = route.request().postDataJSON();
    await route.fulfill({ json: { deleted: true } });
  });
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Password', { exact: true })).toHaveCount(0);
  await dialog.getByLabel('Type DELETE to confirm').fill('DELETE');
  await dialog.getByRole('button', { name: 'Confirm with Apple', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(deletion?.reauthentication).toBe('apple');
  expect(deletion?.authorizationCode).toBe('fixture-single-use-code');
  expect(deletion?.nonce).toMatch(/^[a-f0-9]{64}$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('daciana.auth.v1'))).toBeNull();
});

test('iOS guests register FCM tokens and disable messaging without Android channel calls', async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('https://dacianastore.in/api/push/devices', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': 'POST,DELETE,OPTIONS',
        },
      });
      return;
    }
    requests.push(route.request().postDataJSON());
    expect(route.request().headers().authorization).toBeUndefined();
    await route.fulfill({
      json: { registered: true, removed: true },
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  await page.goto('/#/more');
  const toggle = page.getByRole('switch', { name: /Push notifications/ });
  await toggle.click();
  await expect(toggle).toBeChecked();
  expect(requests[0].token).toBe('ios-fcm-token-'.repeat(6));
  expect(await page.evaluate(() => window.iosFixture.channels)).toBe(0);
  expect(await page.evaluate(() => window.iosFixture.enabled)).toBe(1);
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => window.iosFixture.disabled)).toBe(1);
  expect(requests.at(-1)?.token).toBeUndefined();
});
