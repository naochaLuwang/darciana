import { expect, type APIRequestContext, type Page } from '@playwright/test';

export async function checkProductGalleries(
  page: Page,
  request: APIRequestContext,
  native = false,
) {
  await request.get('http://127.0.0.1:54329/__gallery');
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('https://images.example.test/**', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect x="50" y="40" width="140" height="220" rx="20" fill="#b97991"/></svg>',
    }),
  );
  const prefix = native ? '/#' : '';
  await page.goto(`${prefix}/product/rose-lip-tint`);
  let gallery = page.getByRole('region', { name: 'Rose lip tint photos', exact: true });
  const activeImage = () =>
    gallery.getByRole('group', { name: 'Current product photo', exact: true }).getByRole('img');
  const thumbnails = () => gallery.getByRole('button', { name: /Show photo/ });
  await expect(thumbnails()).toHaveCount(3);
  await expect(activeImage()).toHaveAttribute('src', /simple-front\.png$/);
  await gallery.getByRole('button', { name: 'Next photo', exact: true }).click();
  await expect(activeImage()).toHaveAttribute('src', /simple-back\.png$/);
  await gallery.getByRole('button', { name: 'Show photo 3 of 3', exact: true }).click();
  await expect(activeImage()).toHaveAttribute('src', /simple-detail\.png$/);
  await gallery.getByRole('group', { name: 'Current product photo' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(activeImage()).toHaveAttribute('src', /simple-back\.png$/);
  const photo = await gallery.getByRole('group', { name: 'Current product photo' }).boundingBox();
  await page.mouse.move(photo!.x + photo!.width * 0.8, photo!.y + photo!.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(photo!.x + photo!.width * 0.2, photo!.y + photo!.height * 0.4, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(activeImage()).toHaveAttribute('src', /simple-detail\.png$/);

  await page.goto(`${prefix}/product/colour-pencil-set`);
  gallery = page.getByRole('region', { name: /^Colour pencil set.*photos$/ });
  await expect(thumbnails()).toHaveCount(2);
  await expect(activeImage()).toHaveAttribute('src', /rose-front\.png$/);
  await expect(gallery.locator('img[src*="shared-product"]')).toHaveCount(0);
  await gallery.getByRole('button', { name: 'Next photo', exact: true }).click();
  await expect(activeImage()).toHaveAttribute('src', /rose-back\.png$/);
  await page.getByRole('button', { name: 'Mint', exact: true }).click();
  await expect(thumbnails()).toHaveCount(3);
  await expect(activeImage()).toHaveAttribute('src', /mint-front\.png$/);
  await expect(gallery.locator('img[src*="rose-"]')).toHaveCount(0);
  await expect(gallery.locator('.gallery-count')).toHaveText('1 / 3');
  await gallery.getByRole('button', { name: 'Show photo 3 of 3' }).click();
  await expect(activeImage()).toHaveAttribute('src', /mint-detail\.png$/);
  await page.getByRole('button', { name: 'Rose', exact: true }).click();
  await expect(activeImage()).toHaveAttribute('src', /rose-front\.png$/);
  await expect(gallery.locator('.gallery-count')).toHaveText('1 / 2');
  await page.getByRole('button', { name: 'Sand', exact: true }).click();
  await expect(gallery.getByText('Photos unavailable for this option')).toBeVisible();
  await expect(thumbnails()).toHaveCount(0);
  await expect(gallery.locator('img[src*="images.example.test"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Mint', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/${native ? 'native' : 'web'}-product-gallery-mobile.png`,
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  // A failed gallery request keeps the selected option's legacy image and can retry.
  await request.get('http://127.0.0.1:54329/__gallery/unavailable');
  await page.reload();
  await expect(gallery.getByText('More photos couldn’t load.')).toBeVisible();
  await expect(activeImage()).toHaveAttribute('src', /rose-front\.png$/);
  await expect(gallery.locator('img[src*="shared-product"]')).toHaveCount(0);
  await request.get('http://127.0.0.1:54329/__gallery/available');
  await gallery.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(thumbnails()).toHaveCount(2);
  await expect(gallery.getByText('More photos couldn’t load.')).toHaveCount(0);
}
