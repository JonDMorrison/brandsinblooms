import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for running E2E tests against the live production site.
 *
 * Usage:
 *   E2E_EMAIL=you@example.com E2E_PASSWORD=secret \
 *     npx playwright test --config=playwright.prod.config.ts
 *
 * Without E2E_EMAIL / E2E_PASSWORD the auth setup project will fail and
 * any test that depends on it ("chromium") will be skipped, but the
 * unauthenticated smoke tests will still run.
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
    // 1. Auth setup — logs in and saves storageState
    {
      name: "setup",
      testDir: "./e2e/setup",
      testMatch: "auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },

    // 2. Authenticated tests — depend on setup, reuse saved session
    {
      name: "chromium",
      testMatch: "**/*.spec.ts",
      testIgnore: "**/setup/**",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },
  ],
  // No webServer — tests run against the live site
});
