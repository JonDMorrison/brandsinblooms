import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903161000_pos_location_normalization.sql",
  "utf8",
);
const liveSync = readFileSync(
  "supabase/functions/vmx-sync-receipts/index.ts",
  "utf8",
);
const backfill = readFileSync(
  "supabase/functions/vmx-backfill-receipts/index.ts",
  "utf8",
);

describe("POS location normalization", () => {
  it("uses provider-scoped store identifiers and tenant-safe foreign keys", () => {
    expect(migration).toContain("tenant_locations_source_external_key");
    expect(migration).toContain("UNIQUE (tenant_id, source_system, external_location_id)");
    expect(migration).toContain("pos_receipts_location_tenant_fkey");
    expect(migration).toContain(
      "REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT",
    );
  });

  it("maps all new VMX receipts to a normalized store", () => {
    expect(migration).toContain("assign_vmx_receipt_location_trigger");
    expect(migration).toContain("BEFORE INSERT OR UPDATE OF tenant_id, division_id");
    expect(migration).toContain("public.resolve_pos_location(");
    expect(migration).toContain(
      "VMX receipt location assignment requires service authorization",
    );
  });

  it("recomputes exact activity instead of incrementing counters", () => {
    expect(migration).toContain("count(DISTINCT receipt.external_receipt_id)");
    expect(migration).toContain("min(receipt.post_date)");
    expect(migration).toContain("max(receipt.post_date)");
    expect(migration).toContain("PARTITION BY activity.customer_id");
    expect(migration).not.toContain("visit_count = activity.visit_count +");
  });

  it("keeps location reconciliation in both live and backfill workers", () => {
    expect(liveSync).toContain("failed to persist");
    expect(liveSync).not.toContain("batch upsert error page");
    expect(liveSync).toContain('"recompute_vmx_customer_locations"');
    expect(liveSync).toContain("VMX location activity reconciliation failed");
    expect(backfill).toContain('"recompute_vmx_customer_locations"');
    expect(backfill).toContain("Location activity rollup failed");
  });

  it("does not expose internal reconciliation RPCs to browser roles", () => {
    expect(migration).toContain(
      "FROM PUBLIC, anon, authenticated",
    );
    expect(migration).toContain("TO service_role");
  });
});
