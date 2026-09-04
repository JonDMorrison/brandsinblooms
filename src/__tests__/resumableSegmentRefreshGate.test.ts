import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903223000_resumable_segment_membership_refresh.sql",
  "utf8",
);
const worker = readFileSync(
  "supabase/functions/recompute-all-tenants-segments/index.ts",
  "utf8",
);

describe("resumable dynamic-segment refresh", () => {
  it("stores service-only tenant cursors and uses expiring leases", () => {
    expect(migration).toContain("crm_segment_recompute_jobs");
    expect(migration).toContain("FOR UPDATE SKIP LOCKED");
    expect(migration).toContain("claimed_until");
    expect(migration).toContain("worker_token");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("replaces the disabled nightly job with a Vault-backed minute worker", () => {
    expect(migration).toContain("recompute-all-system-segments-nightly");
    expect(migration).toContain("segment-membership-refresh-worker");
    expect(migration).toContain("'* * * * *'");
    expect(migration).toContain("public.get_service_role_key()");
    expect(migration).not.toMatch(/eyJ[a-zA-Z0-9_-]+\./);
  });

  it("processes a bounded customer page and advances only its own lease", () => {
    expect(worker).toContain("const BATCH_SIZE = 1000");
    expect(worker).toMatch(/rpc\(\s*"claim_segment_recompute_job"/);
    expect(worker).toMatch(/rpc\(\s*"finish_segment_recompute_batch"/);
    expect(worker).toContain("customer_ids: customerIds");
    expect(worker).toContain("customerIds.length < BATCH_SIZE");
    expect(worker).toContain("Segment refresh lease was lost");
    expect(worker).toContain("segment-refresh lease release failed");
  });

  it("accepts only the internal service credential", () => {
    expect(worker).toContain(
      'req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`',
    );
    expect(worker).toContain("status: 401");
  });
});
