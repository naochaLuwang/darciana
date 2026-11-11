import { test, expect, type Page } from '@playwright/test';
import { checkProductGalleries } from '../fixtures/product-gallery';

test.beforeEach(async ({ request, page }) => {
  await request.get('http://127.0.0.1:54329/__reset');
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('product galleries show every product photo and isolate selected variant photos', async ({
  page,
  request,
}) => {
  await checkProductGalleries(page, request, true);
});

async function signIn(page: Page, email = 'customer@example.com') {
  await page.goto('/#/account');
  await page.getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
}

test('bundled storefront navigation, search and information pages run without a Next server', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello there', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'App navigation' });
  await expect(nav.getByRole('link')).toHaveText([
    'Home',
    'Categories',
    'Saved',
    'Profile',
    'More',
  ]);
  await nav.getByRole('link', { name: 'More', exact: true }).click();
  await expect(page).toHaveURL(/#\/more$/);
  await expect(page.getByText('Designed & developed by')).toBeVisible();
  await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Privacy fixture content.');
  await page.goto('/#/shop?q=rose');
  await expect(page.getByRole('heading', { name: 'Rose lip tint', exact: true })).toBeVisible();
  await page.goto('/#/admin');
  await expect(page.getByRole('heading', { name: /not found|couldn.t find/i })).toBeVisible();
});

test('profile, address book and COD checkout use the shared database actions', async ({
  page,
  context,
}) => {
  let submissions = 0;
  page.on('request', (request) => {
    if (request.url().includes('/rpc/storefront_submit_order')) submissions += 1;
  });
  await signIn(page);
  await page.getByLabel('Full name', { exact: true }).fill('Native Customer');
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await page.goto('/#/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/#/checkout');
  const order = page.getByRole('button', { name: 'Confirm and order', exact: true });
  await expect(order).toBeEnabled();
  await order.click();
  const location = page.getByRole('button', { name: 'Select delivery address', exact: true });
  const area = page.getByRole('combobox', { name: 'Shipping area', exact: true });
  const terms = page.getByRole('checkbox', { name: 'I accept the terms and conditions' });
  await expect(location).toHaveAttribute('data-invalid', 'true');
  await expect(location).toBeFocused();
  await expect(area).toHaveAttribute('aria-invalid', 'true');
  await expect(terms).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Select a delivery location.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await page.getByLabel('Street address', { exact: true }).fill('28 Garden Street');
  await page.getByLabel('City', { exact: true }).fill('Imphal');
  await page.getByLabel('State', { exact: true }).fill('Manipur');
  await page.getByLabel('PIN code', { exact: true }).fill('795001');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(location).not.toHaveAttribute('data-invalid', 'true');
  await order.click();
  await expect(area).toBeFocused();
  await expect(page.getByText('Select a shipping area.', { exact: true })).toBeVisible();
  await area.fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await expect(
    page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }),
  ).toBeChecked();
  await expect(area).not.toHaveAttribute('aria-invalid', 'true');
  await order.click();
  await expect(terms).toBeFocused();
  await expect(page.getByText('Accept the terms and conditions.', { exact: true })).toBeVisible();
  await terms.check();
  await expect(page.locator('.checkout-field-error')).toHaveCount(0);
  expect(submissions).toBe(0);
  await context.setOffline(true);
  await expect(page.locator('.native-offline')).toBeVisible();
  await order.click();
  await expect(page.getByRole('alert')).toHaveText(
    'Reconnect before placing your order. Your bag is saved.',
  );
  await expect(page.getByRole('heading', { name: 'Order received', exact: true })).toHaveCount(0);
  expect(submissions).toBe(0);
  await context.setOffline(false);
  await expect(page.locator('.native-offline')).toHaveCount(0);
  await order.click();
  await expect(page.getByRole('heading', { name: 'Order received', exact: true })).toBeVisible();
  expect(submissions).toBe(1);
  await expect(page.getByText(/Total ₹349/)).toBeVisible();
  await page.getByRole('link', { name: 'View orders', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Native Customer');
  await page.getByRole('link', { name: /Saved addresses/ }).click();
  await expect(page.getByRole('article').first()).toContainText('28 Garden Street');
  await page.goto('/#/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await signIn(page, 'owner@example.com');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('');
});

test('Google PKCE returns to checkout, keeps the bag and handles a rejected sign-in', async ({
  page,
  request,
}) => {
  await page.goto('/#/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/#/account?next=checkout');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page).toHaveURL(/\/#\/checkout$/);
  await expect(page.getByRole('heading', { name: 'Shipping info', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Price details', exact: true })).toContainText(
    'Items (1)',
  );
  await page.goto('/#/account');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await request.get('http://127.0.0.1:54329/__oauth/deny');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(
    page.getByText('Google sign-in wasn’t completed. Please try again.', { exact: true }),
  ).toBeVisible();
});

test('offline bag persists and signed-in customers can clear their session offline', async ({
  page,
  context,
}) => {
  await signIn(page);
  await page.goto('/#/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/#/account');
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  await context.setOffline(true);
  await expect(
    page.getByText('You’re offline. Your bag is saved on this device.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('daciana.auth.v1'))).toBeNull();
  await context.setOffline(false);
  await page.goto('/#/bag');
  await expect(page.getByText('Rose lip tint', { exact: true })).toBeVisible();
  await page.goto('/#/checkout');
  await expect(
    page.getByRole('heading', { name: 'Sign in to checkout', exact: true }),
  ).toBeVisible();
});

test('each customer route shows its matching skeleton while data loads', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await signIn(page);
  let release: () => void = () => {};
  let gate = Promise.resolve();
  await page.route('**/rest/v1/**', async (route) => {
    await gate;
    await route.continue();
  });
  const screens = [
    ['/', 'home'],
    ['/categories', 'categories'],
    ['/shop', 'shop'],
    ['/saved', 'saved'],
    ['/product/rose-lip-tint', 'product'],
    ['/bag', 'bag'],
    ['/checkout', 'checkout'],
    ['/account', 'account'],
    ['/account/addresses', 'addresses'],
    ['/more', 'more'],
    ['/more/privacy-policy', 'information'],
  ];
  try {
    for (const [path, screen] of screens) {
      gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.goto(`/#${path}`);
      // A hash-only navigation can use the warm catalog cache. Reload to test
      // the actual data-wait state for each destination independently.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const skeleton = page.locator(`[data-skeleton="${screen}"]`);
      await expect(skeleton).toBeVisible();
      await expect(skeleton).toHaveAttribute('aria-busy', 'true');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        await skeleton
          .locator('.skeleton-shape')
          .first()
          .evaluate((element) => getComputedStyle(element).animationName),
      ).toBe('none');
      const labelSize = await skeleton.getByText(/^Loading /).evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      });
      expect(labelSize.width).toBeLessThanOrEqual(1);
      expect(labelSize.height).toBeLessThanOrEqual(1);
      if (['home', 'checkout', 'product'].includes(screen))
        await page.screenshot({
          path: `test-results/skeleton-${screen}-mobile.png`,
          fullPage: true,
        });
      release();
      await expect(page.locator('[data-skeleton]')).toHaveCount(0);
    }
  } finally {
    release();
  }
});
