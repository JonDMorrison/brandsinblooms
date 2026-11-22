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


describe("connected SMS draft schema", () => {
  const sql = readFileSync("supabase/migrations/20261122060000_connected_content_sms_drafts.sql", "utf8");
  it("requires save and launch permissions separately", () => {
    expect(sql).toContain("auth.uid() IS NULL");
    expect(sql).toContain("public.has_tenant_permission(p_tenant_id, 'campaign.write'");
    expect(sql).toContain("p_launch AND NOT public.has_tenant_permission(p_tenant_id, 'campaign.send'");
    expect(sql).toContain("FROM PUBLIC, anon");
  });
  it("keeps unconfirmed audiences out of schedules and queues", () => {
    expect(sql).toContain("audience_confirmed OR (status = 'draft' AND scheduled_at IS NULL)");
    expect(sql).toContain("p_launch OR p_audience IS NOT NULL OR p_scheduled_at IS NOT NULL");
    expect(sql).toContain("Choose an audience and write a message before launch");
  });
  it("preserves source binding and rejects stale cross-business draft edits", () => {
    expect(sql).toContain("connection.tenant_id = p_tenant_id AND connection.status = 'active'");
    expect(sql).toContain("tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE");
    expect(sql).toContain("v_campaign.updated_at <> p_expected_updated_at");
    expect(sql).not.toContain("SET connected_content_sources");
  });
});


describe("connected campaign review schema", () => {
  const sql=readFileSync("supabase/migrations/20261122070000_replace_connected_sms_draft.sql","utf8");
  it("requires scoped explicit replacement and preserves delivered message history", () => {
    expect(sql).toContain("tenant_id=p_tenant_id AND source='connected_content' FOR UPDATE");
    expect(sql).toContain("v_original.status <> 'paused'");
    expect(sql).toContain("v_original.updated_at <> p_expected_updated_at");
    expect(sql).toContain("status='queued' AND twilio_sid IS NULL");
    expect(sql).toContain("replacement_campaign_id");
    expect(sql).toContain("p_sources,NULL,false,NULL");
  });
  it("atomically merges only service-authenticated review metadata", () => {
    expect(sql).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(sql).toContain("jsonb_set(coalesce(metrics,'{}'::jsonb),'{content_review}'");
    expect(sql).toContain("status=p_expected_status");
    expect(sql).toContain("status IN ('draft','scheduled','queued','sending','paused')");
    expect(sql).toContain("FROM PUBLIC, anon, authenticated");
  });
  it("distinguishes legacy email payloads from explicit source snapshots", () => {
    expect(sql).toContain("public.email_messages ADD COLUMN connected_content_sources jsonb");
    expect(sql).toContain("connected_content_sources IS NULL OR jsonb_typeof(connected_content_sources)='array'");
  });
});
