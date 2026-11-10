import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20261107014000_bloom_support_operational_truth.sql",
  ),
  "utf8",
);

describe("Bloom Support operational truth migration", () => {
  it("counts only genuinely open escalations and separates test traffic", () => {
    expect(migration).toContain("WHERE status = 'open'");
    expect(migration).toContain("WHERE status = 'acknowledged'");
    expect(migration).toContain("bloom_support.is_test_job(j)");
    expect(migration).toContain("'test_jobs'");
    expect(migration).toContain("'dead_jobs_24h'");
  });

  it("retires only the known dead preview artifact with an audit record", () => {
    const retirement = migration.slice(
      migration.indexOf("WITH candidates AS"),
      migration.indexOf("-- The cleanup primitive"),
    );
    expect(retirement).toContain("idempotency_key = 'preview:emails:1'");
    expect(retirement).toContain("last_error ILIKE '%replace%'");
    expect(retirement).toContain("last_error ILIKE '%undefined%'");
    expect(retirement).toContain("'job.preview_artifact_retired'");
    expect(retirement).not.toContain("DELETE FROM bloom_support.jobs");
  });

  it("reconciles stale effect claims on a bounded recurring schedule", () => {
    expect(migration).toContain("'bloom-support-reconcile-claims'");
    expect(migration).toContain("'*/5 * * * *'");
    expect(migration).toContain("SELECT bloom_support.cleanup_mcp_idempotency()");
  });

  it("uses exact-once deterministic client-action acknowledgements", () => {
    const action = migration.slice(
      migration.indexOf("CREATE OR REPLACE FUNCTION bloom_support.client_action"),
    );
    expect(action).toContain("'system', 'public', 'outbound'");
    expect(action).toContain("ON CONFLICT (idempotency_key) DO NOTHING");
    expect(action).toContain("I’m Bloom, the BloomSuite support agent");
    expect(action).toContain("Thanks for confirming it’s fixed");
    expect(action).toContain("'email:message:' || acknowledgement_id::text");
    expect(action).not.toContain("ai.call");
  });
});
