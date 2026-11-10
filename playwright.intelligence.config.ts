import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e/intelligence",
  testMatch: "*.spec.ts",
  workers: 1,
  timeout: 45000,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-intelligence", open: "never" }],
  ],
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  use: {
    baseURL: "http://127.0.0.1:4186",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "npx vite --config vite.intelligence-preview.config.ts --host 127.0.0.1 --port 4186 --strictPort",
    url: "http://127.0.0.1:4186/e2e/intelligence/fixture.html",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
