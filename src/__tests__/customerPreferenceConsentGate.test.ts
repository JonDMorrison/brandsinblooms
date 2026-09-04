import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/EmailPreferences.tsx", "utf8");
const preferenceWorker = readFileSync(
  "supabase/functions/update-email-preference/index.ts",
  "utf8",
);
const segmentWorker = readFileSync(
  "supabase/functions/evaluate-customer-segments/index.ts",
  "utf8",
);

describe("customer preference and selected-segment release gate", () => {
  it("requires an affirmative channel choice when consent is unknown", () => {
    expect(page).toContain('"subscribe" | "unsubscribe" | null');
    expect(page).toContain("initialPreferences.emailOptIn === true");
    expect(page).toContain("initialPreferences.emailOptIn === false");
    expect(page).toContain("disabled={submitting || preference === null}");
    expect(page).toContain(
      "Choose whether you want marketing emails before saving.",
    );
    expect(page).not.toMatch(
      /useState<"subscribe" \| "unsubscribe">\(\s*"subscribe"/,
    );
  });

  it("stores customer-selected fields and refreshes dynamic memberships", () => {
    expect(preferenceWorker).toContain("p_topics: interests");
    expect(preferenceWorker).toContain(
      "p_gardening_experience: gardeningExperience",
    );
    expect(preferenceWorker).toContain('"evaluate-customer-segments"');
    expect(preferenceWorker).toContain("customer_id: tokenData.customer_id");
    expect(preferenceWorker).toContain("tenant_id: tokenData.tenant_id");
  });

  it("denies cross-tenant refresh requests from authenticated users", () => {
    expect(segmentWorker).toContain("callerUserId = authData.user.id");
    expect(segmentWorker).toMatch(
      /\.from\("users"\)[\s\S]*\.eq\("id", callerUserId\)[\s\S]*\.eq\("tenant_id", tenant_id\)/,
    );
    expect(segmentWorker).toContain("status: 403");
    expect(segmentWorker).toContain('"Tenant access denied"');
  });
});
