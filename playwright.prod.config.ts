import { defineConfig, devices } from "@playwright/test";

const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "https://www.bloomsuite.app";

/**
 * Playwright config for running E2E tests against the live production site by
 * default. PLAYWRIGHT_BASE_URL may be supplied by CI to certify a built QA
 * artifact before it is merged; the post-merge workflow leaves it unset and
 * therefore still verifies https://www.bloomsuite.app.
 *
 * The authenticated release suites share one persisted master-admin tenant
 * context. Keep execution serial so one spec cannot restore/clear that context
 * while another spec is still navigating the tenant workspace.
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
  workers: 1,
  use: {
    baseURL: BASE_URL,
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
  // No webServer — CI either targets production or starts a QA preview first.
});
