import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { syncProviderLoyaltyBalances } from "../../supabase/functions/_shared/loyalty/syncProviderBalances";

const helper = readFileSync(
  "supabase/functions/_shared/loyalty/syncProviderBalances.ts",
  "utf8",
);
const vmx = readFileSync(
  "supabase/functions/vmx-sync-customers/index.ts",
  "utf8",
);
const lightspeed = readFileSync(
  "supabase/functions/lightspeed-sync-customers/index.ts",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260903222317_prevent_stale_loyalty_snapshots.sql",
  "utf8",
);

describe("provider loyalty reconciliation release gate", () => {
  it("links balances only through canonical identity results", () => {
    expect(helper).toContain("buildIdentityMap(identityResult)");
    expect(helper).toContain("resolvedCustomers.get(candidate.externalId)");
    expect(helper).toContain('"sync_loyalty_account_snapshot"');
    expect(helper).toContain('p_balance_unit: "unknown"');
  });

  it("writes VMX and Lightspeed balances to the provider ledger", () => {
    expect(vmx).toContain("syncProviderLoyaltyBalances");
    expect(vmx).toContain('provider: "vmx"');
    expect(vmx).toContain('programName: "VMX Rewards"');
    expect(lightspeed).toContain("syncProviderLoyaltyBalances");
    expect(lightspeed).toContain('provider: "lightspeed"');
    expect(lightspeed).toContain('programName: "Lightspeed Loyalty"');
  });

  it("rejects stale and conflicting snapshots in the database", () => {
    expect(migration).toContain("NEW.last_synced_at < OLD.last_synced_at");
    expect(migration).toContain("NEW.last_synced_at = OLD.last_synced_at");
    expect(migration).toContain("loyalty_provider_snapshot_observation_unique");
    expect(migration).toContain("Stale loyalty snapshot cannot replace");
    expect(migration).toContain("Conflicting loyalty snapshots");
  });

  it("supports both provider identity result shapes without guessing", async () => {
    const calls: Array<Record<string, unknown>> = [];
    const supabase = {
      rpc: async (_name: string, args: Record<string, unknown>) => {
        calls.push(args);
        return { error: null };
      },
    };

    const result = await syncProviderLoyaltyBalances({
      supabase,
      tenantId: "tenant-1",
      provider: "test-pos",
      programName: "Test Rewards",
      identityResult: {
        results: [
          { external_id: "flat", customer_id: "customer-1" },
          {
            external_id: "nested",
            result: { customer_id: "customer-2" },
          },
        ],
      },
      candidates: [
        {
          externalId: "flat",
          balance: 12,
          hasAccount: true,
          observedAt: "2026-09-03T12:00:00.000Z",
        },
        {
          externalId: "nested",
          balance: 25,
          hasAccount: true,
          observedAt: "2026-09-03T12:00:00.000Z",
        },
        {
          externalId: "unresolved",
          balance: 30,
          hasAccount: true,
          observedAt: "2026-09-03T12:00:00.000Z",
        },
      ],
    });

    expect(result).toEqual({ synced: 2, unresolved: 1 });
    expect(calls.map((call) => call.p_customer_id)).toEqual([
      "customer-1",
      "customer-2",
    ]);
  });
});
