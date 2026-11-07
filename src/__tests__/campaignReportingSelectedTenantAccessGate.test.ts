import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261107023100_bloom_support_crm_reporting_access.sql",
  "utf8",
);

describe("campaign reporting selected-tenant authorization gate", () => {
  it("uses the canonical tenant and location permission contract", () => {
    expect(migration).toContain("public.has_tenant_permission");
    expect(migration).toContain("when 'all_locations'");
    expect(migration).toContain("when 'one_location'");
    expect(migration).toContain("when 'selected_locations'");
    expect(migration).toContain("from public.campaign_location_targets");
    expect(migration).not.toContain("app_user.tenant_id = v_tenant_id");
  });

  it("keeps both public reporting helpers behind the same authorization boundary", () => {
    const derivedMetrics = migration.slice(
      migration.indexOf("create or replace function public.get_campaign_derived_metrics"),
    );

    expect(derivedMetrics).toContain(
      "public.get_email_campaign_reporting_snapshot(p_campaign_id)->'metrics'",
    );
    expect(derivedMetrics).not.toContain("public._email_campaign_reporting_snapshot");
    expect(migration.match(/from public, anon;/g)).toHaveLength(2);
    expect(migration.match(/to authenticated, service_role;/g)).toHaveLength(2);
  });
});
