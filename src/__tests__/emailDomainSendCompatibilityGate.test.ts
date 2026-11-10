import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const repairMigration = readFileSync(
  "supabase/migrations/20260904181500_repair_campaign_domain_auth_gate.sql",
  "utf8",
);

describe("verified email-domain send compatibility gate", () => {
  it("accepts provider-verified SPF, DKIM and return-path evidence for ordinary sends", () => {
    expect(repairMigration).toContain("v_provider_verified");
    expect(repairMigration).toContain("v_spf_ok");
    expect(repairMigration).toContain("v_dkim_ok");
    expect(repairMigration).toContain("v_return_path_ok");
    expect(repairMigration).toContain(
      "v_core_authenticated :=\n    v_provider_verified AND v_spf_ok AND v_dkim_ok AND v_return_path_ok",
    );
    expect(repairMigration).toContain("'allowed', true");
  });

  it("keeps DMARC as a high-volume hard gate without blocking ordinary verified domains", () => {
    expect(repairMigration).toContain(
      "v_high_volume boolean := COALESCE(p_recipient_count, 0) > 50000",
    );
    expect(repairMigration).toContain("v_high_volume AND NOT v_dmarc_ok");
    expect(repairMigration).toContain("dmarc_required_for_high_volume");
    expect(repairMigration).toContain("DMARC is not yet verified");
  });

  it("does not trust the missing legacy compliance object", () => {
    expect(repairMigration).toContain(
      "public.check_send_quota_with_legacy_domain_policy",
    );
    expect(repairMigration).not.toContain(
      "(v_result -> 'compliance' ->> 'authenticated_for_scale')::boolean",
    );
  });

  it("preserves tenant and service-role authorization", () => {
    expect(repairMigration).toContain("app_user.tenant_id = p_tenant_id");
    expect(repairMigration).toContain("Tenant access denied");
    expect(repairMigration).toContain("v_jwt_role <> 'service_role'");
    expect(repairMigration).toContain("FROM PUBLIC, anon");
  });
});
