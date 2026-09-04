import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hook = readFileSync("src/hooks/useAnalyticsOverview.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260904014500_tenant_marketing_analytics_overview.sql",
  "utf8",
);

describe("marketing analytics overview gate", () => {
  it("does not restore retired social-media analytics reads", () => {
    expect(hook).not.toContain('.from("analytics_data")');
    expect(hook).not.toContain('.from("post_performance")');
    expect(hook).toContain('"get_marketing_analytics_overview"');
  });

  it("resolves the effective CRM tenant and requires reporting permission", () => {
    expect(migration).toContain("public.get_current_crm_access()");
    expect(migration).toContain("'reports.read'");
    expect(migration).toContain("campaign.tenant_id = v_tenant_id");
    expect(migration).toContain("tenant_id = v_tenant_id");
  });

  it("keeps the reporting RPC authenticated-only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_marketing_analytics_overview(integer)",
    );
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_marketing_analytics_overview(integer)",
    );
    expect(migration).toContain("TO authenticated, service_role");
  });
});
