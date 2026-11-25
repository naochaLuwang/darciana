import { test, expect, type BrowserContext, type APIRequestContext } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { OWNER, CUSTOMER, tokenFor } from '../fixtures/admin-api.mjs';
import { checkProductGalleries } from '../fixtures/product-gallery';
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
async function savedProduct(request: APIRequestContext, name: string) {
  const response = await request.get('http://127.0.0.1:54329/rest/v1/products', {
    headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
  });
  expect(response.ok()).toBe(true);
  const products = (await response.json()) as {
    name: string;
    product_variants: { sku: string; is_default: boolean }[];
  }[];
  const product = products.find((product) => product.name === name);
  expect(product).toBeTruthy();
  return product!;
}
async function choose(page: import('@playwright/test').Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function openOrderFilters(page: import('@playwright/test').Page) {
  const button = page.getByRole('button', { name: /^Filters(?:,|$)/ });
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
}
test.beforeEach(async ({ request }) => {
  await request.get('http://127.0.0.1:54329/__reset');
});
test('whole rupees stay consistent across admin inputs, percentage discounts, bag quantities and checkout', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin/products/33333333-3333-4333-8333-333333333333');
  const base = page.getByLabel('Base price (₹)', { exact: true });
  await expect(base).toHaveAttribute('step', '1');
  await base.fill('0');
  await base.press('Backspace');
  await expect(base).toHaveValue('');
  await base.blur();
  await expect(base).toHaveValue('');
  await base.fill('999.5');
  await base.blur();
  await expect(base).toHaveValue('1000');
  await base.fill('999');
  const discount = page.getByLabel('Discount value', { exact: true });
  await discount.fill('99.5');
  await discount.blur();
  await expect(discount).toHaveValue('100');
  await choose(page, 'Discount', 'Percentage off (%)');
  await discount.fill('50');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByLabel(/SKU/)).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: 'Product saved.' })).toBeVisible();
  expect((await savedProduct(request, 'Rose lip tint')).product_variants[0].sku).toBe('ROSE-01');
  await page.goto('/admin/shipping');
  const delivery = page.getByLabel('Delivery price (₹)', { exact: true });
  await delivery.fill('50.5');
  await delivery.blur();
  await expect(delivery).toHaveValue('51');
  await context.clearCookies();
  await signIn(context, CUSTOMER);
  await page.goto('/product/rose-lip-tint');
  await expect(page.locator('.detail-price')).toContainText('₹500');
  await expect(page.locator('.detail-price')).not.toContainText(/₹[\d,]+\.\d/);
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Increase quantity', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/bag');
  await expect(page.locator('.summary-total')).toContainText('₹1,500');
  await expect(page.locator('main')).not.toContainText(/₹[\d,]+\.\d/);
  await page.goto('/checkout');
  await page.getByRole('combobox', { name: 'Shipping area', exact: true }).fill('Central');
  await page.getByRole('option', { name: /Central Market/ }).click();
  await expect(page.locator('.summary-total')).toContainText('₹1,550');
  await expect(page.locator('.checkout-prices')).not.toContainText(/₹[\d,]+\.\d/);
});
test('admin images upload to Storage, save on products and categories, and can be replaced or removed', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  const png = {
    name: 'photo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=',
      'base64',
    ),
  };
  await page.goto('/admin/products/33333333-3333-4333-8333-333333333333');
  await expect(page.locator('input[type="url"]')).toHaveCount(0);
  await page.getByLabel('Upload product image', { exact: true }).setInputFiles(png);
  const image = page.locator('.admin-image-preview img').first();
  await expect(image).toHaveAttribute(
    'src',
    /\/storage\/v1\/object\/public\/storefront-media\/products\//,
  );
  const first = await image.getAttribute('src');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Product saved.' })).toBeVisible();
  const products = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  expect(products[0].thumbnail_url).toBe(first);
  await page
    .getByLabel('Upload product image', { exact: true })
    .setInputFiles({ ...png, name: 'replacement.png' });
  await expect(image).not.toHaveAttribute('src', first!);
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove image', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Product saved.' })).toBeVisible();
  const changed = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  expect(changed[0].thumbnail_url).toBe('');
  await page.goto('/admin/categories');
  await page.getByLabel('Category name', { exact: true }).fill('Storage category');
  await page.getByLabel('Upload category image', { exact: true }).setInputFiles(png);
  await expect(page.locator('.admin-image-preview img')).toHaveAttribute(
    'src',
    /\/storefront-media\/categories\//,
  );
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByText('Category saved.', { exact: true })).toBeVisible();
  const categories = await (await request.get('http://127.0.0.1:54329/rest/v1/categories')).json();
  expect(
    categories.find((item: { name: string }) => item.name === 'Storage category').image_url,
  ).toMatch(/\/storefront-media\/categories\//);
  await request.get('http://127.0.0.1:54329/__categories/legacy');
  await page.goto('/admin/categories?edit=dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  await expect(page.getByLabel('URL slug', { exact: true })).toHaveValue('arts-crafts');
  await page.getByLabel('Upload category image', { exact: true }).setInputFiles(png);
  await expect(page.locator('.admin-image-preview img')).toHaveAttribute(
    'src',
    /\/storefront-media\/categories\//,
  );
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByText('Category saved.', { exact: true })).toBeVisible();
  const savedCategories = await (
    await request.get('http://127.0.0.1:54329/rest/v1/categories')
  ).json();
  const legacy = savedCategories.find(
    (item: { id: string }) => item.id === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  );
  expect(legacy.slug).toBe('arts-crafts');
  expect(legacy.parent_id).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  expect(legacy.image_url).toMatch(/\/storefront-media\/categories\//);
  await page.goto('/shop?category=arts--crafts');
  await expect(page.getByRole('heading', { name: 'Arts & crafts', exact: true })).toBeVisible();
});
test('notification console protects access, previews announcements and disables sending with no subscribers', async ({
  page,
  context,
}) => {
  await signIn(context, CUSTOMER);
  await page.goto('/admin/notifications');
  await expect(page.getByRole('heading', { name: 'Admin access required' })).toBeVisible();
  await context.clearCookies();
  await signIn(context, OWNER);
  await page.goto('/admin/notifications');
  await expect(page.getByRole('heading', { name: 'Notifications', exact: true })).toBeVisible();
  await page.getByLabel('Title', { exact: true }).fill('Fresh finds');
  await page.getByLabel('Message', { exact: true }).fill('Explore the latest arrivals.');
  await expect(page.getByLabel('Notification preview')).toContainText('Fresh finds');
  await expect(page.getByLabel('Notification preview')).toContainText(
    'Explore the latest arrivals.',
  );
  await page
    .getByRole('checkbox', { name: 'Send this announcement to opted-in customers.' })
    .check();
  await expect(page.getByRole('button', { name: 'Send notification', exact: true })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Sending history' })).toBeVisible();
  await page.screenshot({ path: 'test-results/admin-notifications.png', fullPage: true });
});
test('web product galleries show all photos and isolate the selected variant', async ({
  page,
  request,
}) => {
  await checkProductGalleries(page, request);
});
test('account screens support password visibility, email sign-in and sign-out on a phone', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/account');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Continue with Google', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Email address', { exact: true }).fill('customer@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create account', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/account-sign-in-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Saved addresses', exact: true })).toBeVisible();
  await page.getByRole('heading', { name: 'Orders', exact: true }).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/account-profile-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  expect(
    (await context.cookies()).some((cookie) => cookie.name.startsWith('sb-127-auth-token')),
  ).toBe(false);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello there', exact: true })).toBeVisible();
});

