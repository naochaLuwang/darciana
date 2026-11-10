import { test, expect } from '@playwright/test';
test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:54329/__reset');
});
test('password recovery returns to the bundled app, updates the password and rejects reuse', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/#/account/reset-password');
  await expect(page.getByRole('heading', { name: 'Reset link expired' })).toBeVisible();
  await page.goto('/#/account');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page.getByRole('heading', { name: 'Forgot password', exact: true })).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'If an account exists' })).toBeVisible();
  const { url } = await (await request.get('http://127.0.0.1:54329/__recovery/last')).json();
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Set new password' })).toBeVisible();
  await page.getByLabel('New password', { exact: true }).fill('updated-test-password');
  await page.getByLabel('Confirm new password', { exact: true }).fill('does-not-match');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  await page.getByLabel('Confirm new password', { exact: true }).fill('updated-test-password');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Password updated' })).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Check your email and password');
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.com');
  await page.getByLabel('Password', { exact: true }).fill('updated-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  await page.goto(url);
  await expect(page.getByRole('heading', { name: 'Set new password' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
