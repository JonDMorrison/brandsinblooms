import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903121500_sms_delivery_consent_gate.sql",
  "utf8",
);
const channelConsentMigration = readFileSync(
  "supabase/migrations/20260903142617_atomic_channel_consent_management.sql",
  "utf8",
);
const outboxWorker = readFileSync(
  "supabase/functions/process-automation-outbox/index.ts",
  "utf8",
);
const queueWorker = readFileSync(
  "supabase/functions/sms-queue-worker/index.ts",
  "utf8",
);
const enqueueWorker = readFileSync(
  "supabase/functions/sms-campaign-enqueue-worker/index.ts",
  "utf8",
);
const consentGate = readFileSync(
  "supabase/functions/_shared/smsConsentGate.ts",
  "utf8",
);
const directSender = readFileSync(
  "supabase/functions/send-sms/index.ts",
  "utf8",
);
const functionConfig = readFileSync("supabase/config.toml", "utf8");

describe("SMS delivery consent release gate", () => {
  it("repairs the queue schema contract and expires unsafe backlog", () => {
    for (const column of ["tenant_id", "billable_units", "billed_at"]) {
      expect(migration).toContain(`ADD COLUMN IF NOT EXISTS ${column}`);
    }
    expect(migration).toContain("STALE_MESSAGE");
    expect(migration).toContain("interval '24 hours'");
  });

  it("requires current, documented consent on the canonical customer", () => {
    expect(channelConsentMigration).toContain("sms_opt_in IS DISTINCT FROM true");
    expect(channelConsentMigration).not.toContain("coalesce(v_customer.opt_out, false)");
    expect(channelConsentMigration).toContain("v_customer.sms_opt_in_at IS NULL");
    expect(channelConsentMigration).toContain("v_customer.sms_consent_source");
    expect(channelConsentMigration).toContain("merged_into_customer_id IS NULL");
    expect(channelConsentMigration).toContain("FROM public.suppression_list AS suppression");
  });

  it("blocks a queued phone after the customer changes it", () => {
    expect(migration).toContain("SMS_RECIPIENT_CHANGED");
    expect(migration).toContain("v_recipient_digits <> v_customer_digits");
  });

  it("fails closed when the database consent decision is unavailable", () => {
    expect(consentGate).toContain("SMS_CONSENT_CHECK_FAILED");
    expect(consentGate).toContain("return FAILED_CHECK");
  });

  it("rechecks consent in automation and campaign delivery workers", () => {
    expect(outboxWorker).toContain("checkSmsSendEligibility");
    expect(queueWorker).toContain("blockIfSmsIneligible");
    expect(queueWorker).toMatch(/failure_type: ["']compliance["']/);
    expect(queueWorker).toMatch(/eventType: ["']BLOCKED_SEND["']/);
    expect(directSender).toContain("checkSmsSendEligibility");
    expect(directSender).toMatch(/purpose !== ["']test["']/);
  });

  it("claims SMS jobs atomically in the database", () => {
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(queueWorker).toContain("claim_sms_send_jobs");
    expect(queueWorker).not.toContain(
      "const claimableJobs = eligibleJobs.filter",
    );
  });

  it("restores idempotent billing for provider-accepted messages", () => {
    expect(migration).toContain("FUNCTION public.bill_sms_message");
    expect(migration).toContain("FOR UPDATE");
    expect(migration).toContain("v_message.billed_at IS NOT NULL");
    expect(migration).toContain(
      "sms_usage = coalesce(sms_usage, 0) + p_billable_units",
    );
    expect(queueWorker).not.toContain("billed_at: msg.billed_at");
  });

  it("keeps workers internal and schedules both queue stages", () => {
    expect(queueWorker).toContain("requireInternalApiKey(req)");
    expect(enqueueWorker).toContain("requireInternalApiKey(req)");
    expect(enqueueWorker).toContain("No campaigns need enqueueing.");
    expect(directSender).toContain("requireInternalApiKey(req)");
    expect(functionConfig).toMatch(
      /\[functions\.send-sms\]\s+verify_jwt = false/,
    );
    expect(migration).toContain("sms-campaign-enqueue-worker-v2");
    expect(migration).toContain("sms-queue-worker-v2");
    expect(migration).toContain("'apikey', public.get_service_role_key()");
  });
});
