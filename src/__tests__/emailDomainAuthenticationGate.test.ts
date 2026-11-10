import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903221030_require_authenticated_campaign_domains.sql",
  "utf8",
);
const verifier = readFileSync(
  "supabase/functions/email-domain-verify/index.ts",
  "utf8",
);
const preflight = readFileSync(
  "src/components/crm/campaigns/CampaignSendConfirmationModal.tsx",
  "utf8",
);
const sendingErrors = readFileSync(
  "src/utils/campaignSendingErrors.ts",
  "utf8",
);

describe("email domain authentication release gate", () => {
  it("blocks every campaign size when authentication is incomplete", () => {
    expect(migration).toContain("domain_authentication_incomplete");
    expect(migration).toContain("authenticated_for_scale");
    expect(migration).not.toContain("v_is_high_volume");
    expect(migration).toContain(
      "verified SPF, DKIM, return-path, DMARC (p=none minimum), and domain ownership",
    );
    expect(migration).toContain("app_user.tenant_id = p_tenant_id");
    expect(migration).toContain("Tenant access denied");
    expect(migration).toContain("v_jwt_role <> 'service_role'");
  });

  it("does not call a domain ready while provider verification or DMARC is missing", () => {
    expect(verifier).toContain("ACTION_REQUIRED_AUTHENTICATION");
    expect(verifier).toContain("!allProviderVerified || !dmarcVerified");
    expect(verifier).toContain("allPassed && dmarcOk");
    expect(verifier).not.toContain(
      "if (allDnsVerifiedIndependently) return 'active';",
    );
  });

  it("uses authentication evidence in the final campaign preflight", () => {
    expect(preflight).toContain("assessDomainAuthentication");
    expect(preflight).toContain("authentication.ready");
    expect(preflight).toContain("authentication.message");
  });

  it("shows an actionable authentication error instead of a generic failure", () => {
    expect(sendingErrors).toContain("DOMAIN_AUTHENTICATION_REQUIRED");
    expect(sendingErrors).toContain("domain_authentication_incomplete");
    expect(sendingErrors).toContain(
      "Verify SPF, DKIM, return-path, DMARC, and domain ownership",
    );
  });
});
