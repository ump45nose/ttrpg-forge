import { defineConfig } from "@playwright/test";

/**
 * Table-side flows on a phone-sized screen, against the production build so the
 * service worker (offline) is real. Uses the installed Chrome: no browser download.
 */
export default defineConfig({
  testDir: "e2e",
  testIgnore: "**/pages.spec.ts",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:4180",
    channel: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? undefined : "chrome",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : undefined,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm build && pnpm preview --port 4180 --strictPort",
    url: "http://localhost:4180",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