test('Google sign-in exchanges PKCE cookies, returns to checkout and handles cancellation', async ({
  page,
  context,
  request,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('link', { name: /Shopping bag/ })).toContainText('1');
  await page.goto('/account?next=checkout');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3002/checkout');
  await expect(page.getByRole('heading', { name: 'Shipping info', exact: true })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name === 'darciana.oauth-next')).toBe(
    false,
  );
  await context.clearCookies();
  await page.goto('/account');
  await page.getByRole('button', { name: 'Create account', exact: true }).first().click();
  await expect(
    page.getByRole('button', { name: 'Continue with Google', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'test-results/google-sign-in-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:3002/account');
  await expect(page.getByRole('heading', { name: 'My account', exact: true })).toBeVisible();
  await context.clearCookies();
  await request.get('http://127.0.0.1:54329/__oauth/deny');
  await page.goto('/account');
  await page.getByRole('button', { name: 'Continue with Google', exact: true }).click();
  await expect(
    page.getByText('Google sign-in wasn’t completed. Please try again.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Email address', { exact: true })).toBeVisible();
  expect((await context.cookies()).some((cookie) => cookie.name === 'darciana.oauth-next')).toBe(
    false,
  );
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
test('inventory groups variant sub-rows and searches product names on desktop and mobile', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await signIn(context, OWNER);
  await page.goto('/admin/inventory');
  const table = page.getByRole('table', { name: 'Product inventory' });
  await expect(table.getByRole('columnheader', { name: /SKU/ })).toHaveCount(0);
  await expect(table).not.toContainText('ROSE-01');
  const simple = table.getByRole('row').filter({ hasText: 'Rose lip tint' });
  await expect(simple.locator('.admin-inventory-name small')).toHaveCount(0);
  await expect(table.getByRole('link', { name: 'Colour pencil set', exact: true })).toHaveCount(1);
  for (const title of ['Rose', 'Mint', 'Sand']) {
    const variant = table.getByRole('row', { name: `Colour pencil set — ${title}`, exact: true });
    await expect(variant.locator('.admin-inventory-variant-name')).toHaveText(title);
    await expect(variant).not.toContainText('Colour pencil set');
  }
  await page.screenshot({ path: 'artifacts/inventory-desktop.png', fullPage: true });

  const search = page.getByRole('searchbox', { name: 'Search product names' });
  await search.fill('COLOUR pencil');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(5);
  await expect(table).not.toContainText('Rose lip tint');
  const mint = table.getByRole('row').filter({ hasText: 'Mint' });
  await mint.getByLabel('Stock quantity').fill('12');
  await mint.getByRole('button', { name: 'Save stock' }).click();
  await expect(mint.getByRole('status')).toHaveText('Saved');
  await expect(mint).toContainText('In stock');
  const response = await request.get('http://127.0.0.1:54329/rest/v1/products', {
    headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
  });
  const products = (await response.json()) as {
    name: string;
    product_variants: { title: string; stock: number }[];
  }[];
  expect(
    products
      .find((product) => product.name === 'Colour pencil set')
      ?.product_variants.map(({ title, stock }) => ({ title, stock })),
  ).toEqual([
    { title: 'Rose', stock: 4 },
    { title: 'Mint', stock: 12 },
    { title: 'Sand', stock: 0 },
  ]);

  await page.getByRole('checkbox', { name: 'Low stock only (5 or fewer)' }).check();
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(4);
  await expect(table).not.toContainText('Mint');
  await page.setViewportSize({ width: 393, height: 852 });
  await expect(table.getByRole('row').filter({ hasText: 'Sand' })).toContainText('Out of stock');
  await expect(table.getByLabel('Stock quantity').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save stock' }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/inventory-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  await page.getByRole('link', { name: 'Clear filters' }).click();
  await search.fill('rose');
  await search.press('Enter');
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('Rose lip tint');
  await expect(table).not.toContainText('Colour pencil set');
  await search.fill('ROSE-01');
  await search.press('Enter');
  await expect(page.getByRole('heading', { name: 'No matching inventory' })).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters' }).click();
  await expect(table.getByRole('row')).toHaveCount(6);
});

test('inventory filters category trees, additional category assignments and paginated low-stock searches', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await request.get('http://127.0.0.1:54329/__inventory/categories');
  await signIn(context, OWNER);
  await page.goto('/admin/inventory');
  const category = page.getByRole('combobox', { name: 'Filter by category', exact: true });
  const table = page.getByRole('table', { name: 'Product inventory' });
  const apply = page.getByRole('button', { name: 'Search', exact: true });
  await expect(category).toContainText('Cosmetics / Lip colour');
  await page.getByRole('checkbox', { name: 'Select all rows on this page', exact: true }).check();
  await category.selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await apply.click();
  await expect(table).toContainText('Colour pencil set');
  await expect(table).not.toContainText('Rose lip tint');
  await expect(page.getByRole('button', { name: 'Update selected' })).toHaveCount(0);
  await category.selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await apply.click();
  await expect(table).toContainText('Rose lip tint');
  await expect(table).toContainText('Colour pencil set');
  await category.selectOption('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  await apply.click();
  await expect(table).toContainText('Rose lip tint');
  await expect(table).toContainText('Colour pencil set');
  await page.getByRole('searchbox', { name: 'Search product names' }).fill('Colour');
  await page.getByRole('checkbox', { name: 'Low stock only (5 or fewer)' }).check();
  await apply.click();
  await expect(table.getByRole('row')).toHaveCount(5);
  await expect(table).not.toContainText('Rose lip tint');
  await expect(category).toHaveValue('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  await page.screenshot({ path: 'artifacts/inventory-category-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(category).toHaveValue('');
  await expect(table.getByRole('row')).toHaveCount(6);
  await request.get('http://127.0.0.1:54329/__inventory/categories/paged');
  await page.goto(
    '/admin/inventory?category=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&q=Stationery&low=true',
  );
  await expect(table.getByRole('row')).toHaveCount(26);
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/category=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
  await expect(page).toHaveURL(/q=Stationery/);
  await expect(page).toHaveURL(/low=true/);
  await expect(table.getByRole('row')).toHaveCount(6);
  await expect(category).toHaveValue('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
});

test('inventory selects products or individual variants and bulk sets only selected stock', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await signIn(context, OWNER);
  await page.goto('/admin/inventory');
  const group = page.getByRole('checkbox', {
    name: 'Select all variants of Colour pencil set',
    exact: true,
  });
  const mint = page.getByRole('checkbox', { name: 'Select Colour pencil set — Mint', exact: true });
  const all = page.getByRole('checkbox', { name: 'Select all rows on this page', exact: true });
  await group.check();
  await expect(page.getByText('3 selected', { exact: true })).toBeVisible();
  await expect(all).toHaveAttribute('aria-checked', 'mixed');
  await mint.uncheck();
  await expect(group).toHaveAttribute('aria-checked', 'mixed');
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible();
  await all.check();
  await expect(page.getByText('4 selected', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Clear selection' }).click();
  await expect(page.getByRole('button', { name: 'Update selected' })).toHaveCount(0);
  await group.check();
  await page.getByLabel('Set stock to').fill('7');
  await page.screenshot({ path: 'artifacts/inventory-bulk-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 393, height: 852 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/inventory-bulk-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Update selected', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Updated stock for' })).toHaveText(
    'Updated stock for 3 rows.',
  );
  for (const title of ['Rose', 'Mint', 'Sand'])
    await expect(
      page
        .getByRole('row', { name: `Colour pencil set — ${title}`, exact: true })
        .getByLabel('Stock quantity'),
    ).toHaveValue('7');
  await expect(
    page.getByRole('row', { name: 'Rose lip tint', exact: true }).getByLabel('Stock quantity'),
  ).toHaveValue('4');
  await expect(group).not.toBeChecked();
  const response = await request.get('http://127.0.0.1:54329/rest/v1/products', {
    headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
  });
  const products = await response.json();
  expect(
    products
      .find((product: { name: string }) => product.name === 'Colour pencil set')
      .product_variants.map((variant: { stock: number }) => variant.stock),
  ).toEqual([7, 7, 7]);

  await page
    .getByRole('checkbox', { name: 'Select Colour pencil set — Sand', exact: true })
    .check();
  await page.getByLabel('Set stock to').fill('0');
  await page.getByRole('button', { name: 'Update selected', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Updated stock for' })).toHaveText(
    'Updated stock for 1 row.',
  );
  await expect(
    page.getByRole('row', { name: 'Colour pencil set — Sand', exact: true }),
  ).toContainText('Out of stock');
  await expect(
    page
      .getByRole('row', { name: 'Colour pencil set — Mint', exact: true })
      .getByLabel('Stock quantity'),
  ).toHaveValue('7');
  await all.check();
  await page.getByRole('searchbox', { name: 'Search product names' }).fill('rose');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Update selected' })).toHaveCount(0);
  await expect(all).not.toBeChecked();
});

test('inventory bulk updates report conflicts without overwriting newer stock', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await signIn(context, OWNER);
  await page.goto('/admin/inventory');
  await page
    .getByRole('checkbox', { name: 'Select all variants of Colour pencil set', exact: true })
    .check();
  const changed = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_stock',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: {
        p_variant_id: '99999999-9999-4999-8999-999999999992',
        p_stock: 19,
        p_expected_updated_at: '2026-11-01T12:00:00Z',
      },
    },
  );
  expect(changed.ok()).toBe(true);
  await page.getByLabel('Set stock to').fill('6');
  await page.getByRole('button', { name: 'Update selected', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Updated stock for' })).toHaveText(
    'Updated stock for 2 rows.',
  );
  await expect(page.locator('.admin-inventory').getByRole('alert')).toContainText(
    '1 row was not updated',
  );
  await expect(page.locator('.admin-inventory').getByRole('alert')).toContainText(
    'Colour pencil set — Mint',
  );
  await expect(page.locator('.admin-inventory').getByRole('alert')).toContainText(
    'Someone changed this record',
  );
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Select Colour pencil set — Mint', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Select Colour pencil set — Rose', exact: true }),
  ).not.toBeChecked();
  await expect(
    page
      .getByRole('row', { name: 'Colour pencil set — Mint', exact: true })
      .getByLabel('Stock quantity'),
  ).toHaveValue('19');
  const response = await request.get('http://127.0.0.1:54329/rest/v1/products', {
    headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
  });
  const products = await response.json();
  expect(
    products
      .find((product: { name: string }) => product.name === 'Colour pencil set')
      .product_variants.map((variant: { stock: number }) => variant.stock),
  ).toEqual([6, 19, 6]);
});

test('owner can manage products, categories, stock and request status', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Store overview' })).toBeVisible();
  const logo = page
    .locator('.admin-sidebar')
    .getByRole('img', { name: 'Daciana — Stationery & Cosmetics' });
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/admin-overview.png', fullPage: true });
  await page.getByRole('link', { name: 'Add product', exact: true }).click();
  await page.getByLabel('Product name', { exact: true }).fill('Peach lip balm');
  await page.getByLabel('Brand', { exact: true }).fill('Darciana');
  await expect(page.getByLabel('Base price (₹)', { exact: true })).toHaveValue('');
  await page.getByLabel('Base price (₹)', { exact: true }).fill('249');
  await expect(page.getByLabel(/SKU/)).toHaveCount(0);
  await page.screenshot({ path: 'test-results/admin-product-new-shadcn.png', fullPage: true });
  await page.getByLabel('Option 1 stock').fill('8');
  await choose(page, 'Status', 'Active — visible in shop');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit product', exact: true })).toBeVisible();
  await expect(page.getByLabel('Product name', { exact: true })).toHaveValue('Peach lip balm');
  await expect(page.getByLabel(/SKU/)).toHaveCount(0);
  const generatedSku = (await savedProduct(request, 'Peach lip balm')).product_variants[0].sku;
  expect(generatedSku).toMatch(/^DA-[0-9A-F-]{36}$/);
  await page.getByLabel('Brand', { exact: true }).fill('Daciana');
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Product saved.' })).toBeVisible();
  await expect(page.getByLabel(/SKU/)).toHaveCount(0);
  expect((await savedProduct(request, 'Peach lip balm')).product_variants[0].sku).toBe(
    generatedSku,
  );
  await page.screenshot({ path: 'test-results/admin-product.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Categories', exact: true })
    .click();
  await page.getByLabel('Category name', { exact: true }).fill('Notebooks');
  await choose(page, 'Parent category', 'Stationery');
  await page.getByRole('button', { name: 'Save category', exact: true }).click();
  await expect(page.getByText('Category saved.', { exact: true })).toBeVisible();
  await expect(
    page.locator('.admin-category-list').getByText('Notebooks', { exact: true }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Inventory', exact: true })
    .click();
  const row = page.getByRole('row').filter({ hasText: 'Rose lip tint' });
  await row.getByLabel('Stock quantity').fill('12');
  await row.getByRole('button', { name: 'Save stock' }).click();
  await expect(row.getByRole('status')).toHaveText('Saved');
  await page
    .getByRole('navigation', { name: 'Admin navigation' })
    .getByRole('link', { name: 'Order requests', exact: true })
    .click();
  await page.getByRole('link', { name: 'Review →' }).click();
  await choose(page, 'Delivery status', 'Processing');
  await expect(page.locator('.admin-panel-heading .admin-status')).toHaveText('Processing');
});
test('orders move through delivery stages, keep payment separate and notify automatically', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  const orderId = '55555555-5555-4555-8555-555555555555';
  await page.goto(`/admin/orders/${orderId}`);
  const statusBadge = page.locator('.admin-panel-heading .admin-status');
  const payment = page.getByRole('group', { name: 'Update payment status' });
  await expect(statusBadge).toHaveText('Request received');
  await expect(payment.locator('.admin-status')).toHaveText('Unpaid');
  await expect(page.getByRole('button', { name: /Update payment|Update status/ })).toHaveCount(0);
  await expect(
    page.getByText('Cancellation is available only before shipping.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Send the customer a push notification.')).toHaveCount(0);
  await page.screenshot({ path: 'artifacts/order-fulfilment-desktop.png', fullPage: true });
  const dropdown = page.getByRole('combobox', { name: 'Delivery status', exact: true });
  async function checkOptions(current: string, next?: string, cancellable = false) {
    await dropdown.click();
    for (const label of [
      'Request received',
      'Processing',
      'Shipped',
      'Out for delivery',
      'Delivered',
      'Cancelled',
    ]) {
      const option = page.getByRole('option', { name: label, exact: true });
      if (label === current || label === next || (label === 'Cancelled' && cancellable))
        await expect(option).toBeEnabled();
      else await expect(option).toBeDisabled();
    }
    await page.keyboard.press('Escape');
  }
  await checkOptions('Request received', 'Processing', true);
  let writes = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes(`/admin/orders/${orderId}`)) writes++;
  });
  await choose(page, 'Delivery status', 'Request received');
  expect(writes).toBe(0);
  let current = 'Request received';
  for (const stage of ['Processing', 'Shipped', 'Out for delivery', 'Delivered']) {
    await checkOptions(current, stage, current === 'Request received' || current === 'Processing');
    await choose(page, 'Delivery status', stage);
    await expect(statusBadge).toHaveText(stage);
    await expect(page.getByRole('status').filter({ hasText: 'Status saved.' })).toBeVisible();
    await expect(payment.locator('.admin-status')).toHaveText('Unpaid');
    current = stage;
  }
  await checkOptions('Delivered');
  expect(writes).toBe(4);
  await expect(page.getByRole('combobox', { name: 'Delivery status', exact: true })).toHaveText(
    'Delivered',
  );
  await expect(
    page.getByText('This order is delivered. No further delivery changes are available.'),
  ).toBeVisible();
  await choose(page, 'Mark payment as', 'Paid');
  await expect(payment.locator('.admin-status')).toHaveText('Paid');
  await expect(payment.getByRole('status')).toHaveText('Payment status saved.');
  await expect(statusBadge).toHaveText('Delivered');
  await page.reload();
  await expect(payment.locator('.admin-status')).toHaveText('Paid');
  await page.setViewportSize({ width: 393, height: 852 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/order-fulfilment-mobile.png', fullPage: true });
  await choose(page, 'Mark payment as', 'Unpaid');
  await expect(payment.locator('.admin-status')).toHaveText('Unpaid');
  await expect(statusBadge).toHaveText('Delivered');
  const response = await request.get('http://127.0.0.1:54329/rest/v1/storefront_order_requests', {
    headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
  });
  expect(await response.json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ status: 'delivered', payment_status: 'unpaid', item_total: 299 }),
    ]),
  );
  await page.goto('/admin/orders?status=delivered');
  const row = page.getByRole('row').filter({ hasText: '#55555555' });
  await expect(row).toContainText('Delivered');
  await expect(row).toContainText('Unpaid');
  await context.clearCookies();
  await signIn(context, CUSTOMER);
  await page.goto('/account');
  await expect(page.locator('.account-orders .order-status')).toHaveText('Delivered');
  await expect(page.locator('.account-orders')).toContainText('Payment status');
  await expect(page.locator('.account-orders')).toContainText('Unpaid');
});

