import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getIntegrationSeed } from "@/components/integrations/integrationsHubConfig";
import { PROVIDERS } from "@/components/integrations/pos/providers";

const CLOVER_FUNCTIONS = [
  "clover-full-sync",
  "clover-manage-webhooks",
  "clover-oauth-callback",
  "clover-oauth-start",
  "clover-sync-customers",
  "clover-sync-products",
  "clover-sync-sales",
  "clover-test-connection",
  "clover-test-harness",
  "clover-webhook-handler",
  "clover-webhook-health",
];

describe("Clover vendor approval boundary", () => {
  it("defaults every Clover server endpoint closed while preserving staged code", () => {
    const approvalGate = readFileSync(
      "supabase/functions/_shared/cloverApprovalGate.ts",
      "utf8",
    );

    expect(approvalGate).toContain(
      'Deno.env.get("CLOVER_INTEGRATION_APPROVED") === "true"',
    );
    expect(approvalGate).toContain("VENDOR_APPROVAL_PENDING");
    expect(approvalGate).toContain("status: 503");

    for (const functionName of CLOVER_FUNCTIONS) {
      const source = readFileSync(
        `supabase/functions/${functionName}/index.ts`,
        "utf8",
      );
      expect(source).toContain("requireCloverApproval");
      expect(source).toContain("if (approvalResponse) return approvalResponse");
    }
  });

  it("marks Clover coming soon in both integration catalogs", () => {
    expect(getIntegrationSeed("clover")).toMatchObject({
      defaultStatus: "coming-soon",
      canDisconnect: false,
      actionLabel: "Notify me",
    });
    expect(PROVIDERS.find((provider) => provider.id === "clover")).toMatchObject({
      connectMethod: "coming_soon",
      connectHandler: null,
    });
  });

  it("does not bundle or invoke Clover OAuth from active application routes", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    const posHub = readFileSync("src/pages/integrations/POSIntegrationsHub.tsx", "utf8");
    const detailHook = readFileSync("src/hooks/useIntegrationDetailData.ts", "utf8");

    expect(app).not.toContain('import("@/pages/integrations/clover/CallbackPage")');
    expect(app).not.toContain('import("@/pages/integrations/clover/GuidePage")');
    expect(app).toContain('to="/integrations/clover"');
    expect(posHub).not.toContain('"clover-oauth-start"');
    expect(detailHook).toContain('"clover",\n  "hubspot"');
    expect(detailHook).toContain(
      'if (seed.defaultStatus === "coming-soon")',
    );
  });
});
