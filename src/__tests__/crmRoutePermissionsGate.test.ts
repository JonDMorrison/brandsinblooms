import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/App.tsx", "utf8");
const accessGate = readFileSync(
  "src/components/crm/CRMAccessGate.tsx",
  "utf8",
);

describe("CRM route permissions", () => {
  it("uses the live CRM access resolver instead of an allow-all gate", () => {
    expect(accessGate).toContain("useUserRole()");
    expect(accessGate).toContain("hasPermission(requiredPermission)");
    expect(accessGate).toContain("<Navigate");
    expect(accessGate).not.toContain("all users have access");
  });

  it("protects the primary CRM route families with explicit permissions", () => {
    for (const permission of [
      "customers.read",
      "customers.write",
      "campaigns.read",
      "campaigns.write",
      "segments.manage",
      "automations.manage",
      "reports.read",
      "integrations.manage",
      "content.design",
      "access.manage",
    ]) {
      expect(app).toContain(`"${permission}"`);
    }
  });

  it("gates the integration tree once at its route layout", () => {
    expect(app).toMatch(
      /function IntegrationsRouteLayout[\s\S]*requiredPermission="integrations\.manage"[\s\S]*<Outlet \/>/,
    );
  });
});
