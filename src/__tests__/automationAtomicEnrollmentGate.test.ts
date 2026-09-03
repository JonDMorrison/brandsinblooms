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
