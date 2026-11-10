import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903220000_reliable_scheduled_sms_claim.sql",
  "utf8",
);
const enqueueWorker = readFileSync(
  "supabase/functions/sms-campaign-enqueue-worker/index.ts",
  "utf8",
);
const sendCampaign = readFileSync(
  "supabase/functions/send-sms-campaign/index.ts",
  "utf8",
);
const wizard = readFileSync("src/components/sms/SMSCampaignWizard.tsx", "utf8");
const legacyComposer = readFileSync(
  "src/components/crm/campaign-composer/SMSCampaignComposer.tsx",
  "utf8",
);

describe("scheduled SMS reliability gate", () => {
  it("atomically claims only due schedules and fails very late sends closed", () => {
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("campaign.scheduled_at <= now()");
    expect(migration).toContain(
      "campaign.scheduled_at >= now() - p_max_lateness",
    );
    expect(migration).toContain(
      "Scheduled send expired before it could be queued",
    );
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("bridges scheduled campaigns into the existing idempotent queue", () => {
    expect(enqueueWorker).toContain("claim_due_sms_campaign_for_enqueue");
    expect(enqueueWorker).toContain("claim_sms_campaign_enqueue");
    expect(enqueueWorker).toContain('["queued", "sending"]');
  });

  it("preserves persona targeting instead of falling through to all subscribers", () => {
    expect(enqueueWorker).toContain("get_sms_persona_recipient_page");
    expect(migration).toContain(
      "assignment.persona_id = ANY(v_campaign.targeting_persona_ids)",
    );
    expect(migration).toContain(
      "lower(coalesce(v_campaign.targeting_logic, 'any'))",
    );
  });

  it("uses the same consent-safe count for immediate and scheduled sends", () => {
    expect(sendCampaign).toContain("count_sms_campaign_recipients");
    expect(migration).toContain("customer.sms_opt_in_at IS NOT NULL");
    expect(migration).toContain(
      "nullif(customer.sms_consent_source, '') IS NOT NULL",
    );
    expect(migration).toContain("NOT coalesce(customer.opt_out, false)");
    expect(migration).toContain("NOT coalesce(customer.suppressed, false)");
  });

  it("queues Send Now and blocks empty audiences", () => {
    expect(wizard).toContain('"SMS campaign queued for sending"');
    expect(wizard).toContain('functions.invoke("send-sms-campaign"');
    expect(wizard).toContain("recipientEstimate > 0");
    expect(legacyComposer).toContain("body: { campaignId: savedCampaign.id }");
    expect(legacyComposer).not.toContain("body: { campaign_id:");
    expect(legacyComposer).not.toContain("status: sendNow ? 'sent'");
  });

  it("authorizes tenant senders and the internal scheduled worker", () => {
    expect(sendCampaign).toContain("isInternalRequest");
    expect(sendCampaign).toContain(
      "You do not have permission to send this campaign",
    );
    expect(sendCampaign).toContain('["owner", "admin", "team", "marketing"]');
  });
});
