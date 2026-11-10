import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/dashboard-mobile",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 35000,
  reporter: [
    ["list"],
    [
      "html",
      { outputFolder: "playwright-report-dashboard-mobile", open: "never" },
    ],
  ],
  projects: [
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"], defaultBrowserType: "chromium" },
    },
    {
      name: "iphone-large",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        viewport: { width: 430, height: 932 },
      },
    },
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 900 },
      },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:4187",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npx vite --config vite.dashboard-mobile.config.ts --host 127.0.0.1 --port 4187 --strictPort",
    url: "http://127.0.0.1:4187/e2e/dashboard-mobile/fixture.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