test('order and payment changes reject stale edits and cancelled orders remain terminal', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  const orderId = '55555555-5555-4555-8555-555555555555';
  await page.goto(`/admin/orders/${orderId}`);
  const response = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_order_status',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: {
        p_order_id: orderId,
        p_status: 'processing',
        p_expected_status: 'awaiting_confirmation',
      },
    },
  );
  expect(response.ok()).toBe(true);
  await choose(page, 'Delivery status', 'Processing');
  await expect(page.locator('.admin-order-status-form').getByRole('alert')).toContainText(
    'Someone changed this record',
  );
  await expect(page.getByRole('combobox', { name: 'Delivery status', exact: true })).toHaveText(
    'Request received',
  );
  await page.reload();
  await choose(page, 'Delivery status', 'Cancelled');
  await expect(page.locator('.admin-panel-heading .admin-status')).toHaveText('Cancelled');
  await expect(page.getByRole('combobox', { name: 'Delivery status', exact: true })).toHaveText(
    'Cancelled',
  );
  await page.getByRole('combobox', { name: 'Delivery status', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Cancelled', exact: true })).toBeEnabled();
  await expect(page.getByRole('option', { name: 'Processing', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  const paid = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_payment_status',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: {
        p_order_id: orderId,
        p_status: 'paid',
        p_expected_status: 'unpaid',
        p_expected_updated_at: '2026-11-02T12:00:00Z',
      },
    },
  );
  expect(paid.ok()).toBe(true);
  await choose(page, 'Mark payment as', 'Paid');
  const payment = page.getByRole('group', { name: 'Update payment status' });
  await expect(payment.getByRole('alert')).toContainText('Someone changed this record');
  await page.reload();
  await expect(payment.locator('.admin-status')).toHaveText('Paid');
});

