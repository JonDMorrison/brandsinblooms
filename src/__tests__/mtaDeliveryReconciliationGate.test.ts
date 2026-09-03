import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903130000_mta_delivery_reconciliation.sql",
  "utf8",
);
const worker = readFileSync(
  "supabase/functions/mta-delivery-reconciliation-worker/index.ts",
  "utf8",
);
const sendSms = readFileSync("supabase/functions/send-sms/index.ts", "utf8");
const queueWorker = readFileSync("supabase/functions/sms-queue-worker/index.ts", "utf8");
const functionConfig = readFileSync("supabase/config.toml", "utf8");

describe("MTA delivery reconciliation release gate", () => {
  it("keeps reconciliation RPCs service-only and delivery events idempotent", () => {
    expect(migration).toContain("UNIQUE (provider, provider_message_id, provider_status)");
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.apply_sms_delivery_status_batch[\s\S]*anon, authenticated/);
    expect(migration).toContain("TO service_role");
  });

  it("prevents a late intermediate provider status from regressing a final state", () => {
    expect(migration).toContain("IF v_target_rank < v_current_rank THEN");
    expect(migration).toContain("v_outcome := 'stale_status'");
  });

  it("authenticates the worker and persists its pagination cursor", () => {
    expect(worker).toContain("requireInternalApiKey(req)");
    expect(worker).toContain('url.searchParams.set("page", String(page))');
    expect(worker).toContain('"complete_sms_delivery_reconciliation"');
    expect(functionConfig).toMatch(
      /\[functions\.mta-delivery-reconciliation-worker\]\s+verify_jwt = false/,
    );
  });

  it("never fabricates a provider message ID after an accepted send", () => {
    for (const source of [sendSms, queueWorker]) {
      expect(source).not.toContain("sendData.messageId || sendData.id || crypto.randomUUID()");
      expect(source).toContain("MTA_MESSAGE_ID_MISSING");
      expect(source).toContain("provider_message_id");
    }
  });
});
