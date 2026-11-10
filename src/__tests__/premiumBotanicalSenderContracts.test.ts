import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const optIn = readFileSync("supabase/functions/send-opt-in-request/index.ts", "utf8");
const digest = readFileSync("supabase/functions/send-daily-digest/index.ts", "utf8");

describe("premium botanical built-in sender contracts", () => {
  it("uses the shared shell for opt-in requests without changing consent or recipients", () => {
    expect(optIn).toContain("renderBloomSystemEmail({");
    expect(optIn).toContain('brandName: companyName');
    expect(optIn).toContain("bloomEmailEscape(firstName)");
    expect(optIn).toContain("bloomEmailEscape(companyName)");
    expect(optIn).toContain("bloomEmailEscape(preferencesUrl)");
    expect(optIn).toContain('data-no-track="true" clicktracking="off"');
    expect(optIn).toContain('.is("email_opt_in", null)');
    expect(optIn).toContain('purpose: "opt_in_request"');
    expect(optIn).toContain('event_type: "opt_in_request_sent"');
    expect(optIn).toContain("to: [customer.email]");
    expect(optIn).toContain("html: emailHtml");
    expect(optIn).toContain('subject: "Can we send you garden updates?"');
    expect(optIn).toContain("buildFromAddress({");
    expect(optIn).not.toContain("linear-gradient");
  });

  it("uses the shared shell for internal digests, retaining operational facts", () => {
    expect(digest).toContain("renderBloomSystemEmail({");
    expect(digest).toContain('title: "Daily Digest"');
    expect(digest).toContain("statusHtml");
    expect(digest).toContain("healthHtml");
    expect(digest).toContain("activityHtml");
    expect(digest).toContain("reconHtml");
    expect(digest).toContain("Stripe / Notion Reconciliation");
    expect(digest).toContain("escapeHtml(fn)");
    expect(digest).toContain("escapeHtml(firstMessage.slice(0, 120))");
    expect(digest).toContain("to: RECIPIENTS");
    expect(digest).toContain("html: emailHtml");
    expect(digest).toContain('subject: `BloomSuite Daily Digest — ${subjectDate}`');
    expect(digest).not.toContain("#1abc9c");
  });
});