test('orders dashboard uses three tabs and filters individual statuses within Active', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__orders');
  await signIn(context, OWNER);
  await page.goto('/admin/orders');
  const table = page.getByRole('table', { name: 'Order requests', exact: true });
  const tabs = page.getByRole('navigation', { name: 'Order statuses' });
  const tab = (name: string) => tabs.getByRole('link', { name: new RegExp(`^${name},`) });
  const metric = (label: string) =>
    page
      .locator('.admin-orders-metrics > div')
      .filter({ has: page.getByText(label, { exact: true }) })
      .locator('dd');
  const switchTab = async (name: string, rows: number) => {
    await tab(name).click();
    await expect(tab(name)).toHaveAttribute('aria-current', 'page');
    await expect(table.getByRole('row')).toHaveCount(rows);
  };
  await expect(tabs.getByRole('link')).toHaveCount(3);
  await expect(tab('Pending')).toHaveAttribute('aria-current', 'page');
  await expect(tab('Pending').locator('span')).toHaveText('1');
  await expect(tab('Active').locator('span')).toHaveText('6');
  await expect(tab('Cancelled').locator('span')).toHaveText('1');
  await expect(metric('Total orders')).toHaveText('8');
  await expect(metric('Pending orders')).toHaveText('1');
  await expect(metric('Order value')).toHaveText('₹3,150');
  await expect(metric('Unpaid value')).toHaveText('₹1,050');
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('#11110001');
  await expect(page.getByRole('button', { name: 'Filters', exact: true })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByLabel('From date', { exact: true })).not.toBeVisible();
  await page.screenshot({ path: 'artifacts/orders-dashboard-desktop.png', fullPage: true });
  await switchTab('Active', 7);
  await expect(table).not.toContainText('#11110001');
  await expect(table).not.toContainText('#11110008');
  const status = page.getByLabel('Active status', { exact: true });
  await status.selectOption('confirmed');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('#11110002');
  await expect(tab('Active')).toHaveAttribute('aria-current', 'page');
  await status.selectOption('');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(7);
  await switchTab('Cancelled', 2);
  await expect(table).toContainText('#11110008');
  await expect(status).toHaveCount(0);
  await switchTab('Active', 7);
  await openOrderFilters(page);
  await page.getByLabel('From date', { exact: true }).fill('2026-11-02');
  await page.getByLabel('To date', { exact: true }).fill('2026-11-02');
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByLabel('From date', { exact: true })).not.toBeVisible();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(metric('Total orders')).toHaveText('4');
  await expect(metric('Order value')).toHaveText('₹750');
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table).toContainText('#11110002');
  await expect(table).toContainText('#11110003');
  await expect(table).not.toContainText('#11110004');
  await switchTab('Pending', 2);
  await openOrderFilters(page);
  await page.getByLabel('Payment status', { exact: true }).selectOption('unpaid');
  await page.getByLabel('Payment mode', { exact: true }).selectOption('cash_on_delivery');
  await page.getByRole('searchbox', { name: 'Find an order' }).fill('Anita');
  await page.getByLabel('Sort orders', { exact: true }).selectOption('lowest_total');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(metric('Total orders')).toHaveText('2');
  await expect(metric('Order value')).toHaveText('₹150');
  await expect(metric('Unpaid value')).toHaveText('₹150');
  await switchTab('Cancelled', 2);
  await expect(table).toContainText('#11110008');
  await expect(page).toHaveURL(/from=2026-11-02/);
  await expect(page).toHaveURL(/payment=unpaid/);
  await expect(page.getByRole('searchbox', { name: 'Find an order' })).toHaveValue('Anita');
  await expect(tab('Pending').locator('span')).toHaveText('1');
  await expect(tab('Active').locator('span')).toHaveText('0');
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(metric('Total orders')).toHaveText('8');
  await expect(tab('Cancelled')).toHaveAttribute('aria-current', 'page');
  await switchTab('Active', 7);
  await page.getByRole('searchbox', { name: 'Find an order' }).fill('#11110003');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(table).toContainText('Rina Singh');
  await page.getByRole('searchbox', { name: 'Find an order' }).fill('9876543222');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(table.getByRole('row')).toHaveCount(2);
  await page.getByRole('searchbox', { name: 'Find an order' }).fill('No such customer');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No orders match these filters' })).toBeVisible();
  await expect(metric('Total orders')).toHaveText('0');
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(metric('Total orders')).toHaveText('8');
  await openOrderFilters(page);
  await page.getByLabel('From date', { exact: true }).fill('2026-11-03');
  await page.getByLabel('To date', { exact: true }).fill('2026-11-02');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page.getByText('The end date must be on or after the start date.')).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(metric('Total orders')).toHaveText('8');
  await expect(table.getByRole('row')).toHaveCount(7);
  await page.setViewportSize({ width: 393, height: 852 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/orders-dashboard-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('orders dashboard paginates without changing metrics and keeps filter choices in navigation', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__orders/paged');
  await signIn(context, OWNER);
  await page.goto('/admin/orders?tab=active&sort=oldest');
  const table = page.getByRole('table', { name: 'Order requests', exact: true });
  await expect(table.getByRole('row')).toHaveCount(26);
  await expect(page.locator('.admin-orders-metrics > div').first().locator('dd')).toHaveText('38');
  await expect(page.locator('.admin-orders-metrics')).toContainText('₹6,150');
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/sort=oldest/);
  await expect(table.getByRole('row')).toHaveCount(12);
  await expect(page.locator('.admin-orders-metrics > div').first().locator('dd')).toHaveText('38');
  await page
    .getByRole('navigation', { name: 'Order statuses' })
    .getByRole('link', { name: /^Pending/ })
    .click();
  await expect(page).not.toHaveURL(/page=2/);
  await expect(table.getByRole('row')).toHaveCount(2);
  await expect(page.getByText('1 records · Page 1 of 1')).toBeVisible();
  await openOrderFilters(page);
  await page
    .getByRole('navigation', { name: 'Order date ranges' })
    .getByRole('link', { name: 'Last 7 days', exact: true })
    .click();
  await expect(page).toHaveURL(/tab=pending/);
  await expect(page).toHaveURL(/from=/);
  await expect(page).toHaveURL(/to=/);
  await openOrderFilters(page);
  await page
    .getByRole('navigation', { name: 'Order date ranges' })
    .getByRole('link', { name: 'All time', exact: true })
    .click();
  await expect(table.getByRole('row')).toHaveCount(2);
});

