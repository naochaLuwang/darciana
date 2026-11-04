import { visit } from '../fixtures/visit';
import { test, expect } from '@playwright/test';
test('homepage loads the live catalog and renders on desktop and mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await visit(page, '/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Beauty &');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.locator('.product-card').last().scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.product-photo img')].every(
      (image) =>
        (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0,
    ),
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/home-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.home-campaign')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'App navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/home-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('search, category filters, favourites, cart persistence and checkout sign-in', async ({
  page,
}) => {
  await visit(page, '/shop');
  await expect(page.locator('.product-card').first()).toBeVisible();
  await page.getByLabel('Search products').fill('zz-no-matching-product-zz');
  await expect(page.getByText('No products found')).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByRole('button', { name: 'Stationery', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Stationery');
  await page.getByRole('button', { name: 'Shop all', exact: true }).click();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('In stock only').check();
  const first = page.locator('.product-card').first();
  await first.locator('.save-button').click();
  await expect(first.locator('.save-button')).toHaveAttribute('aria-pressed', 'true');
  await first.locator('.product-meta h3 a').click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Added to bag' })).toBeVisible();
  await page.getByRole('link', { name: 'View bag' }).click();
  await expect(page.locator('.bag-item')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.bag-item')).toHaveCount(1);
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  await visit(page, '/shop?saved=true');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await visit(page, '/bag');
  await page.locator('.remove-item').click();
  await expect(page.getByRole('heading', { name: 'Your bag is empty' })).toBeVisible();
});
test('unknown products show a useful 404 and account form is accessible', async ({ page }) => {
  const response = await visit(page, '/product/this-product-does-not-exist');
  // Next.js streaming may already have sent 200 before notFound() resolves.
  expect([200, 404]).toContain(response?.status());
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', 'noindex');
  await visit(page, '/account');
  await expect(page.getByLabel('Email address')).toBeVisible();
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
});
