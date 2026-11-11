import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { OWNER, tokenFor } from '../fixtures/admin-api.mjs';

const productId = '33333333-3333-4333-8333-333333333333';
const variantId = '44444444-4444-4444-8444-444444444444';
const cartKey = 'darciana.bag.v1';

test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:54329/__reset');
});

async function setStock(request: APIRequestContext, stock: number) {
  const [product] = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  const result = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_stock',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: {
        p_variant_id: variantId,
        p_stock: stock,
        p_expected_updated_at: product.product_variants[0].updated_at,
      },
    },
  );
  expect(result.ok()).toBe(true);
}

async function seedBag(page: Page, quantity = 1, missing = false) {
  await page.addInitScript(
    ({ cartKey, productId, variantId, quantity, missing }) => {
      localStorage.setItem(
        cartKey,
        JSON.stringify([
          { productId, variantId, quantity },
          ...(missing
            ? [{ productId: 'deleted-product', variantId: 'deleted-variant', quantity: 1 }]
            : []),
        ]),
      );
    },
    { cartKey, productId, variantId, quantity, missing },
  );
  await page.goto('/#/bag');
  await expect(page.locator('.bag-item').first()).toBeVisible();
}

test('sold-out items show their status inside the card and block both checkout controls', async ({
  page,
  request,
}) => {
  await setStock(request, 0);
  await seedBag(page);
  const card = page.locator('.bag-item');
  await expect(card.getByRole('status')).toHaveText('Out of stock');
  await expect(card).not.toContainText('Only 0');
  await expect(page.locator('.notice')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Continue to checkout' })).toHaveCount(0);
  const buttons = page.getByRole('button', { name: 'Continue to checkout', includeHidden: true });
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) await expect(button).toBeDisabled();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.order-summary button')).toBeDisabled();
  await card.getByRole('button', { name: 'Remove Rose lip tint', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
});

test('reducing an excessive quantity enables checkout after stock falls', async ({
  page,
  request,
}) => {
  await setStock(request, 2);
  await seedBag(page, 3);
  await expect(page.locator('.bag-item').getByRole('status')).toHaveText('Only 2 available');
  await expect(page.locator('.bag-checkout-dock button')).toBeDisabled();
  await page.getByRole('button', { name: 'Decrease Rose lip tint quantity' }).click();
  await expect(page.locator('.bag-item').getByRole('status')).toHaveCount(0);
  await expect(page.locator('.bag-checkout-dock a')).toHaveAttribute('href', '#/checkout');
});

test('deleted products have their own removable card and block checkout until removed', async ({
  page,
}) => {
  await seedBag(page, 1, true);
  const missing = page.locator('.bag-item').filter({ hasText: 'Unavailable item' });
  await expect(missing.getByRole('status')).toHaveText('No longer available');
  await expect(page.locator('.bag-checkout-dock button')).toBeDisabled();
  await missing.getByRole('button', { name: 'Remove Unavailable item' }).click();
  await expect(page.locator('.bag-checkout-dock a')).toHaveAttribute('href', '#/checkout');
  await page.getByRole('button', { name: 'Remove Rose lip tint', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
});

test('cold offline startup shows a retry screen, preserves the bag and recovers on reconnection', async ({
  page,
}) => {
  // APK assets are local even without a network. Keep the preview assets
  // available while simulating the offline device and unavailable data APIs.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
  });
  await page.route('**/rest/v1/**', (route) => route.abort('internetdisconnected'));
  await page.addInitScript(
    ({ cartKey, productId, variantId }) => {
      localStorage.setItem(cartKey, JSON.stringify([{ productId, variantId, quantity: 1 }]));
    },
    { cartKey, productId, variantId },
  );
  await page.goto('/#/bag');
  await expect(page.getByRole('heading', { name: 'You’re offline', exact: true })).toBeVisible();
  await expect(page.locator('[data-skeleton="bag"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue to checkout' })).toHaveCount(0);
  expect(
    JSON.parse((await page.evaluate((key) => localStorage.getItem(key), cartKey))!),
  ).toHaveLength(1);
  await page.unroute('**/rest/v1/**');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true });
    window.dispatchEvent(new Event('online'));
  });
  await expect(page.getByRole('heading', { name: 'Your bag', exact: true })).toBeVisible();
  await expect(page.locator('.bag-item')).toContainText('Rose lip tint');
  await expect(page.locator('.native-offline')).toHaveCount(0);
});