test('admin navigation and editor work on a phone', async ({ page, context }) => {
  await signIn(context, OWNER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Store overview' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).not.toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('navigation', { name: 'Admin navigation' })).toBeVisible();
  const logo = drawer.getByRole('img', { name: 'Daciana — Stationery & Cosmetics' });
  await expect(logo).toBeVisible();
  await expect
    .poll(() => logo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await drawer.getByRole('link', { name: 'Products', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true });
  await page.goto('/admin/products/new');
  await expect(page.getByLabel('Product name', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel('This product has multiple options').check();
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await expect(page.getByLabel('Option 2 name')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: 'test-results/admin-product-new-phone-shadcn.png',
    fullPage: true,
  });
});

test('product deletion requires confirmation, reports concurrent changes and removes the product permanently', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/products');
  const row = page.getByRole('row').filter({ hasText: 'Rose lip tint' });
  const initialWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  await row.getByRole('button', { name: 'Delete Rose lip tint', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Delete product?', exact: true });
  const confirm = dialog.getByRole('button', { name: 'Delete permanently', exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Delete Rose lip tint', exact: true }).click();
  await dialog.getByLabel('Type DELETE to confirm', { exact: true }).fill('delete');
  await expect(confirm).toBeDisabled();

  // Another admin changes stock after this page's product snapshot was read.
  const products = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  const product = products.find((item: { name: string }) => item.name === 'Rose lip tint');
  const variant = product.product_variants[0];
  const changed = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_stock',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: {
        p_variant_id: variant.id,
        p_stock: variant.stock + 1,
        p_expected_updated_at: variant.updated_at,
      },
    },
  );
  expect(changed.ok()).toBe(true);
  await dialog.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
  await confirm.click();
  await expect(dialog.getByRole('alert')).toContainText('Someone changed this record');
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await row.getByRole('button', { name: 'Delete Rose lip tint', exact: true }).click();
  await dialog.getByLabel('Type DELETE to confirm', { exact: true }).fill('DELETE');
  // The product table already scrolls horizontally. The new modal must fit
  // the viewport independently and must not add overflow to that page.
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    initialWidth,
  );
  await page.screenshot({ path: 'test-results/delete-product-mobile.png', fullPage: true });
  await confirm.click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toHaveCount(0);
  await page.reload();
  await expect(row).toHaveCount(0);
  await page.goto('/product/rose-lip-tint');
  await expect(page.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible();
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
  await expect(page.getByRole('row').filter({ hasText: 'Imphal North' })).toContainText('₹80');
  await page.screenshot({ path: 'test-results/admin-shipping.png', fullPage: true });
  await context.clearCookies();
  await signIn(context, CUSTOMER);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/product/rose-lip-tint');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await page.goto('/checkout');
  const submit = page.getByRole('button', { name: 'Confirm and order', exact: true });
  await expect(submit).toBeEnabled();
  const area = page.getByRole('combobox', { name: 'Shipping area', exact: true });
  await area.fill('Central');
  await area.press('ArrowDown');
  await area.press('Enter');
  await expect(page.locator('.summary-total')).toContainText('₹349');
  await page.getByRole('button', { name: 'Clear delivery area' }).click();
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await expect(page.locator('.checkout-delivery-line')).toContainText('Free');
  await expect(page.locator('.summary-total')).toContainText('₹299');
  await page.getByRole('button', { name: 'Clear delivery area' }).click();
  await area.fill('Hidden');
  await expect(
    page.getByRole('listbox', { name: 'Delivery areas' }).getByRole('option'),
  ).toHaveCount(0);
  await expect(page.getByText('No matching area. Try a different area name.')).toBeVisible();
  await expect(submit).toBeEnabled();
  await area.fill('north');
  await page.screenshot({ path: 'test-results/checkout-shipping-dropdown.png', fullPage: true });
  await page.getByRole('option', { name: /Imphal North/ }).click();
  await expect(page.locator('.summary-total')).toContainText('₹379');
  await page.getByRole('button', { name: 'Select delivery address', exact: true }).click();
  await fillAddress(page, 'Test Customer');
  await page.getByLabel('Street address', { exact: true }).fill('12 Example Street');
  await page.getByRole('button', { name: 'Use this address', exact: true }).click();
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await page.getByRole('checkbox', { name: 'I accept the terms and conditions' }).check();
  await submit.click();
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible();
  await expect(page.getByText(/Total ₹379/)).toBeVisible();
  await expect(page.getByText('Cash on Delivery (COD)', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View orders' }).click();
  const order = page.locator('.order-card').filter({ hasText: 'Imphal North' });
  await expect(order).toContainText('₹80');
  await expect(order).toContainText('₹379');
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
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello there', exact: true })).toBeVisible();
  await signIn(context, CUSTOMER);
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/account');
  await page.getByLabel('Full name', { exact: true }).fill('Profile Customer');
  await page.getByLabel('Mobile number', { exact: true }).fill('9876543210');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await expect(page.getByText('Profile updated.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Update profile', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/customer-profile-mobile.png', fullPage: true });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Hello, Profile Customer', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/home-personalized-mobile.png', fullPage: true });
  await page
    .getByRole('navigation', { name: 'App navigation' })
    .getByRole('link', { name: 'Profile', exact: true })
    .click();
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
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hello there', exact: true })).toBeVisible();
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
  await expect(page.getByRole('button', { name: 'Confirm and order', exact: true })).toBeEnabled();
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
  await expect(confirm).toBeEnabled();
  await confirm.click();
  const deliveryLocation = page.getByRole('button', {
    name: 'Select delivery address',
    exact: true,
  });
  await expect(deliveryLocation).toBeFocused();
  await expect(deliveryLocation).toHaveAttribute('data-invalid', 'true');
  await expect(page.getByText('Select a delivery location.', { exact: true })).toBeVisible();
  const acceptTerms = page.getByRole('checkbox', { name: 'I accept the terms and conditions' });
  await page.getByRole('radio', { name: 'Cash on Delivery (COD)', exact: true }).check();
  await acceptTerms.check();
  await expect(confirm).toBeEnabled();
  const area = page.getByRole('combobox', { name: 'Shipping area', exact: true });
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await expect(confirm).toBeEnabled(); // Area chosen, delivery location still missing.
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
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(area).toBeFocused();
  await expect(area).toHaveAttribute('aria-invalid', 'true');
  await acceptTerms.uncheck();
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await expect(confirm).toBeEnabled();
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
  await expect(confirm).toBeEnabled();
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
  await expect(confirm).toBeEnabled();
  await area.fill('Town');
  await page.getByRole('option', { name: /Town Centre/ }).click();
  await confirm.click();
  await expect(page.getByRole('heading', { name: 'Order received' })).toBeVisible();
  await expect(page.locator('.checkout-success')).toContainText('Cash on Delivery (COD)');
  await page.getByRole('link', { name: 'View orders' }).click();
  await expect(
    page.locator('.order-card').filter({ hasText: 'Cash on Delivery (COD)' }),
  ).toContainText('₹299');
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

test('recorder attributes on html do not trigger a hydration warning', async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat|didn.t match/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  await page.addInitScript(() => {
    const decorate = () => {
      if (!document.documentElement) return false;
      document.documentElement.setAttribute('data-scribe-recorder-ready', 'true');
      return true;
    };
    if (!decorate()) {
      const observer = new MutationObserver(() => {
        if (decorate()) observer.disconnect();
      });
      observer.observe(document, { childList: true });
    }
  });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'closed');
  await expect(page.locator('html')).toHaveAttribute('data-scribe-recorder-ready', 'true');
  await page
    .getByRole('navigation', { name: 'App navigation' })
    .getByRole('link', { name: 'More', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Legal', exact: true })).toBeVisible();
  expect(hydrationErrors).toEqual([]);
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

test('new options get distinct automatic SKUs and preserve the chosen default', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin/products/new');
  await page.getByLabel('Product name', { exact: true }).fill('Notebook colours');
  await page.getByLabel('This product has multiple options').check();
  await page.getByLabel('Option 1 name').fill('Cream');
  await page.getByLabel('Option 1 price').fill('149.5');
  await page.getByLabel('Option 1 price').blur();
  await expect(page.getByLabel('Option 1 price')).toHaveValue('150');
  await page.getByLabel('Option 1 stock').fill('0');
  await page.getByLabel('Option 1 stock').press('Backspace');
  await expect(page.getByLabel('Option 1 stock')).toHaveValue('');
  await page.getByLabel('Option 1 stock').fill('6');
  await page.getByRole('button', { name: 'Add option', exact: true }).click();
  await page.getByLabel('Option 2 name').fill('Rose');
  await page.getByLabel('Option 2 price').fill('175');
  await page.getByLabel('Option 2 stock').fill('3');
  await page.getByRole('radio', { name: 'Option 2 default', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Cosmetics', exact: true }).check();
  await expect(page.getByLabel(/SKU/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Save product', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Edit product', exact: true })).toBeVisible();
  await expect(page.getByLabel(/SKU/)).toHaveCount(0);
  const saved = await savedProduct(request, 'Notebook colours');
  const [first, second] = saved.product_variants.map((variant) => variant.sku);
  expect(first).toMatch(/^DA-[0-9A-F-]{36}$/);
  expect(second).toMatch(/^DA-[0-9A-F-]{36}$/);
  expect(first).not.toBe(second);
  await expect(page.getByLabel('Option 2 name')).toHaveValue('Rose');
  await expect(page.getByRole('radio', { name: 'Option 2 default', exact: true })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Cosmetics', exact: true })).toBeChecked();
});

test('shadcn sidebar, account menu and history tabs work without losing admin access controls', async ({
  page,
  context,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin');
  await expect(page.locator('[data-slot="sidebar-wrapper"]')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add product', exact: true })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  );
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await expect(page.locator('[data-state="collapsed"][data-collapsible="icon"]')).toBeVisible();
  await expect(page.getByRole('img', { name: 'Daciana', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Toggle navigation', exact: true }).click();
  await expect(
    page
      .getByRole('navigation', { name: 'Admin navigation' })
      .getByRole('link', { name: 'Products', exact: true }),
  ).toBeVisible();
  await page.goto('/admin/notifications');
  await expect(page.getByRole('tab', { name: 'Push notifications', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByRole('tab', { name: 'Order emails', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Order emails', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Push notifications', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sending history', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Admin account', exact: true }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.getByRole('menuitem', { name: 'Sign out of admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin sign in', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Admin navigation' })).toHaveCount(0);
});

test('Prices uses inline whole-rupee pricing and preserves product details', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/admin/prices');
  await expect(page.getByRole('heading', { name: 'Admin sign in', exact: true })).toBeVisible();
  await signIn(context, CUSTOMER);
  await page.goto('/admin/prices');
  await expect(
    page.getByRole('heading', { name: 'Admin access required', exact: true }),
  ).toBeVisible();
  await context.clearCookies();
  await signIn(context, OWNER);
  await page.goto('/admin/prices');
  const table = page.getByRole('table', { name: 'Product prices' });
  const row = table.getByRole('row', { name: 'Rose lip tint', exact: true });
  await expect(table.getByRole('columnheader', { name: /SKU/ })).toHaveCount(0);
  const price = row.getByLabel('Price (₹)', { exact: true });
  await expect(price).toHaveValue('399');
  await expect(row.getByLabel('Selling price', { exact: true })).toHaveText('₹299');
  const original = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json())[0];
  await price.fill('0');
  await price.press('Backspace');
  await price.blur();
  await expect(price).toHaveValue('');
  await price.fill('499.5');
  await price.blur();
  await expect(price).toHaveValue('500');
  await row.getByLabel('Discount (₹)', { exact: true }).fill('49.5');
  await row.getByLabel('Discount (₹)', { exact: true }).blur();
  await expect(row.getByLabel('Discount (₹)', { exact: true })).toHaveValue('50');
  await expect(row.getByLabel('Selling price', { exact: true })).toHaveText('₹450');
  await row.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(row.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  let updated = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json())[0];
  expect(updated.base_price).toBe(500);
  expect(updated.discount_value).toBe(50);
  for (const field of [
    'name',
    'slug',
    'brand',
    'description',
    'status',
    'thumbnail_url',
    'category_id',
  ])
    expect(updated[field] ?? '').toEqual(original[field] ?? '');
  for (const field of ['id', 'sku', 'stock', 'title', 'is_default', 'image_url', 'hex_code'])
    expect(updated.product_variants[0][field] ?? '').toEqual(
      original.product_variants[0][field] ?? '',
    );
  expect(updated.product_categories).toEqual(original.product_categories);
  await row.getByLabel('Discount type', { exact: true }).selectOption('percentage');
  await row.getByLabel('Discount (%)', { exact: true }).fill('12.5');
  await expect(row.getByLabel('Selling price', { exact: true })).toHaveText('₹438');
  await row.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(row.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  await price.fill('999');
  await row.getByRole('button', { name: 'Reset price for Rose lip tint', exact: true }).click();
  await expect(price).toHaveValue('500');
  await row.getByLabel('Discount type', { exact: true }).selectOption('none');
  await row.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(row.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  await expect(row.getByLabel('Selling price', { exact: true })).toHaveText('₹500');
  updated = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json())[0];
  expect(updated.discount_type).toBe('none');
  expect(updated.discount_value).toBe(0);
  await page.goto('/product/rose-lip-tint');
  await expect(page.locator('.detail-price')).toContainText('₹500');
  await page.goto('/admin/prices?q=not-a-product');
  await expect(page.getByRole('heading', { name: 'No products found', exact: true })).toBeVisible();
});

test('Prices groups variants as editable sub-rows and keeps other drafts intact on mobile', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await signIn(context, OWNER);
  await page.goto('/admin/prices');
  const table = page.getByRole('table', { name: 'Product prices' });
  await expect(table.getByRole('link', { name: 'Colour pencil set', exact: true })).toHaveCount(1);
  const rose = table.getByRole('row', { name: 'Colour pencil set — Rose', exact: true });
  const mint = table.getByRole('row', { name: 'Colour pencil set — Mint', exact: true });
  const sand = table.getByRole('row', { name: 'Colour pencil set — Sand', exact: true });
  await expect(rose).not.toContainText('Colour pencil set');
  await page.screenshot({ path: 'artifacts/prices-desktop.png', fullPage: true });
  await mint.getByLabel('Price (₹)', { exact: true }).fill('300');
  await mint.getByLabel('Discount type', { exact: true }).selectOption('none');
  await rose.getByLabel('Price (₹)', { exact: true }).fill('400');
  await rose.getByLabel('Discount type', { exact: true }).selectOption('percentage');
  await rose.getByLabel('Discount (%)', { exact: true }).fill('50');
  await expect(rose.getByLabel('Selling price', { exact: true })).toHaveText('₹200');
  await rose.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(rose.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  await expect(mint.getByLabel('Price (₹)', { exact: true })).toHaveValue('300');
  let saved = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json()).find(
    (product: { slug: string }) => product.slug === 'colour-pencil-set',
  );
  expect(saved.product_variants[1].price).toBe(399);
  await mint.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(mint.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  await sand.getByLabel('Price (₹)', { exact: true }).fill('250');
  await sand.getByLabel('Discount (₹)', { exact: true }).fill('25');
  await expect(sand.getByLabel('Selling price', { exact: true })).toHaveText('₹225');
  await sand.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(sand.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  saved = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json()).find(
    (product: { slug: string }) => product.slug === 'colour-pencil-set',
  );
  expect(saved.product_variants.map((variant: { price: number }) => variant.price)).toEqual([
    400, 300, 250,
  ]);
  expect(saved.product_variants.map((variant: { sku: string }) => variant.sku)).toEqual([
    'ROSE',
    'MINT',
    'SAND',
  ]);
  expect(saved.product_variants.map((variant: { stock: number }) => variant.stock)).toEqual([
    4, 4, 0,
  ]);
  expect(
    saved.product_variants.map((variant: { is_default: boolean }) => variant.is_default),
  ).toEqual([true, false, false]);
  await rose.getByLabel('Price (₹)', { exact: true }).fill('');
  await rose.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(rose.getByLabel('Price (₹)', { exact: true })).toHaveValue('');
  await mint.getByLabel('Price (₹)', { exact: true }).fill('350');
  await mint.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(mint.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  await expect(rose.getByLabel('Price (₹)', { exact: true })).toHaveValue('');
  await rose
    .getByRole('button', { name: 'Reset price for Colour pencil set — Rose', exact: true })
    .click();
  await expect(rose.getByLabel('Price (₹)', { exact: true })).toHaveValue('400');
  await page.setViewportSize({ width: 393, height: 852 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/prices-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('Prices blocks stale price updates after stock changes and refreshes before retrying', async ({
  page,
  context,
  request,
}) => {
  await signIn(context, OWNER);
  await page.goto('/admin/prices');
  const row = page.getByRole('row', { name: 'Rose lip tint', exact: true });
  const snapshot = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json())[0];
  const variant = snapshot.product_variants[0];
  const stock = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_stock',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: { p_variant_id: variant.id, p_stock: 9, p_expected_updated_at: variant.updated_at },
    },
  );
  expect(stock.ok()).toBe(true);
  await row.getByLabel('Price (₹)', { exact: true }).fill('450');
  await row.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Someone changed this record' }),
  ).toBeVisible();
  await expect(row.getByRole('button', { name: 'Save price', exact: true })).toBeDisabled();
  let saved = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json())[0];
  expect(saved.base_price).toBe(399);
  expect(saved.product_variants[0].stock).toBe(9);
  await page.getByRole('button', { name: 'Refresh prices', exact: true }).click();
  await expect(row.getByLabel('Price (₹)', { exact: true })).toHaveValue('399');
  await row.getByLabel('Price (₹)', { exact: true }).fill('450');
  await row.getByRole('button', { name: 'Save price', exact: true }).click();
  await expect(row.getByRole('status').filter({ hasText: /^Saved$/ })).toHaveText('Saved');
  saved = (await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json())[0];
  expect(saved.base_price).toBe(450);
  expect(saved.product_variants[0].stock).toBe(9);
  expect(saved.product_variants[0].sku).toBe('ROSE-01');
});

test('Prices bulk updates selected variants and reports partial conflicts without changing other prices', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await signIn(context, OWNER);
  await page.goto('/admin/prices');
  for (const title of ['Rose', 'Mint'])
    await page
      .getByRole('checkbox', { name: `Select Colour pencil set — ${title}`, exact: true })
      .check();
  const bulk = page.getByRole('form', { name: 'Bulk price update' });
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(bulk.getByRole('button', { name: 'Update selected', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/prices-bulk-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await bulk.getByLabel('Bulk price (₹)', { exact: true }).fill('600');
  await bulk.getByRole('button', { name: 'Update selected', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Updated prices for 2 rows.' }),
  ).toBeVisible();
  let products = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  let saved = products.find((product: { slug: string }) => product.slug === 'colour-pencil-set');
  expect(saved.product_variants.map((variant: { price: number }) => variant.price)).toEqual([
    600, 600, 399,
  ]);
  expect(
    products.find((product: { slug: string }) => product.slug === 'rose-lip-tint').base_price,
  ).toBe(399);
  await page
    .getByRole('checkbox', { name: 'Select all variants of Colour pencil set', exact: true })
    .check();
  await bulk.getByLabel('Bulk update field', { exact: true }).selectOption('discount');
  await bulk.getByLabel('Bulk discount (%)', { exact: true }).fill('12.5');
  await bulk.getByRole('button', { name: 'Update selected', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Updated prices for 3 rows.' }),
  ).toBeVisible();
  const table = page.getByRole('table', { name: 'Product prices' });
  await expect(
    table
      .getByRole('row', { name: 'Colour pencil set — Rose', exact: true })
      .getByLabel('Selling price', { exact: true }),
  ).toHaveText('₹525');
  await expect(
    table
      .getByRole('row', { name: 'Colour pencil set — Sand', exact: true })
      .getByLabel('Selling price', { exact: true }),
  ).toHaveText('₹349');
  products = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  saved = products.find((product: { slug: string }) => product.slug === 'colour-pencil-set');
  expect(
    saved.product_variants.map((variant: { discount_value: number }) => variant.discount_value),
  ).toEqual([12.5, 12.5, 12.5]);
  await page.getByRole('checkbox', { name: 'Select Rose lip tint', exact: true }).check();
  await page
    .getByRole('checkbox', { name: 'Select Colour pencil set — Mint', exact: true })
    .check();
  const stock = await request.post(
    'http://127.0.0.1:54329/rest/v1/rpc/storefront_admin_set_stock',
    {
      headers: { Authorization: `Bearer ${tokenFor(OWNER)}` },
      data: {
        p_variant_id: saved.product_variants[1].id,
        p_stock: 9,
        p_expected_updated_at: saved.product_variants[1].updated_at,
      },
    },
  );
  expect(stock.ok()).toBe(true);
  await bulk.getByLabel('Bulk update field', { exact: true }).selectOption('price');
  await bulk.getByLabel('Bulk price (₹)', { exact: true }).fill('500');
  await bulk.getByRole('button', { name: 'Update selected', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Updated prices for 1 row.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('alert').filter({ hasText: '1 product was not updated' }),
  ).toBeVisible();
  await expect(
    page.getByRole('checkbox', { name: 'Select Colour pencil set — Mint', exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole('checkbox', { name: 'Select Rose lip tint', exact: true }),
  ).not.toBeChecked();
  products = await (await request.get('http://127.0.0.1:54329/rest/v1/products')).json();
  saved = products.find((product: { slug: string }) => product.slug === 'colour-pencil-set');
  expect(
    products.find((product: { slug: string }) => product.slug === 'rose-lip-tint').base_price,
  ).toBe(500);
  expect(saved.product_variants[1].price).toBe(600);
  expect(saved.product_variants[1].stock).toBe(9);
});

test('Prices category and visibility filters match inventory and persist through pagination', async ({
  page,
  context,
  request,
}) => {
  await request.get('http://127.0.0.1:54329/__gallery');
  await request.get('http://127.0.0.1:54329/__inventory/categories');
  await signIn(context, OWNER);
  await page.goto('/admin/prices');
  const category = page.getByRole('combobox', { name: 'Filter by category', exact: true });
  const table = page.getByRole('table', { name: 'Product prices' });
  await page.getByRole('checkbox', { name: 'Select all rows on this page', exact: true }).check();
  await category.selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(table).toContainText('Colour pencil set');
  await expect(table).not.toContainText('Rose lip tint');
  await expect(page.getByRole('button', { name: 'Update selected' })).toHaveCount(0);
  await category.selectOption('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(table).toContainText('Rose lip tint');
  await expect(table).toContainText('Colour pencil set');
  await page
    .getByRole('combobox', { name: 'Product visibility', exact: true })
    .selectOption('inactive');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No products found', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Clear filters', exact: true }).click();
  await expect(category).toHaveValue('');
  await request.get('http://127.0.0.1:54329/__inventory/categories/paged');
  await page.goto(
    '/admin/prices?category=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb&q=Stationery&status=active',
  );
  await expect(table.getByRole('row')).toHaveCount(26);
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page).toHaveURL(/category=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/);
  await expect(page).toHaveURL(/status=active/);
  await expect(page).toHaveURL(/q=Stationery/);
  await expect(table.getByRole('row')).toHaveCount(6);
});
