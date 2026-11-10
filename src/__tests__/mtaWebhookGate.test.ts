import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webhook = readFileSync("supabase/functions/mta-webhook/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260903133000_mta_signed_webhooks.sql",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");
const retiredHandlers = [
  readFileSync("supabase/functions/twilio-inbound-sms/index.ts", "utf8"),
  readFileSync("supabase/functions/handle-sms-reply/index.ts", "utf8"),
];

describe("signed MTA webhook release gate", () => {
  it("authenticates provider callbacks over the exact raw bytes before processing", () => {
    expect(webhook).toContain("new Uint8Array(await req.arrayBuffer())");
    expect(webhook).toContain('req.headers.get("X-Signature")');
    expect(webhook).toContain("verifyMtaWebhookSignature");
    expect(webhook.indexOf("verifyMtaWebhookSignature")).toBeLessThan(
      webhook.indexOf('supabase.rpc("apply_sms_delivery_status_batch"'),
    );
    expect(config).toMatch(/\[functions\.mta-webhook\]\s+verify_jwt = false/);
  });

  it("registers delivery and reply webhooks with retries and a secret", () => {
    expect(webhook).toContain('["delivery-status", "message-reply"]');
    expect(webhook).toContain("secret: webhookSecret");
    expect(webhook).toContain("retryOnError: true");
    expect(webhook).toContain("skipErrors: false");
    expect(webhook).toContain('root?.action === "configure"');
    expect(webhook).toContain("requireInternalApiKey(req)");
  });

  it("makes inbound replies replay-safe and keeps consent channel-specific", () => {
    expect(migration).toContain("UNIQUE (provider, provider_reply_id)");
    expect(migration).toContain("ON CONFLICT (provider, provider_reply_id) DO NOTHING");
    expect(migration).toContain("sms_opt_in = false");
    expect(migration).toContain("sms_consent = false");
    expect(migration).not.toMatch(/\bopt_out\s*=\s*(true|false)/);
    expect(migration).toContain("customer_id, channel, status");
    expect(migration).toContain("'SMS_OPTED_OUT'");
  });

  it("fails STOP safe across ambiguous tenants but never applies ambiguous START", () => {
    expect(migration).toContain("ELSIF v_keyword = 'stop' THEN");
    expect(migration).toContain("v_target_customers := coalesce(v_phone_customers");
    expect(migration).toContain("ELSIF v_customer_id IS NULL AND coalesce(cardinality(v_phone_customers), 0) > 1");
    expect(migration).toContain("v_resolution := 'ambiguous_phone'");
  });

  it("keeps the mutation RPC service-only and retires unsigned Twilio handlers", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.apply_mta_inbound_sms\(jsonb\)[\s\S]*anon, authenticated/);
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.apply_mta_inbound_sms(jsonb) TO service_role");
    for (const handler of retiredHandlers) {
      expect(handler).toContain("status: 410");
      expect(handler).not.toContain("createClient");
      expect(handler).not.toContain("sms_opt_in");
    }
  });
});
