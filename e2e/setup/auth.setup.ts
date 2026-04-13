import { test as setup, expect } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FILE = path.join(__dirname, "../.auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_EMAIL and E2E_PASSWORD environment variables are required.\n" +
        "Run with: E2E_EMAIL=you@example.com E2E_PASSWORD=secret npx playwright test",
    );
  }

  // Navigate to the login page
  await page.goto("/auth");

  // Fill in credentials
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Submit the form
  await page.click('button[type="submit"]');

  // Wait for auth to complete — the app redirects away from /auth on success.
  // Allow up to 15s for Supabase auth round-trip + initial data load.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 15000,
  });

  // Extra guard: make sure no error toast is showing
  const errorToast = page.locator("text=Invalid login credentials");
  await expect(errorToast).not.toBeVisible({ timeout: 3000 });

  // Save signed-in state for other tests to reuse
  await page.context().storageState({ path: AUTH_FILE });
});
