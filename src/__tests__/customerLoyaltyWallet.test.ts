import { describe, expect, it } from "vitest";
import { buildCustomerLoyaltyWallet } from "../../supabase/functions/validate-preference-token/customerLoyaltyWallet";

const base = {
  status: "active",
  balance: 125,
  balance_unit: "points",
  currency: null,
  last_synced_at: "2026-09-03T12:00:00Z",
};

describe("customer loyalty wallet", () => {
  it("prefers live provider accounts over imported baselines", () => {
    const wallet = buildCustomerLoyaltyWallet([
      {
        ...base,
        provider: "legacy_metrics",
        program_name: "Imported loyalty metrics",
        balance: 90,
      },
      {
        ...base,
        provider: "crm_import",
        program_name: "Imported POS loyalty balance",
        balance_unit: "unknown",
        balance: 25,
      },
      {
        ...base,
        provider: "square",
        program_name: "Square Loyalty",
      },
    ]);

    expect(wallet).toEqual([
      {
        provider: "square",
        programName: "Square Loyalty",
        balance: 125,
        balanceUnit: "points",
        currency: null,
        lastSyncedAt: "2026-09-03T12:00:00Z",
      },
    ]);
  });

  it("uses the typed legacy balance before an unknown imported balance", () => {
    const wallet = buildCustomerLoyaltyWallet([
      { ...base, provider: "crm_import", balance_unit: "unknown" },
      { ...base, provider: "legacy_metrics", balance: "75" },
    ]);

    expect(wallet).toHaveLength(1);
    expect(wallet[0]).toMatchObject({
      provider: "legacy_metrics",
      balance: 75,
      balanceUnit: "points",
    });
  });

  it("rejects inactive, negative, or malformed balances", () => {
    expect(
      buildCustomerLoyaltyWallet([
        { ...base, provider: "square", status: "archived" },
        { ...base, provider: "square", balance: -1 },
        { ...base, provider: "square", balance_unit: "currency" },
      ]),
    ).toEqual([]);
  });

  it("returns sanitized fields without provider identifiers", () => {
    const [entry] = buildCustomerLoyaltyWallet([
      {
        ...base,
        provider: "square",
        external_account_id: "secret-provider-id",
      },
    ]);

    expect(entry).not.toHaveProperty("external_account_id");
    expect(Object.keys(entry).sort()).toEqual(
      [
        "balance",
        "balanceUnit",
        "currency",
        "lastSyncedAt",
        "programName",
        "provider",
      ].sort(),
    );
  });
});
