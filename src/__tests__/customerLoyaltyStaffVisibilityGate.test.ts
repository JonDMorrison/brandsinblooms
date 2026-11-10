import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { transformToLoyaltyMetrics } from "@/lib/customerDashboardTransformers";
import type { CustomerLoyaltyAccount } from "@/types/customerMetrics";

const account: CustomerLoyaltyAccount = {
  provider: "crm_import",
  program_name: "Imported POS loyalty balance",
  balance: 42.5,
  balance_unit: "unknown",
  currency: null,
  enrolled_at: null,
  last_synced_at: "2026-09-03T12:00:00Z",
};

describe("staff customer loyalty visibility release gate", () => {
  it("shows provider accounts as enrolled without fabricating native activity", () => {
    const metrics = transformToLoyaltyMetrics(null, null, [account]);

    expect(metrics.isPerksEnrolled).toBe(true);
    expect(metrics.hasNativeActivity).toBe(false);
    expect(metrics.providerAccounts).toEqual([
      {
        provider: "crm_import",
        programName: "Imported POS loyalty balance",
        balance: 42.5,
        balanceUnit: "unknown",
        currency: null,
        lastSyncedAt: "2026-09-03T12:00:00Z",
      },
    ]);
  });

  it("does not send provider account identifiers to the browser", () => {
    const hook = readFileSync("src/hooks/useLoyaltyMetrics.ts", "utf8");

    expect(hook).toContain("LOYALTY_ACCOUNT_FIELDS");
    expect(hook).toContain(
      '"provider, program_name, balance, balance_unit, currency, enrolled_at, last_synced_at"',
    );
    expect(hook).not.toMatch(/LOYALTY_ACCOUNT_FIELDS\s*=\s*[\s\S]{0,200}external_account_id/);
  });

  it("labels balance-only imports without claiming earn, redeem, or tier data", () => {
    const component = readFileSync(
      "src/components/crm/customer-dashboard/LoyaltyIncentivesImpact.tsx",
      "utf8",
    );

    expect(component).toContain("Current provider balances");
    expect(component).toContain("provider-reported balance");
    expect(component).toContain(
      "source supplied a current balance without a transaction ledger",
    );
    expect(component.indexOf("if (!metrics.hasNativeActivity)")).toBeLessThan(
      component.indexOf("Next tier:"),
    );
  });
});
