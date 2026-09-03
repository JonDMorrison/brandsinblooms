import { describe, expect, it } from "vitest";

import { findAffectedEdgeFunctions } from "../../scripts/find-affected-edge-functions.mjs";

describe("edge deployment dependency scope", () => {
  it("does not deploy the fleet for UI-only changes", () => {
    expect(
      findAffectedEdgeFunctions(["src/pages/crm/EmailPreferences.tsx"]),
    ).toMatchObject({ deployAll: false, functions: [] });
  });

  it("deploys a directly changed function", () => {
    const result = findAffectedEdgeFunctions([
      "supabase/functions/validate-preference-token/index.ts",
    ]);

    expect(result.deployAll).toBe(false);
    expect(result.functions).toEqual(["validate-preference-token"]);
  });

  it("finds direct and transitive consumers of a shared evaluator", () => {
    const result = findAffectedEdgeFunctions([
      "supabase/functions/_shared/segmentEvaluator.ts",
    ]);

    expect(result.deployAll).toBe(false);
    expect(result.functions).toEqual(
      expect.arrayContaining([
        "bloom-assist",
        "evaluate-customer-segments",
        "evaluate-segments",
        "recompute-segment-memberships",
      ]),
    );
    expect(result.functions.length).toBe(4);
  });

  it("follows nested suppression dependencies", () => {
    const result = findAffectedEdgeFunctions([
      "supabase/functions/_shared/canSendEmail.ts",
    ]);

    expect(result.deployAll).toBe(false);
    expect(result.functions).toEqual(
      expect.arrayContaining([
        "evaluate-customer-segments",
        "evaluate-segments",
        "recompute-segment-memberships",
      ]),
    );
  });

  it("reserves full-fleet deployment for runtime configuration", () => {
    const result = findAffectedEdgeFunctions([
      "supabase/functions/deno.json",
    ]);

    expect(result.deployAll).toBe(true);
    expect(result.functions.length).toBeGreaterThan(100);

    expect(
      findAffectedEdgeFunctions(["supabase/config.toml"]),
    ).toMatchObject({ deployAll: true });
  });
});
