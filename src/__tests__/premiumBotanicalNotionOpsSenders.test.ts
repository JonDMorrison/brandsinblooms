import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(file, "utf8");

describe("premium botanical CRM system and operational senders", () => {
  it("keeps Stripe/Notion reconciliation decisions, recipients and pipeline links", () => {
    const src = read("supabase/functions/reconcile-stripe-notion/index.ts");
    expect(src).toContain("renderBloomSystemEmail({");
    expect(src).toContain('assess, stripeList');
    expect(src).toContain('rpc/reconcile_stripe_notion_snapshot');
    expect(src).toContain('"Idempotency-Key": `stripe-notion-${digest}`');
    expect(src).toContain('to: ["jon@getclear.ca", "jeff@brandsinblooms.com"]');
    expect(src).toContain('subject: `BloomSuite Reconciliation — ${pending.length} changes`');
    expect(src).toContain('escape(i.detail)');
    expect(src).not.toContain('autoFixedItems');
    expect(src).not.toContain('https://api.notion.com/v1/pages/');
    expect(src).toContain("https://www.notion.so/344d234a0ae54f4185e19d260ac658a9");
    expect(src).not.toContain("#1abc9c");
  });

  it("preserves two independent go-live recipient paths and escapes tenant input", () => {
    const src = read("supabase/functions/update-notion-profile/index.ts");
    expect((src.match(/renderBloomSystemEmail\(/g) ?? []).length).toBe(2);
    expect(src).toContain('from: "BloomSuite <hello@brandsinblooms.com>"');
    expect(src).toContain('from: "BloomSuite System <system@bloomsuite.app>"');
    expect(src).toContain("to: email");
    expect(src).toContain('to: Deno.env.get("INTERNAL_ALERT_EMAIL") || "jon@getclear.ca"');
    expect(src).toContain("bloomEmailEscape(gardenCenter)");
    expect(src).toContain("bloomEmailEscape(today)");
  });

  it("renders user-generated ROI alert text safely without modifying the alert decision", () => {
    const src = read("supabase/functions/roi-alert-worker/index.ts");
    expect(src).toContain("renderBloomSystemEmail({");
    expect(src).toContain("bloomEmailEscape(message)");
    expect(src).toContain("title: subject");
    expect(src).toContain("to: users[0].email");
    expect(src).toContain("subject,");
    expect(src).toContain("from: 'alerts@yourdomain.com'");
  });

  it("keeps both welcome messages, original sender identities and unsubscribe copy", () => {
    const src = read("supabase/functions/notify-notion-trial/index.ts");
    expect((src.match(/renderBloomSystemEmail\(/g) ?? []).length).toBe(2);
    expect((src.match(/to: userEmail/g) ?? []).length).toBe(2);
    expect(src).toContain("Your BloomSuite access is ready");
    expect(src).toContain("Welcome to BloomSuite. Here's how to get started.");
    expect(src).toContain("Complete the setup wizard");
    expect(src).toContain("Send your first campaign");
    expect(src).toContain("Book a time with Jon");
    expect(src).toContain("https://www.bloomsuite.app/unsubscribe");
    expect(src).toContain("https://calendly.com/jonmorrison/chat-with-jon");
    expect(src).not.toContain("#1abc9c");
  });
});
