import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser', timeout: 30000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', headless: true, launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] } },
  webServer: { command: 'MAG_MODE=fixture PORT=5174 npm run dev', url: 'http://127.0.0.1:5174/api/health', reuseExistingServer: !process.env.CI },
});
