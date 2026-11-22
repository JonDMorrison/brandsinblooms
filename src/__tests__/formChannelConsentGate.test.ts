import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261121143000_form_channel_consent_safety.sql",
  "utf8",
);
const submitForm = readFileSync(
  "supabase/functions/submit-form/index.ts",
  "utf8",
);
const historyMigration = readFileSync(
  "supabase/migrations/20261121210000_form_consent_history_events.sql",
  "utf8",
);
const idempotencyMigration = readFileSync(
  "supabase/migrations/20261121144500_form_submission_idempotency.sql",
  "utf8",
);

describe("form channel consent release gate", () => {
  it("preserves every explicit opt-out and suppression before opting in", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("v_customer.email_opt_out_at is not null");
    expect(migration).toContain("v_customer.sms_opt_out_at is not null");
    expect(migration).toContain("v_status in ('opted_out', 'suppressed')");
    expect(migration).toContain("return 'suppression_preserved'");
  });

  it("routes public form consent through the atomic database function", () => {
    expect(submitForm).toContain('supabase.rpc("apply_form_channel_consent"');
    expect(submitForm).not.toContain("customerData.email_opt_in = true");
    expect(submitForm).not.toContain("customerData.sms_opt_in = true");
  });

  it("deduplicates accepted website events and rejects payload conflicts", () => {
    expect(idempotencyMigration).toContain(
      "form_submissions_accepted_event_unique",
    );
    expect(idempotencyMigration).toContain("where result = 'accepted'");
    expect(submitForm).toContain("Idempotency event conflict");
    expect(submitForm).toContain("idempotent_replay: true");
  });

  it("writes consent history only when consent is granted (QA-17)", () => {
    const preserved = historyMigration.indexOf("return 'suppression_preserved'");
    const emailEvent = historyMigration.indexOf("insert into public.crm_email_consent_events");
    const smsEvent = historyMigration.indexOf("insert into public.crm_sms_consent_events");
    expect(preserved).toBeGreaterThan(0);
    expect(emailEvent).toBeGreaterThan(preserved);
    expect(smsEvent).toBeGreaterThan(preserved);
    expect(historyMigration).toContain("'opt_in', p_source");
    expect(historyMigration).toContain("'express'");
    expect(historyMigration).toContain("v_customer.email_opt_out_at is not null");
    expect(historyMigration).toContain(") to service_role;");
  });

  it("records where a signup came from (QA-16)", () => {
    expect(submitForm).toContain("function resolveFormSignupSource");
    expect(submitForm).toContain("`bloomsites_${placement}`");
    expect(submitForm).toContain("p_source: signupSource");
    expect(submitForm).not.toContain('p_source: "form"');
    expect(submitForm).toContain("customerData.signup_source = signupSource");
    expect(submitForm).toContain("!existingCustomer || !existingCustomer.signup_source");
    expect(submitForm).toContain("placement: meta?.placement || null");
  });
});
