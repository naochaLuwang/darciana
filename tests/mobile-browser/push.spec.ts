import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    pushFixture: {
      metrics: { prompts: number; registrations: number; unregistrations: number };
      grant: () => void;
      deny: () => void;
      tap: (path: string) => void;
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
      CapacitorCustomPlatform: unknown;
      Capacitor: unknown;
      pushFixture: Window['pushFixture'];
    };
    const callbacks = new Map<string, (value: unknown) => void>();
    let permission = 'prompt';
    let sequence = 0;
    const metrics = { prompts: 0, registrations: 0, unregistrations: 0 };
    bridge.CapacitorCustomPlatform = { name: 'android' };
    const methods: Record<string, string[]> = {
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
      App: ['getLaunchUrl', 'minimizeApp'],
      SystemBars: ['setStyle'],
      SplashScreen: ['hide'],
      Keyboard: ['hide'],
    };
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
        if (plugin === 'PushNotifications') {
          if (method === 'checkPermissions') return { receive: permission };
          if (method === 'requestPermissions') {
            metrics.prompts++;
            return { receive: permission };
          }
          if (method === 'register') {
            metrics.registrations++;
            setTimeout(
              () =>
                callbacks.get('PushNotifications:registration')?.({
                  value: 'test-fcm-token-'.repeat(5),
                }),
              0,
            );
          }
          if (method === 'unregister') metrics.unregistrations++;
        }
        return {};
      },
    };
    bridge.pushFixture = {
      metrics,
      grant: () => {
        permission = 'granted';
      },
      deny: () => {
        permission = 'denied';
      },
      tap: (path: string) =>
        callbacks.get('PushNotifications:pushNotificationActionPerformed')?.({
          notification: { data: { path } },
        }),
    };
  });
});

test('native notification opt-in, consent, tap routing and logout cleanup', async ({ page }) => {
  const requests: { method: string; body: Record<string, unknown>; bearer: string | undefined }[] =
    [];
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
    requests.push({
      method: route.request().method(),
      body: route.request().postDataJSON(),
      bearer: route.request().headers().authorization,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ registered: true, removed: true }),
    });
  });
  await page.goto('/#/account');
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'App navigation' })
    .getByRole('link', { name: 'More', exact: true })
    .click();
  const push = page.getByRole('switch', { name: /Push notifications/ });
  await expect(push).not.toBeChecked();
  expect(await page.evaluate(() => window.pushFixture.metrics.prompts)).toBe(0);
  await page.evaluate(() => window.pushFixture.deny());
  await push.click();
  await expect(page.getByRole('alert')).toContainText('Android Settings');
  expect(requests).toHaveLength(0);
  await page.evaluate(() => window.pushFixture.grant());
  await push.click();
  await expect(page.getByText('Notifications enabled.', { exact: true })).toBeVisible();
  expect(requests.at(-1)?.body.announcements).toBe(false);
  expect(requests.at(-1)?.bearer).toMatch(/^Bearer /);
  await page.getByRole('switch', { name: /Store announcements/ }).click();
  await expect(page.getByText('Notifications enabled.', { exact: true })).toBeVisible();
  expect(requests.at(-1)?.body.announcements).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/push-settings.png', fullPage: true });
  await page.evaluate(() => window.pushFixture.tap('/shop'));
  await expect(page).toHaveURL(/#\/shop$/);
  await page.evaluate(() => window.pushFixture.tap('/admin'));
  await expect(page).toHaveURL(/#\/account$/);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(requests.some((request) => request.method === 'DELETE')).toBe(true);
  expect(await page.evaluate(() => window.pushFixture.metrics.unregistrations)).toBeGreaterThan(0);
});
