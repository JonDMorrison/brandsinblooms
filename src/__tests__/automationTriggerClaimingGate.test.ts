import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903114500_automation_trigger_claiming.sql",
  "utf8",
);
const executor = readFileSync(
  "supabase/functions/automation-executor/index.ts",
  "utf8",
);

describe("automation trigger claiming release gate", () => {
  it("claims due trigger events atomically with stale-lock recovery", () => {
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("claimed_by = v_worker_id");
    expect(migration).toContain("e.queued_until <= now()");
    expect(executor).toContain("claim_due_automation_trigger_events");
    expect(executor).not.toContain("Fetch unprocessed trigger events");
  });

  it("requires the claiming worker to complete, defer, or fail an event", () => {
    expect(migration.match(/claimed_by = p_worker_id/g)?.length).toBe(3);
    expect(executor).toContain("complete_automation_trigger_event");
    expect(executor).toContain("defer_automation_trigger_event");
    expect(executor).toContain("fail_automation_trigger_event");
  });

  it("retries transient failures with bounded exponential backoff", () => {
    expect(migration).toContain("coalesce(retry_count, 0) + 1");
    expect(migration).toContain("least(60, power(2");
    expect(migration).toContain("'terminal', v_processed_at IS NOT NULL");
  });

  it("loads the configured overlap behavior for scheduled automations", () => {
    expect(executor).toMatch(/version,\s+overlap_behavior/);
  });

  it("keeps every trigger mutation service-role only", () => {
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.(claim_due|complete|defer|fail)_automation_trigger_event[\s\S]*TO authenticated/,
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.claim_trigger_events(text, integer)",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.release_stale_claims(integer)",
    );
  });
});
