import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const hub = readFileSync("src/components/settings/SettingsHub.tsx", "utf8");
const panel = readFileSync(
  "src/components/settings/OrganizationAccessSettings.tsx",
  "utf8",
);

describe("organization access settings", () => {
  it("is available in the live settings hub", () => {
    expect(hub).toContain('id: "organization", label: "Locations & Team"');
    expect(hub).toContain("<OrganizationAccessSettings />");
  });

  it("uses only the authorized management RPCs", () => {
    expect(panel).toContain('"get_tenant_access_overview"');
    expect(panel).toContain('"save_tenant_location"');
    expect(panel).toContain('"set_tenant_user_crm_access"');
    expect(panel).not.toContain('.from("users")');
  });

  it("requires locations for store-scoped roles", () => {
    expect(panel).toContain("isLocationScopedCrmRole(draft.role)");
    expect(panel).toContain("Choose at least one active location for this role");
  });

  it("does not offer self-service role escalation", () => {
    expect(panel).toContain("overview.current_user_id");
    expect(panel).toContain("Another owner or admin must change your access.");
  });
});
