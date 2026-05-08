import { test, expect } from "@playwright/test";

/**
 * CASL compliance flows.
 *
 * Coverage gaps this file is intended to address:
 *  - Unsubscribe link works from a sent email and updates the contact's
 *    consent_status / unsubscribed_at columns.
 *  - CASL footer (sender identification + physical address + unsubscribe
 *    mechanism) is present on every outbound email template.
 *  - A contact marked unsubscribed cannot be re-included in a new send.
 *
 * Skeleton only — selectors and routes below are TODO until a tester wires
 * this up against a seeded test tenant. Use the publishable key constant from
 * src/integrations/supabase/config.ts for any direct Supabase calls.
 */

test.describe("CASL compliance — unsubscribe + footer", () => {
  test.skip(
    true,
    "TODO: wire up against seeded test tenant + mailhog/test SMTP before enabling.",
  );

  test("unsubscribe link from a sent email opts the contact out", async ({
    page,
  }) => {
    // TODO: pre-seed a test contact with consent_status = 'subscribed'
    // TODO: trigger a send to that contact (via test SMTP, not real provider)
    // TODO: extract the unsubscribe URL from the captured message
    // The token is consumed by the validate-preference-token edge
    // function and lands the user on /email-preferences?token=...
    // (route mounted in src/App.tsx as <EmailPreferences />).
    await page.goto("/email-preferences?token=TODO");
    await expect(
      page.getByRole("heading", { name: /unsubscribe/i }),
    ).toBeVisible();
    // TODO: confirm the unsubscribe action
    // TODO: assert the contact's consent_status flipped to 'unsubscribed' via Supabase REST
  });

  test("every email template renders the CASL footer", async ({ page }) => {
    // TODO: enumerate template IDs from the campaign builder
    // TODO: for each, open the preview and assert footer contains:
    //   - sender business name
    //   - physical mailing address
    //   - unsubscribe link
    await page.goto("/campaigns/templates");
    await expect(page.getByText(/unsubscribe/i)).toBeVisible();
  });

  test("unsubscribed contacts are excluded from new audience selections", async ({
    page,
  }) => {
    // TODO: log in as tenant admin (use #signin-email / #signin-password
    // selectors per CLAUDE.md auth-and-browser-test rules)
    // TODO: create a new campaign, open audience builder
    // TODO: assert unsubscribed contacts are filtered out of count and preview
    await page.goto("/campaigns/new");
    await expect(page).toHaveURL(/campaigns/);
  });
});
