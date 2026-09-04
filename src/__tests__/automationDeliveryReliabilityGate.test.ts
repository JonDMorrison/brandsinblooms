import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const outboxWorker = readFileSync(
  "supabase/functions/process-automation-outbox/index.ts",
  "utf8",
);
const transactionalSender = readFileSync(
  "supabase/functions/send-transactional-email/index.ts",
  "utf8",
);
const retryWorker = readFileSync(
  "supabase/functions/retry-automation-email-node/index.ts",
  "utf8",
);
const automationExecutor = readFileSync(
  "supabase/functions/automation-executor/index.ts",
  "utf8",
);
const emailRenderer = readFileSync(
  "supabase/functions/_shared/emailRenderer.ts",
  "utf8",
);
const failureMigration = readFileSync(
  "supabase/migrations/20260904000000_fail_automation_run_with_outbox.sql",
  "utf8",
);

describe("automation delivery reliability", () => {
  it("uses the outbox identity as the provider idempotency key", () => {
    expect(outboxWorker).toContain(
      "idempotency_key: `automation/${message.id}`",
    );
    expect(transactionalSender).toContain('"Idempotency-Key"');
    expect(transactionalSender).toContain(
      'fetch("https://api.resend.com/emails"',
    );
    expect(retryWorker).toContain(
      "idempotency_key: `automation-retry/${execution.id}`",
    );
  });

  it("does not continue a customer journey after terminal delivery failure", () => {
    expect(outboxWorker).not.toContain("const SOFT_FAILURE_MODE = true");
    expect(outboxWorker).not.toContain('status: "soft_failed"');
    expect(outboxWorker).toContain("Failed to finalize outbox failure");
    expect(outboxWorker).toContain('status: "failed"');
    expect(failureMigration).toContain(
      "CREATE TRIGGER fail_automation_run_with_outbox",
    );
    expect(failureMigration).toContain("next_step_scheduled_at = NULL");
    expect(failureMigration).toContain("AND run.tenant_id = NEW.tenant_id");
  });

  it("recovers a provider-accepted send without relaying it or skipping a step", () => {
    expect(outboxWorker).toContain('if (sendResult.error === "already_sent")');
    expect(outboxWorker).toContain("Failed to recover sent acknowledgement");
    expect(outboxWorker).toContain(
      "const nextStepIndex = message.step_index + 1",
    );
    expect(outboxWorker).toMatch(
      /\.insert\(\{[\s\S]*step_index: nextStepIndex[\s\S]*const \{ error: advanceError \}/,
    );
  });

  it("classifies provider failures for retry instead of retrying every error", () => {
    expect(transactionalSender).toContain(
      "resendResponse.status === 429 || resendResponse.status >= 500",
    );
    expect(outboxWorker).toContain("data?.canRetry");
  });

  it("does not expose the low-level sender to ordinary authenticated users", () => {
    expect(transactionalSender).toContain('"is_master_admin"');
    expect(transactionalSender).toContain(
      'JSON.stringify({ error: "Forbidden" })',
    );
  });

  it("tenant-scopes manual retries and requires automation permission", () => {
    expect(retryWorker).toContain('"get_current_crm_access"');
    expect(retryWorker).toContain('permissions.includes("automations.manage")');
    expect(retryWorker).toContain("automation.tenant_id !== callerTenantId");
  });

  it("carries real trigger data through every email and SMS step", () => {
    expect(automationExecutor).toContain("event.metadata?.provider_event");
    expect(automationExecutor).toContain("trigger_data: triggerContext");
    expect(outboxWorker).toContain(
      "run.trigger_data || message.template_data?.trigger_data || {}",
    );
    expect(outboxWorker).toContain(
      "supplementalData: templateData.trigger_data || null",
    );
    expect(emailRenderer).toContain("...supplementalData");
  });

  it("does not invent offers, discount codes, or compliance links", () => {
    for (const source of [automationExecutor, outboxWorker]) {
      expect(source).not.toContain("https://example.com");
      expect(source).not.toContain("WELCOME10");
      expect(source).not.toContain("20% off your next purchase");
      expect(source).not.toContain("unsubscribe_url: '#'");
    }
    expect(automationExecutor).not.toContain("personalizeMessage");
  });

  it("does not complete all-skipped journeys or consume temporary provider outages", () => {
    expect(automationExecutor).toContain(
      "requiredChannelStates.every((channel) => !channel.available)",
    );
    expect(automationExecutor).toContain("retryable: true");
    expect(automationExecutor).toContain("if (providerCheck.retryable)");
    expect(automationExecutor).toContain(
      "await deferTriggerEvent(supabase, event.id, retryAt)",
    );
    expect(automationExecutor).toContain(
      'reason: "No authenticated sending domain is available"',
    );
  });
});
