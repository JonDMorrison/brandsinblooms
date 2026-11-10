import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const handler = readFileSync(
  "supabase/functions/clover-webhook-handler/index.ts",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260903203000_pos_webhook_event_dedup.sql",
  "utf8",
);

describe("Clover webhook contract", () => {
  it("implements Clover app authentication and payload shape", () => {
    expect(handler).toContain('request.headers.get("x-clover-auth")');
    expect(handler).toContain("payload.merchants");
    expect(handler).toContain("Object.entries(payload.merchants)");
    expect(handler).toContain("verificationCode");
    expect(handler).not.toContain("x-clover-signature");
    expect(handler).not.toContain("HMAC");
  });

  it("dereferences documented Clover object IDs", () => {
    for (const key of ["O", "P", "C", "I"]) {
      expect(handler).toContain(`kind === "${key}"`);
    }
    expect(handler).toContain("?expand=lineItems,customers,payments,refunds");
  });

  it("uses canonical customer and normalized order ledgers", () => {
    expect(handler).toContain('"resolve_provider_customer_identity_batch"');
    expect(handler).toContain('provider: "clover"');
    expect(handler).toContain("external_location_id: connection.merchant_id");
    expect(handler).toContain('"recalculate_purchase_metrics"');
    expect(handler).not.toContain("customer_external_id");
    expect(handler).not.toContain("order_number:");
  });

  it("deduplicates events in a service-only table", () => {
    expect(handler).toContain('.from("pos_webhook_events")');
    expect(handler).toContain('eventError?.code === "23505"');
    expect(migration).toContain("UNIQUE(provider, event_id)");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.pos_webhook_events FROM PUBLIC, anon, authenticated",
    );
  });

  it("connects POS events to email/SMS journeys", () => {
    expect(handler).toContain("fireAutomationTriggers(");
    for (const trigger of [
      "payment.completed", "refund.created", "first_purchase", "review_request",
    ]) {
      expect(handler).toContain(`"${trigger}"`);
    }
  });
});
