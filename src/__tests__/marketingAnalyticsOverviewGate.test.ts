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


const posHook = readFileSync("src/hooks/usePOSAnalytics.ts", "utf8");
const posMigration = readFileSync(
  "supabase/migrations/20261015235900_unified_pos_analytics_reporting.sql",
  "utf8",
);
const home = readFileSync("src/pages/BloomSuiteDashboard.tsx", "utf8");
const analyticsPage = readFileSync("src/pages/AnalyticsPage.tsx", "utf8");
const setupBanner = readFileSync(
  "src/components/dashboard/SetupNextStepsBanner.tsx",
  "utf8",
);
const analyticsUtils = readFileSync("src/components/analytics/analyticsUtils.ts", "utf8");

describe("truthful dashboard consolidation gate", () => {
  it("maintains effective tenant and RLS rules for all-provider POS reporting", () => {
    expect(posMigration).toContain("SECURITY INVOKER");
    expect(posMigration).toContain("public.get_current_crm_access()");
    expect(posMigration).toContain("'reports.read'");
    expect(posMigration).toContain("tenant_id = v_tenant_id");
    expect(posMigration).toContain("GROUP BY currency");
    expect(posMigration).toContain("REVOKE ALL ON FUNCTION public.get_pos_analytics_summary");
    expect(posHook).toContain('get_pos_analytics_summary');
    expect(posHook).not.toContain('.from("pos_orders")');
    expect(posHook).toContain("hasMixedCurrencies");
  });

  it("keeps the home task-first and advanced analytics discoverable", () => {
    expect(home).toContain("Reachable customers");
    expect(home).toContain("Click-through rate");
    expect(home).not.toContain("<POSInsightsCard");
    expect(home).not.toContain("setTimeout(");
    for (const view of ["overview", "campaigns", "customers", "sales"]) {
      expect(analyticsPage).toContain(`id: "${view}"`);
    }
    expect(analyticsPage).toContain("showChannels ?");
  });

  it("uses a valid customer import entry and honest reporting periods", () => {
    expect(setupBanner).toContain("/crm/customers?import=1");
    expect(setupBanner).not.toContain('href: "/crm/contacts"');
    expect(analyticsUtils).toContain('{ label: "365d", value: 365 }');
    expect(analyticsUtils).not.toContain('value: 3650');
  });
});
