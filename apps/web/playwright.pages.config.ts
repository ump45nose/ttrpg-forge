import { defineConfig } from '@playwright/test';

const base = process.env.VITE_BASE_PATH || '/ttrpg-forge/';
export default defineConfig({
  testDir: 'e2e',
  testMatch: 'pages.spec.ts',
  timeout: 45_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:4181${base}`,
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? undefined : 'chrome',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm -w build:pages && node ../../tools/deploy/serve-pages.mjs',
    url: `http://127.0.0.1:4181${base}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
