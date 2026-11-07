import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261107011102_enterprise_bloom_support_reliability_v2.sql",
  "utf8",
);
const webhook = readFileSync("supabase/functions/bloom-support-email/index.ts", "utf8");
const sender = readFileSync("supabase/functions/_shared/bloom-support/email.ts", "utf8");
const worker = readFileSync("supabase/functions/bloom-support-worker/index.ts", "utf8");

describe("Bloom Support email lifecycle contract", () => {
  it("ingests every provider event that changes delivery truth", () => {
    for (const type of ["sent", "delivered", "delivery_delayed", "failed", "suppressed", "bounced", "complained"]) {
      expect(webhook).toContain(type);
    }
    expect(migration).toContain("WHEN 'email.failed' THEN 'failed'");
    expect(migration).toContain("WHEN 'email.suppressed' THEN 'suppressed'");
    expect(migration).toContain("event_status IN ('failed', 'suppressed', 'bounced', 'complained')");
    expect(migration).toContain("id = ANY(coalesce(o.covered_message_ids, '{}'))");
  });

  it("keeps terminal provider outcomes stronger than a late sent event", () => {
    const precedence = migration.slice(migration.indexOf("next_status := CASE"), migration.indexOf("UPDATE bloom_support.outbound_emails"));
    expect(precedence.indexOf("'delivered'")).toBeLessThan(precedence.indexOf("'suppressed'"));
    expect(precedence.indexOf("'suppressed'")).toBeLessThan(precedence.indexOf("'failed'"));
    expect(precedence.indexOf("'failed'")).toBeLessThan(precedence.indexOf("'sent'"));
  });

  it("retries only ambiguous transport, rate limits, server errors, and missing configuration", () => {
    expect(sender).toContain("status === 429 || status >= 500");
    expect(sender).toContain("retryableLedgerFailure(queued.status, queued.error)");
    expect(sender).toContain('`${retryable ? "retryable" : "terminal"} resend ${res.status}');
    expect(worker).toContain('result.status === "not_configured"');
    expect(worker).toContain('result.status === "uncertain" || result.retryable');
    expect(worker).toContain('result.status === "failed"');
  });
});
