import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync("supabase/functions/bloom-support-worker/index.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20261107011102_enterprise_bloom_support_reliability_v2.sql",
  "utf8",
);

describe("feature and repair client workflows", () => {
  it("closes an answered feature request instead of waiting on a reply nobody requested", () => {
    const featureBranch = worker.slice(
      worker.indexOf('job.payload.mode === "feature_decision"'),
      worker.indexOf("const lastClient", worker.indexOf('job.payload.mode === "feature_decision"')),
    );
    expect(featureBranch).toContain('status: "resolved"');
    expect(featureBranch).toContain('stage: "resolved"');
    expect(featureBranch).toContain("feature_decision_message_id");
    expect(featureBranch).not.toContain('waiting_reason: "customer"');
    expect(featureBranch).not.toContain('stage: "awaiting_client"');
  });

  it("drops superseded repair updates before they can create an email burst", () => {
    expect(worker).toContain("skipped: superseded engineering progress");
    const producer = migration.slice(migration.indexOf("CREATE OR REPLACE FUNCTION bloom_support.queue_engineering_progress_email"));
    expect(producer).toContain("old_progress.payload->>'status' IS DISTINCT FROM NEW.status");
    expect(producer).toContain("SET status = 'cancelled', last_error = 'superseded by newer engineering progress'");
    expect(producer).toContain("outbound.provider_id IS NULL");
    expect(producer).not.toContain("outbound.status IN ('uncertain'");
  });
});
