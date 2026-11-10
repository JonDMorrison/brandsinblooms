import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903160000_location_access_management.sql",
  "utf8",
);

describe("location access management contract", () => {
  it("keeps inactive locations from granting access", () => {
    expect(migration).toContain("JOIN public.tenant_locations AS location");
    expect(migration).toContain("AND location.is_active");
    expect(migration).toContain("Deactivation revokes assignments");
    expect(migration).toContain("'revoked_user_ids'");
  });

  it("exposes hardened overview, assignment, and location RPCs", () => {
    for (const signature of [
      "get_tenant_access_overview(uuid)",
      "set_tenant_user_crm_access(uuid, text, uuid[])",
      "save_tenant_location(uuid, text, text, text, boolean)",
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${signature}`);
    }
    expect(migration.match(/SET search_path = ''/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).not.toMatch(/GRANT EXECUTE[^;]+TO anon/);
  });

  it("prevents invalid scoped roles and last-admin demotion", () => {
    expect(migration).toContain(
      "Store managers and staff require at least one active location",
    );
    expect(migration).toContain("Cannot demote the last tenant administrator");
    expect(migration).toContain(
      "Every assigned location must be active and belong to the tenant",
    );
  });

  it("audits permission and location changes", () => {
    expect(migration).toContain("public.crm_access_audit");
    expect(migration).toContain("'role_change'");
    expect(migration).toContain("'location_assignment'");
    expect(migration).toContain("'location_created'");
    expect(migration).toContain("'location_updated'");
  });
});
