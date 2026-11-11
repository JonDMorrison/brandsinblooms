import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/loyalty",
  testMatch: "*.spec.ts",
  timeout: 45000,
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-loyalty", open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4179",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npx vite --host 127.0.0.1 --port 4179 --strictPort",
    url: "http://127.0.0.1:4179/e2e/loyalty/fixture.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
