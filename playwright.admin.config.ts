import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/admin-browser',
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3002',
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: [
    {
      command: 'node tests/fixtures/admin-api.mjs',
      url: 'http://127.0.0.1:54329/health',
      reuseExistingServer: false,
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3002',
      url: 'http://127.0.0.1:3002/admin',
      env: {
        DARCIANA_TEST_BUILD_DIR: '.next-admin-tests',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54329',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
        SUPABASE_SECRET_KEY: 'test-server-secret',
      },
      reuseExistingServer: false,
      timeout: 120000,
    },
  ],
});
