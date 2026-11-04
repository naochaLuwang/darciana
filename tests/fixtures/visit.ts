import { expect, type Page } from '@playwright/test';
export async function visit(page: Page, path: string) {
  const response = await page.goto(path);
  // Wait for the app shell's viewport behavior before interacting with SSR fields.
  await expect(page.locator('html')).toHaveAttribute('data-keyboard', 'closed');
  return response;
}
