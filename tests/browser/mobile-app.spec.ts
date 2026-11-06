import { visit } from '../fixtures/visit';
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('bottom tabs navigate through app screens and reflect the active screen', async ({ page }) => {
  await visit(page, '/');
  await expect(page.locator('.home-discovery .app-search')).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'App navigation' });
  await expect(nav.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await nav.getByRole('link', { name: 'Categories', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Shop by category');
  await expect(page.locator('.category-tile').first()).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Categories', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await page.screenshot({ path: 'test-results/app-categories.png', fullPage: true });
  await nav.getByRole('link', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No saved items yet' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Saved', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await nav.getByRole('link', { name: 'More', exact: true }).click();
  await expect(nav.getByRole('link')).toHaveText([
    'Home',
    'Categories',
    'Saved',
    'Profile',
    'More',
  ]);
  await expect(nav.getByRole('link', { name: 'More', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByRole('heading', { name: 'Support & info', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legal', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Bag', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: /Shopping bag/ }).click();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
  await nav.getByRole('link', { name: 'Profile', exact: true }).click();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Profile', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
});

test('More shares the store, handles clipboard fallback and fits small screens', async ({
  page,
}) => {
  await visit(page, '/more');
  await expect(page.getByText('Designed & developed by')).toBeVisible();
  await expect(page.getByText('Luwang Tech', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Version \d+\.\d+\.\d+/)).toBeVisible();
  for (const width of [320, 390, 1024]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/more-${width}.png`, fullPage: true });
  }
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        Reflect.set(window, '__sharedStore', data);
      },
    });
  });
  const share = page.getByRole('button', { name: 'Share app', exact: true });
  await share.click();
  const expectedUrl = new URL('/', page.url()).href;
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, '__sharedStore')))
    .toEqual({
      title: 'Darciana',
      url: expectedUrl,
    });
  await expect(share).toBeEnabled();
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          Reflect.set(window, '__copiedStore', text);
        },
      },
    });
  });
  await share.click();
  await expect(page.getByText('Link copied', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, '__copiedStore'))).toBe(expectedUrl);
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
  });
  await share.click();
  await expect(page.getByLabel('Store link')).toHaveValue(expectedUrl);
});

test('purchase and checkout controls stay above tabs and simulated device safe areas', async ({
  page,
}) => {
  await visit(page, '/shop');
  await page.addStyleTag({ content: ':root { --safe-top: 24px; --safe-bottom: 24px; }' });
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('In stock only').check();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.locator('.product-meta h3 a').first().click();
  const nav = page.getByRole('navigation', { name: 'App navigation' });
  const dock = page.locator('.detail-buy');
  await expect(dock.getByRole('button', { name: 'Add to bag', exact: true })).toBeVisible();
  expect((await nav.boundingBox())!.height).toBeGreaterThanOrEqual(96);
  for (const button of await dock.getByRole('button').all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  const dockBox = await dock.boundingBox();
  const navBox = await nav.boundingBox();
  expect(dockBox!.y + dockBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
  for (const link of await nav.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await dock.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('link', { name: /Shopping bag/ })).toContainText('1');
  await page.screenshot({ path: 'test-results/app-product.png', fullPage: true });
  await page.getByRole('link', { name: /Shopping bag/ }).click();
  const checkout = page.locator('.bag-checkout-dock');
  await expect(checkout.getByRole('link', { name: 'Continue to checkout' })).toBeVisible();
  const checkoutBox = await checkout.boundingBox();
  const bagNavBox = await nav.boundingBox();
  expect(checkoutBox!.y + checkoutBox!.height).toBeLessThanOrEqual(bagNavBox!.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/app-bag.png', fullPage: true });
  await checkout.getByRole('link', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test('small screens and keyboard viewport changes keep fields usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await visit(page, '/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const width of [768, 930, 1200]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.locator('.home-discovery .app-search')).toBeVisible();
    await expect(page.locator('.home-shortcuts')).toBeVisible();
    const search = await page.locator('.home-discovery .app-search').boundingBox();
    const shortcuts = await page.locator('.home-shortcuts').boundingBox();
    const separateRows = search!.y + search!.height <= shortcuts!.y + 1;
    const separateColumns = search!.x + search!.width <= shortcuts!.x + 1;
    expect(separateRows || separateColumns).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await visit(page, '/account');
  const email = page.getByLabel('Email address');
  expect(
    await email.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await email.focus();
  await page.setViewportSize({ width: 320, height: 400 });
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'open');
  await expect(page.getByRole('navigation', { name: 'App navigation' })).toBeHidden();
  await email.fill('test@example.com');
  await email.blur();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByRole('navigation', { name: 'App navigation' })).toBeVisible();
});
