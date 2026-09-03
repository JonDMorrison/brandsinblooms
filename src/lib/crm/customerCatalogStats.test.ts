import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903152432_accurate_customer_catalog_stats.sql",
  "utf8",
);
const customersHook = readFileSync("src/hooks/useCustomers.ts", "utf8");
const customersPage = readFileSync(
  "src/pages/crm/CRMCustomersPage.tsx",
  "utf8",
);

describe("accurate customer catalog statistics", () => {
  it("aggregates the full active tenant catalog inside Postgres", () => {
    expect(migration).toContain("FUNCTION public.get_customer_catalog_stats()");
    expect(migration).toContain("count(*)");
    expect(migration).toContain("sum(customer.total_spent)");
    expect(migration).toContain("customer.deleted_at IS NULL");
    expect(migration).toContain("customer.merged_into_customer_id IS NULL");
  });

  it("derives tenant scope from the caller and supports selected admin context", () => {
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("admin_context.active_tenant_id");
    expect(migration).toContain("app_user.id = v_user_id");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("uses the exact server aggregate instead of browser-side page summation", () => {
    expect(customersPage).toContain('supabase.rpc("get_customer_catalog_stats")');
    expect(customersPage).not.toContain('.select("total_spent")');
    expect(customersPage).toContain("customerHeaderStats?.totalCustomers");
  });

  it("keeps merged and deleted identities out of customer list counts", () => {
    expect(customersHook).toContain('.is("deleted_at", null)');
    expect(customersHook).toContain('.is("merged_into_customer_id", null)');
    expect(customersHook).toContain("options.tenantId");
  });
});
