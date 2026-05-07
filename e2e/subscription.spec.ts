import { test, expect } from "@playwright/test";

/**
 * Subscription tier change flows.
 *
 * Skeleton only — billing tests must run against Stripe test-mode keys.
 * Never enable this against live Stripe credentials.
 *
 * TODO before enabling:
 *  - Set STRIPE_SECRET_KEY + STRIPE_PUBLISHABLE_KEY to test-mode values in .env.test
 *  - Confirm webhook signing secret is the test-mode secret
 *  - Use Stripe's 4242 4242 4242 4242 test card; any future expiry; any CVC
 */

test.describe("Subscription tier change UI", () => {
  test.skip(
    !process.env.STRIPE_TEST_MODE,
    "STRIPE_TEST_MODE env not set — refusing to run billing tests without test-mode confirmation.",
  );

  test("user can open the billing page and see current tier", async ({
    page,
  }) => {
    // TODO: log in as a tenant admin with a known plan
    await page.goto("/settings/billing");
    await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible();
    // TODO: assert current tier badge is visible
  });

  test("upgrade flow opens Stripe checkout in test mode", async ({ page }) => {
    await page.goto("/settings/billing");
    // TODO: click upgrade button for the next tier
    // TODO: assert redirect lands on checkout.stripe.com (or embedded element)
    // TODO: do NOT submit — assert the URL only
  });

  test("downgrade flow shows confirmation modal and schedules at period end", async ({
    page,
  }) => {
    await page.goto("/settings/billing");
    // TODO: click downgrade button
    // TODO: assert confirmation modal appears explaining the period-end behaviour
    // TODO: cancel out of the modal and assert no state changed
  });
});
