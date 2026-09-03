import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903183000_purchase_metrics_ledger_repair.sql",
  "utf8",
);

describe("purchase metrics ledger repair", () => {
  it("uses the real tenant-scoped customer link and qualifying order states", () => {
    expect(migration).toContain("pos_orders_tenant_crm_customer_date_idx");
    expect(migration).toContain("order_row.crm_customer_id = p_customer_id");
    expect(migration).toContain("order_row.tenant_id = v_tenant_id");
    expect(migration).toContain("('COMPLETED', 'REFUNDED', 'PAID')");
    expect(migration).not.toMatch(
      /FROM public\.pos_orders(?: AS \w+)?\s+WHERE customer_id/,
    );
  });

  it("uses refund-adjusted net amounts without inventing discount data", () => {
    expect(migration).toContain("coalesce(order_row.refund_amount, 0)");
    expect(migration).toContain("greatest(");
    expect(migration).toContain("pos_orders has no normalized discount amount");
    expect(migration).not.toContain("order_row.discount_amount");
  });

  it("writes complete metrics and resets zero-order customers deterministically", () => {
    expect(migration).toContain("ON CONFLICT (customer_id) DO UPDATE SET");
    expect(migration).toContain("v_total_purchases := coalesce");
    expect(migration).not.toContain("IF v_total_purchases = 0 OR");
    expect(migration).toContain("tenant_id = excluded.tenant_id");
  });

  it("repairs batch refresh and secures every mutation path", () => {
    expect(migration).toContain("order_row.crm_customer_id AS id");
    expect(migration).toContain("public.get_current_crm_access()");
    expect(migration).toContain("('owner_admin', 'marketing')");
    expect(migration).toContain("session_user <> 'postgres'");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration.match(/SET search_path = ''/g)).toHaveLength(4);
    expect(migration.match(/FROM PUBLIC, anon/g)).toHaveLength(4);
  });
});
