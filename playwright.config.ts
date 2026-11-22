import { defineConfig } from '@playwright/test';

// Locally the tests use the installed Chrome. In CI they use Playwright's Chromium.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    ...(process.env.CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
