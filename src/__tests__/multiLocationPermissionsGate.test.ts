import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260903154000_multilocation_permissions_foundation.sql",
  ),
  "utf8",
);

describe("multi-location permissions foundation", () => {
  it("supports the required role architecture without removing legacy access", () => {
    for (const role of [
      "owner",
      "admin",
      "marketing",
      "store_manager",
      "staff",
      "team",
    ]) {
      expect(migration).toContain(`'${role}'::text`);
    }
    expect(migration).toContain("public.has_tenant_permission");
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
  });

  it("models locations, assignments, cross-store activity, and scoped campaigns", () => {
    for (const table of [
      "tenant_locations",
      "user_location_access",
      "customer_location_activity",
      "campaign_location_targets",
      "segment_location_targets",
    ]) {
      expect(migration).toContain(`public.${table}`);
      expect(migration).toContain(
        `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`,
      );
    }
    expect(migration).toContain("primary_location_id");
    expect(migration).toContain("selected_locations");
    expect(migration).toContain("users_tenant_id_id_key");
    expect(migration).toContain("crm_customers_tenant_id_id_key");
    expect(migration).not.toContain("UNIQUE NULLS NOT DISTINCT");
  });

  it("makes browser access tenant and location aware", () => {
    expect(migration).toContain("crm_customers_select_by_scope");
    expect(migration).toContain("crm_campaigns_select_by_scope");
    expect(migration).toContain("crm_segments_select_by_scope");
    expect(migration).toContain("customer_segments_select_by_scope");
    expect(migration).toContain("customer_location_activity AS activity");
    expect(migration).toContain("location_scope = 'selected_locations'");
    expect(migration).toContain(
      "has_tenant_permission(tenant_id, 'customer.read', primary_location_id)",
    );
    expect(migration).toContain(
      "has_tenant_permission(tenant_id, 'customer.delete', primary_location_id)",
    );
  });

  it("keeps anonymous callers out of permission and location data", () => {
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.has_tenant_permission[\s\S]*FROM PUBLIC, anon/,
    );
    expect(migration).toMatch(
      /REVOKE ALL ON TABLE public\.tenant_locations[\s\S]*FROM PUBLIC, anon/,
    );
    expect(migration).not.toMatch(/GRANT[^;]+TO anon/);
  });
});
