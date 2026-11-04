import { test, expect, type BrowserContext } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { OWNER, CUSTOMER, tokenFor } from '../fixtures/admin-api.mjs';
async function signIn(context: BrowserContext, id: string) {
  const cookies: { name: string; value: string }[] = [];
  const client = createServerClient('http://127.0.0.1:54329', 'test-publishable-key', {
    cookies: {
      getAll: () => [],
      setAll: (values) => {
        cookies.push(...values);
      },
    },
  });
  const { error } = await client.auth.setSession({
    access_token: tokenFor(id),
    refresh_token: 'fixture-refresh',
  });
  if (error) throw error;
  await context.addCookies(
    cookies.map(({ name, value }) => ({ name, value, domain: '127.0.0.1', path: '/' })),
  );
}
test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:54329/__reset');
});
test('signed-out and customer accounts cannot see admin data', async ({ page, context }) => {
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: 'Sign in to admin' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'App navigation' })).toHaveCount(0);
  await signIn(context, CUSTOMER);
  await page.goto('/admin/products');
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await expect(page.getByText('Rose lip tint')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toHaveCount(0);
});
test('owner can manage products, categories, stock and request status', async ({
  page,
  context,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Your store at a glance' })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-overview.png', fullPage: true });
  await page.getByRole('link', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name', { exact: true }).fill('Peach lip balm');
  await page.getByLabel('Brand', { exact: true }).fill('Darciana');
  await page.getByLabel('Base price (₹)', { exact: true }).fill('249');
  await page.getByLabel('Option 1 SKU').fill('PEACH-01');
  await page.getByLabel('Option 1 stock').fill('8');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('active');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit product', exact: true })).toBeVisible();
  await expect(page.getByLabel('Product name', { exact: true })).toHaveValue('Peach lip balm');
  await page.screenshot({ path: 'test-results/admin-product.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Categories', exact: true })
    .click();
  await page.getByLabel('Category name', { exact: true }).fill('Notebooks');
  await page
    .getByRole('combobox', { name: 'Parent category', exact: true })
    .selectOption({ label: 'Stationery' });
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByText('Category saved.', { exact: true })).toBeVisible();
  await expect(
    page.locator('.admin-category-list').getByText('Notebooks', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Inventory', exact: true })
    .click();
  const row = page.getByRole('row').filter({ hasText: 'ROSE-01' });
  await row.getByLabel('Stock quantity').fill('12');
  await row.getByRole('button', { name: 'Save stock' }).click();
  await expect(row.getByRole('status')).toHaveText('Saved');
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Order requests', exact: true })
    .click();
  await page.getByRole('link', { name: 'Review →' }).click();
  await page
    .getByRole('combobox', { name: 'Move request to', exact: true })
    .selectOption('confirmed');
  await page.getByLabel('I’ve reviewed this request and want to mark it confirmed.').check();
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.locator('.admin-panel-heading .admin-status')).toHaveText('confirmed');
});
test('admin navigation and editor work on a phone', async ({ page, context }) => {
  await signIn(context, OWNER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  await page.goto('/admin/products/new');
  await expect(page.getByLabel('Product name', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('This product has multiple options').check();
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await expect(page.getByLabel('Option 2 name')).toBeVisible();
});

test('admin shipping setup feeds searchable checkout and saves delivery totals', async ({
  page,
  context,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin/shipping');
  await page.getByLabel('Area name', { exact: true }).fill('Imphal North');
  await page.getByLabel('Delivery price (₹)', { exact: true }).fill('80');
  await page.getByRole('button', { name: 'Save delivery area', exact: true }).click();
  await expect(page.getByText('Delivery area saved.', { exact: true })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Imphal North' })).toContainText('₹80.00');
  await page.screenshot({ path: 'test-results/admin-shipping.png', fullPage: true });
  await context.clearCookies();
  await signIn(context, CUSTOMER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  const submit = page.getByRole('button', { name: 'Confirm and order', exact: true });
  await expect(submit).toBeDisabled();
  const area = page.getByRole('combobox', { name: 'Shipping area', exact: true });
  await area.fill('Central');
  await area.press('ArrowDown');
  await area.press('Enter');
  await expect(page.locator('.summary-total')).toContainText('₹349.00');
  await page.getByRole('button', { name: 'Clear delivery area' }).click();
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await expect(page.locator('.checkout-delivery-line')).toContainText('Free');
  await expect(page.locator('.summary-total')).toContainText('₹299.00');
  await page.getByRole('button', { name: 'Clear delivery area' }).click();
  await area.fill('Hidden');
  await expect(
    page.getByRole('listbox', { name: 'Delivery areas' }).getByRole('option'),
  ).toHaveCount(0);
  await expect(page.getByText('No matching area. Try a different area name.')).toBeVisible();
  await expect(submit).toBeDisabled();
  await area.fill('north');
  await page.screenshot({ path: 'test-results/checkout-shipping-dropdown.png', fullPage: true });
  await page.getByRole('option', { name: /Imphal North/ }).click();
  await expect(page.locator('.summary-total')).toContainText('₹379.00');
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await fillAddress(page, 'Test Customer');
  await page.getByLabel('Street address', { exact: true }).fill('12 Example Street');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await page.getByRole('checkbox', { name: 'I accept the terms and conditions' }).check();
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible();
  await expect(page.getByText(/Total ₹379.00/)).toBeVisible();
  await expect(page.getByText('Cash on Delivery (COD)', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View orders' }).click();
  const order = page.locator('.order-card').filter({ hasText: 'Imphal North' });
  await expect(order).toContainText('₹80.00');
  await expect(order).toContainText('₹379.00');
  await expect(order).toContainText('Cash on Delivery (COD)');
  await page.getByRole('link', { name: /Saved addresses/ }).click();
  await expect(page.locator('.saved-address-details:visible')).toContainText('Test Customer');
  await expect(page.locator('.saved-address-details:visible')).toContainText('9876543210');
  await expect(page.locator('.saved-address-details:visible')).toContainText('12 Example Street');
  await expect(page.locator('.saved-address-details:visible')).toContainText('Imphal North');
});

test('checkout stays closed when no delivery areas are configured', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__areas/empty');
  await signIn(context, CUSTOMER);
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  await expect(page.getByText('No delivery areas available.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and order', exact: true })).toBeDisabled();
});

async function fillAddress(page: import('@playwright/test').Page, name = 'Profile Customer') {
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await page.getByLabel('Street address', { exact: true }).fill('28 Garden Street');
  await page.getByLabel('City', { exact: true }).fill('Imphal');
  await page.getByLabel('State', { exact: true }).fill('Manipur');
  await page.getByLabel('PIN code', { exact: true }).fill('795001');
}

test('profile updates and multiple saved addresses are private and reusable at checkout', async ({
  page,
  context,
}) => {
  await signIn(context, CUSTOMER);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/account');
  await page.getByLabel('Full name', { exact: true }).fill('Profile Customer');
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update profile', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/customer-profile-mobile.png', fullPage: true });
  await page.getByRole('link', { name: /Saved addresses/ }).click();
  await page.getByRole('button', { name: 'Add new address', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Profile Customer');
  await fillAddress(page, 'Home Recipient');
  await page.getByRole('combobox', { name: 'Delivery area', exact: true }).fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.address-book-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Add new address', exact: true }).click();
  await fillAddress(page, 'Office Recipient');
  await page.getByLabel('Street address', { exact: true }).fill('44 Office Road');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.address-book-card')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('.address-book-card')).toHaveCount(2);
  await expect(page.locator('.address-book-card').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/saved-addresses-mobile.png', fullPage: true });
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await expect(page.locator('.checkout-address-option')).toHaveCount(2);
  await page.getByRole('button', { name: 'Add new address', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Profile Customer');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.locator('.checkout-address-option').filter({ hasText: 'Home Recipient' }).click();
  await expect(page.locator('.checkout-location')).toContainText('Home Recipient');
  await page.getByRole('combobox', { name: 'Shipping area', exact: true }).fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await page.getByRole('checkbox', { name: 'I accept the terms and conditions' }).check();
  await page.getByRole('button', { name: 'Confirm and order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible();
  await page.getByRole('link', { name: 'View orders' }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Profile Customer');
  await context.clearCookies();
  await signIn(context, OWNER);
  await page.goto('/account/addresses');
  await expect(page.locator('.address-book-card')).toHaveCount(0);
  await page.goto('/account');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('');
});

test('checkout can save without submitting, preserves failed edits and rejects a disabled saved area', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, CUSTOMER);
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await fillAddress(page, 'Saved From Checkout');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.checkout-location')).toContainText('Saved From Checkout');
  await expect(
    page.getByRole('checkbox', { name: 'I accept the terms and conditions' }),
  ).not.toBeChecked();
  await page.getByRole('combobox', { name: 'Shipping area', exact: true }).fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await page.goto('/account/addresses');
  await expect(page.locator('.saved-address-details:visible')).toContainText('Saved From Checkout');
  await page.getByRole('button', { name: 'Edit address', exact: true }).click();
  await page.getByRole('combobox', { name: 'Delivery area', exact: true }).fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.saved-address-details:visible')).toContainText('Central Market');
  await request.get('http://127.0.0.1:54329/__address/fail-save');
  await page.getByRole('button', { name: 'Edit address', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill('Keep My Edit');
  await page.getByRole('button', { name: 'Save address', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
    'Your address could not be saved',
  );
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Keep My Edit');
  await page.getByRole('button', { name: 'Close address selector' }).click();
  await request.get('http://127.0.0.1:54329/__areas/disable');
  await page.goto('/checkout');
  await expect(page.locator('.checkout-location')).toContainText('Saved From Checkout');
  await expect(page.getByText('Select an available shipping area.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm and order', exact: true })).toBeDisabled();
  await expect(page.getByRole('combobox', { name: 'Shipping area', exact: true })).toHaveValue('');
});

test('missing address setup allows manual checkout without claiming an address was saved', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__address/unavailable');
  await signIn(context, CUSTOMER);
  await page.goto('/account');
  await page.getByRole('link', { name: /Saved addresses/ }).click();
  await expect(page.getByText('Saved addresses are unavailable. Try again later.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save address', exact: true })).toHaveCount(0);
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await fillAddress(page);
  await expect(page.getByRole('checkbox', { name: 'Save to my profile' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Shipping area', exact: true }).fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await page.getByRole('checkbox', { name: 'I accept the terms and conditions' }).check();
  await page.getByRole('button', { name: 'Confirm and order', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible();
});

test('compact mobile checkout offers COD with a cash icon and requires address, area, payment and terms', async ({
  page,
  context,
}) => {
  await signIn(context, CUSTOMER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Shipping info', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Price details', exact: true })).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Confirm and order', exact: true });
  await expect(confirm).toBeDisabled();
  const acceptTerms = page.getByRole('checkbox', { name: 'I accept the terms and conditions' });
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await acceptTerms.check();
  await expect(confirm).toBeDisabled();
  const area = page.getByRole('combobox', { name: 'Shipping area', exact: true });
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await expect(confirm).toBeDisabled(); // Area chosen, delivery location still missing.
  await page.getByRole('button', { name: 'Clear delivery area' }).click();
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await fillAddress(page, 'Compact Customer');
  await page.getByLabel('Mobile number', { exact: true }).fill('12345');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('valid 10-digit');
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue('Compact Customer');
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.checkout-location')).toContainText('Compact Customer');
  await expect(confirm).toBeDisabled(); // Valid location, shipping area still missing.
  await acceptTerms.uncheck();
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await expect(confirm).toBeDisabled();
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await expect(page.getByRole('combobox', { name: 'Payment mode', exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Select payment mode', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Pay in Cash upon delivery', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(1);
  await expect(page.getByRole('radio', { name: 'Manual UPI', exact: true })).toHaveCount(0);
  await expect(page.locator('.checkout-payment-option svg')).toBeVisible();
  await expect(
    page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }),
  ).toBeChecked();
  await expect(confirm).toBeDisabled();
  const terms = page.getByRole('button', { name: 'Terms and conditions', exact: true });
  await terms.click();
  await expect(page.getByRole('dialog')).toContainText('No payment is collected at checkout.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(terms).toBeFocused();
  await page.getByRole('checkbox', { name: 'I accept the terms and conditions' }).check();
  await expect(confirm).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  const confirmBox = await confirm.boundingBox();
  const navBox = await page.getByRole('navigation', { name: 'App navigation' }).boundingBox();
  expect(confirmBox!.y + confirmBox!.height).toBeLessThanOrEqual(navBox!.y);
  await page.screenshot({ path: 'test-results/compact-checkout-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Clear delivery area' }).click();
  await expect(confirm).toBeDisabled();
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible();
  await expect(page.locator('.checkout-success')).toContainText('Cash on Delivery (COD)');
  await page.getByRole('link', { name: 'View orders' }).click();
  await expect(
    page.locator('.order-card').filter({ hasText: 'Cash on Delivery (COD)' }),
  ).toContainText('₹299.00');
});

test('profile deletion requires explicit confirmation and the current password', async ({
  page,
  context,
}) => {
  await signIn(context, CUSTOMER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/account');
  await page.getByRole('button', { name: 'Delete account', exact: true }).click();
  const remove = page.getByRole('button', { name: 'Delete my account', exact: true });
  await expect(remove).toBeDisabled();
  await page.screenshot({
    path: 'test-results/delete-account-confirmation-mobile.png',
    fullPage: true,
  });
  await page.getByLabel('Type DELETE to confirm').fill('DELETE');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await remove.click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Incorrect password');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await remove.click();
  await expect(page.getByText('Account deleted.', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
});

test('More reuses legal content and admin changes reach customers without exposing the server key', async ({
  page,
  context,
}) => {
  await page.goto('/more');
  const nav = page.getByRole('navigation', { name: 'App navigation' });
  await expect(nav.getByRole('link', { name: 'More', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(nav.getByRole('link', { name: 'Bag', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
  await expect(page.locator('.info-content')).toContainText('Privacy fixture content.');
  await signIn(context, CUSTOMER);
  await page.goto('/admin/content');
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await context.clearCookies();
  await signIn(context, OWNER);
  await page.goto('/admin/content?edit=contact_us');
  await page.getByLabel('Title', { exact: true }).fill('Contact support');
  await page
    .getByLabel('Page content', { exact: true })
    .fill('Email support@example.com.\n\n<script>window.__cms_injected = true</script>');
  await page.getByRole('button', { name: 'Save page', exact: true }).click();
  await expect(page.getByText('Page saved.', { exact: true })).toBeVisible();
  expect(await page.content()).not.toContain('test-server-secret');
  await page.goto('/more');
  await page.getByRole('link', { name: 'Contact support', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Contact support', exact: true })).toBeVisible();
  await expect(page.locator('.info-content')).toContainText('support@example.com');
  expect(await page.evaluate(() => Reflect.get(window, '__cms_injected'))).toBeUndefined();
  await page.goto('/admin/content?edit=contact_us');
  await page.getByRole('checkbox', { name: 'Show in More' }).uncheck();
  await page.getByRole('button', { name: 'Save page', exact: true }).click();
  await expect(page.getByText('Page saved.', { exact: true })).toBeVisible();
  await page.goto('/more');
  await expect(page.getByRole('link', { name: 'Contact support', exact: true })).toHaveCount(0);
  await page.goto('/admin/content?new=1');
  await page.getByLabel('Title', { exact: true }).fill('Help center');
  await page.getByLabel('Page content', { exact: true }).fill('Help with delivery and orders.');
  await page.getByRole('button', { name: 'Save page', exact: true }).click();
  await expect(page.getByText('Page saved.', { exact: true })).toBeVisible();
  await page.goto('/more');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('link', { name: 'Help center', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/more-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Privacy policy', exact: true }).click();
  await expect(page.locator('.info-content')).toContainText('Privacy fixture content.');
});
