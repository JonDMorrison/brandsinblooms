import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for running E2E tests against the live production site.
 * Usage: npx playwright test --config=playwright.prod.config.ts
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "https://www.bloomsuite.app",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer — tests run against the live site
});
