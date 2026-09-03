import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync(
  "supabase/functions/pos-sync-worker/index.ts",
  "utf8",
);
const config = readFileSync("supabase/config.toml", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260903153000_loyalty_provider_account_ledger.sql",
  "utf8",
);
const fullSyncCallers = [
  "shopify-full-sync",
  "clover-full-sync",
  "square-full-sync",
  "lightspeed-full-sync",
].map((name) =>
  readFileSync(`supabase/functions/${name}/index.ts`, "utf8"),
);

describe("POS loyalty sync release gate", () => {
  it("requires a verified service credential before claiming sync jobs", () => {
    expect(config).toMatch(
      /\[functions\.pos-sync-worker\]\s*verify_jwt = true/,
    );
    expect(worker).toContain("isServiceRequest(req, serviceRoleKey)");
    expect(worker).toContain(
      'req.headers.get("Authorization") === `Bearer ${serviceRoleKey}`',
    );
    expect(worker.indexOf("isServiceRequest(req, serviceRoleKey)")).toBeLessThan(
      worker.indexOf('supabase.rpc(\n      "claim_next_pos_sync_job"'),
    );
    for (const caller of fullSyncCallers) {
      expect(caller).toContain("const workerClient = createClient(");
      expect(caller).toContain(
        'Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""',
      );
      expect(caller).toContain("await workerClient.functions.invoke(");
    }
  });

  it("writes Square accounts through the normalized snapshot RPC", () => {
    expect(worker).toContain('"sync_loyalty_account_snapshot"');
    expect(worker).toContain('p_provider: "square"');
    expect(worker).toContain('p_balance_unit: "points"');
    expect(worker).toContain("Square loyalty snapshot failed");
    expect(worker).not.toMatch(/^\s*program_name: "Square Loyalty"/m);
    expect(worker).not.toMatch(/^\s*points_balance: account\.balance/m);
    expect(worker).not.toMatch(/^\s*external_loyalty_id: account\.id/m);
  });

  it("keeps provider balances and immutable source snapshots", () => {
    expect(migration).toContain(
      "CREATE TABLE public.loyalty_provider_accounts",
    );
    expect(migration).toContain(
      "CREATE TABLE public.loyalty_provider_balance_snapshots",
    );
    expect(migration).toContain(
      "balance_unit IN ('points', 'currency', 'unknown')",
    );
    expect(migration).toContain("provider, external_account_id");
    expect(migration).toContain("legacy_metrics");
    expect(migration).toContain("crm_import");
  });

  it("makes synchronization service-only and tenant-consistent", () => {
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toContain("customer.tenant_id = p_tenant_id");
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("validate_loyalty_provider_account_tenant");
    expect(migration).toContain("validate_loyalty_provider_snapshot_tenant");
  });
});
