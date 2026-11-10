import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const validator = readFileSync(
  "supabase/functions/validate-preference-token/index.ts",
  "utf8",
);
const page = readFileSync("src/pages/EmailPreferences.tsx", "utf8");

describe("customer loyalty portal release gate", () => {
  it("loads balances only for the token customer and tenant", () => {
    expect(validator).toContain('.from("loyalty_provider_accounts")');
    expect(validator).toContain('.eq("tenant_id", tokenData.tenant_id)');
    expect(validator).toContain('.eq("customer_id", tokenData.customer_id)');
    expect(validator).toContain('.eq("status", "active")');
    expect(validator).toContain("buildCustomerLoyaltyWallet(loyaltyAccounts)");
    expect(validator).not.toContain("external_account_id");
  });

  it("shows a current rewards balance in the existing preference center", () => {
    expect(page).toContain("Your rewards");
    expect(page).toContain("formatLoyaltyBalance(entry)");
    expect(page).toContain('entry.balanceUnit === "currency"');
    expect(page).toContain('entry.balanceUnit === "points"');
  });
});
