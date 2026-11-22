import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903120000_automation_atomic_enrollment.sql",
  "utf8",
);
const executor = readFileSync(
  "supabase/functions/automation-executor/index.ts",
  "utf8",
);

describe("automation atomic enrollment release gate", () => {
  it("serializes enrollment for each automation and customer", () => {
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("hashtextextended(p_automation_id::text");
    expect(migration).toContain("SELECT coalesce(max(r.run_sequence), 0) + 1");
    expect(executor).toContain("begin_automation_run");
  });

  it("implements every supported overlap decision in the transaction", () => {
    for (const behavior of ["ignore", "restart", "parallel", "queue"]) {
      expect(migration).toContain(`WHEN '${behavior}'`);
    }
    expect(migration).toContain("Cancelled due to re-trigger (restart mode)");
    expect(migration).toContain("o.status IN ('queued', 'retrying', 'processing')");
  });

  it("prevents duplicate live outbox rows for the same run step", () => {
    expect(migration).toContain("idx_crm_outbox_live_run_step_unique");
    expect(migration).toContain("automation_run_id, step_index");
  });

  it("uses atomic enrollment for scheduled and event-driven execution", () => {
    expect(executor.match(/await createAutomationRun\(/g)?.length).toBe(2);
    expect(executor).not.toContain("const { data: maxSeqData }");
    expect(executor).not.toContain("const { data: existingRun }");
    expect(executor).toContain("enrollment.decision === 'queued'");
  });

  it("fails a newly started run if its initial step cannot enqueue", () => {
    expect(executor.match(/failAutomationRunStart/g)?.length).toBe(3);
    expect(executor).toContain("Initial step enqueue failed:");
    expect(executor.match(/if \(scheduleError\) throw scheduleError/g)?.length).toBe(
      2,
    );
  });

  it("keeps enrollment service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.begin_automation_run",
    );
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.begin_automation_run[\s\S]*TO authenticated/,
    );
  });
});

const loyaltyMigration = readFileSync(
  "supabase/migrations/20261122052828_loyalty_enrollment_delivery.sql", "utf8",
);

describe("loyalty enrollment delivery contract", () => {
  it("binds a claimed loyalty event to one durable run", () => {
    expect(loyaltyMigration).toContain("event_id uuid PRIMARY KEY");
    expect(loyaltyMigration).toContain("run_id uuid NOT NULL UNIQUE");
    expect(loyaltyMigration).toContain("e.claimed_by IS DISTINCT FROM p_worker_id");
    expect(loyaltyMigration).toContain("'decision','resumed'");
    expect(loyaltyMigration).toContain("message_status='skipped'");
    expect(loyaltyMigration).toContain("'step_status',message_status");
    expect(loyaltyMigration).toContain("'step_index',r.current_step_index");
  });
  it("creates messages only through a scoped service-only allowlist", () => {
    expect(loyaltyMigration).toContain("p_step_index<>r.current_step_index");
    expect(loyaltyMigration).toContain("public.advance_loyalty_automation_step");
    expect(loyaltyMigration).toContain("o.status='skipped'");
    expect(loyaltyMigration).toContain("jsonb_object_keys(p_message)");
    expect(loyaltyMigration).toContain("r.tenant_id<>e.tenant_id");
    expect(loyaltyMigration).toContain("FROM PUBLIC,anon,authenticated,service_role");
    expect(loyaltyMigration).toContain("'outbox_id',message_id,'existing',true");
  });
  it("does not backfill or infer enrollment from provider snapshots", () => {
    expect(loyaltyMigration).toContain("AFTER INSERT ON public.perks_enrollment_events");
    expect(loyaltyMigration).not.toContain("AFTER INSERT ON public.crm_customers");
    expect(loyaltyMigration).not.toContain("AFTER INSERT ON public.loyalty_provider_accounts");
    expect(loyaltyMigration).not.toContain("UPDATE public.crm_automations");
    expect(loyaltyMigration).not.toContain("email_opt_in");
    expect(loyaltyMigration).not.toContain("sms_opt_in");
  });
});
