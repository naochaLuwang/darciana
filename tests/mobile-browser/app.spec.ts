import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ request, page }) => {
  await request.get('http://127.0.0.1:54329/__reset');
  page.on('pageerror', (error) => {
    throw error;
  });
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

test('profile, address book and COD checkout use the shared database actions', async ({ page }) => {
  await signIn(page);
  await page.getByLabel('Full name', { exact: true }).fill('Native Customer');
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await page.goto('/#/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/#/checkout');
  const order = page.getByRole('button', { name: 'Confirm and order', exact: true });
  await expect(order).toBeDisabled();
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await page.getByLabel('Street address', { exact: true }).fill('28 Garden Street');
  await page.getByLabel('City', { exact: true }).fill('Imphal');
  await page.getByLabel('State', { exact: true }).fill('Manipur');
  await page.getByLabel('PIN code', { exact: true }).fill('795001');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Shipping area', exact: true }).fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await page.getByRole('checkbox', { name: 'I accept the terms and conditions' }).check();
  await order.click();
  await expect(page.getByRole('heading', { name: 'Order received', exact: true })).toBeVisible();
  await expect(page.getByText(/Total ₹349.00/)).toBeVisible();
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
