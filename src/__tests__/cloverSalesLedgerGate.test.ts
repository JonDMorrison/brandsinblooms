import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const worker = readFileSync(
  "supabase/functions/clover-sync-sales/index.ts",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260903193000_clover_order_location_and_sync_lock.sql",
  "utf8",
);

describe("Clover sales ledger", () => {
  it("writes the normalized order schema and fails partial persistence", () => {
    expect(worker).toContain("external_id: order.id");
    expect(worker).toContain("external_customer_id: cloverCustomerId");
    expect(worker).toContain("crm_customer_id: customer?.id");
    expect(worker).toContain("external_location_id: connection.merchant_id");
    expect(worker).toContain("provider: 'clover'");
    expect(worker).toContain("items: order.lineItems?.elements");
    expect(worker).toContain(".select('crm_customer_id')");
    expect(worker).toContain("storedOrder?.crm_customer_id");
    expect(worker).toContain("Failed to persist Clover order");
    expect(worker).not.toContain("external_order_id:");
    expect(worker).not.toContain("line_items:");
  });

  it("derives exact refund-adjusted Clover totals through crm_customer_id", () => {
    expect(worker).toContain(".eq('crm_customer_id', customer.id)");
    expect(worker).toContain("Number(stored.refund_amount || 0)");
    expect(worker).toContain("customerUpdate.pos_order_count");
    expect(worker).not.toContain(".eq('customer_id', customer.id)");
  });

  it("supports multiple merchant connections and durable sync status", () => {
    expect(worker).toContain("Multiple Clover connections found; connectionId is required");
    expect(worker).toContain("connection_type: 'clover'");
    expect(worker).toContain("status: 'completed'");
    expect(worker).toContain("status: 'failed'");
    expect(migration).toContain("pos_sync_jobs_one_active_sales_sync_idx");
  });

  it("normalizes the Clover merchant through the tenant-safe trigger", () => {
    expect(migration).toContain("'clover', connection.merchant_id");
    expect(migration).toContain("v_provider NOT IN ('square', 'clover')");
    expect(migration).toContain("public.resolve_pos_location(");
    expect(migration).toContain("NEW.provider IS DISTINCT FROM v_provider");
    expect(migration).toContain("SET search_path = ''");
  });
});
