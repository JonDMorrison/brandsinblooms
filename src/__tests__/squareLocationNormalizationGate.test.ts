import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903172000_square_location_normalization.sql",
  "utf8",
);
const salesSync = readFileSync(
  "supabase/functions/square-sync-sales/index.ts",
  "utf8",
);
const legacySync = readFileSync(
  "supabase/functions/square-sync/index.ts",
  "utf8",
);
const webhook = readFileSync(
  "supabase/functions/square-webhook-handler/index.ts",
  "utf8",
);

describe("Square location normalization", () => {
  it("persists a durable tenant, provider, and tenant-safe location", () => {
    expect(migration).toContain("ADD COLUMN tenant_id uuid");
    expect(migration).toContain("ADD COLUMN external_location_id text");
    expect(migration).toContain("pos_orders_location_tenant_fkey");
    expect(migration).toContain(
      "REFERENCES public.tenant_locations(tenant_id, id) ON DELETE RESTRICT",
    );
    expect(migration).toContain("assign_pos_order_location_trigger");
    expect(migration).toContain("POS order tenant does not match its connection");
    expect(migration).toContain("FROM public.pos_sync_jobs AS history");
    expect(migration).toContain("count(DISTINCT history.tenant_id) = 1");
    expect(migration).toContain("pos_orders_location_select");
    expect(migration).toContain(
      "public.has_tenant_permission(tenant_id, 'customer.read', location_id)",
    );
  });

  it("retains Square's location in every active order ingestion path", () => {
    for (const source of [salesSync, legacySync, webhook]) {
      expect(source).toContain("external_location_id");
      expect(source).toContain("provider");
      expect(source).toContain("square");
    }
    expect(salesSync).toContain("payment.location_id || orderData?.location_id");
    expect(webhook).toContain("paymentData.location_id || orderData?.location_id");
  });

  it("rebuilds activity and net spend exactly from the order ledger", () => {
    expect(migration).toContain("recompute_square_customer_locations");
    expect(migration).toContain("count(*)::integer AS visit_count");
    expect(migration).toContain("coalesce(refund_amount, 0)");
    expect(migration).toContain("PARTITION BY activity.customer_id");
    expect(migration).toContain("array_agg(customer_id ORDER BY customer_id)");
    expect(migration).not.toContain("min(customer_id)");
    expect(migration).not.toContain("visit_count = activity.visit_count +");
  });

  it("fails syncs rather than reporting partial order writes as success", () => {
    expect(salesSync).toContain("Failed to persist Square payment");
    expect(legacySync).toContain("Failed to persist Square order");
    expect(webhook).toContain("Failed to persist Square payment");
    expect(webhook).toContain("Failed to persist Square invoice");
    expect(webhook).toContain("priorOrder?.raw_data?.triggers_fired");
    expect(webhook).toContain("...(priorOrder?.raw_data || {})");
  });

  it("removes the full-sync lifetime-value double count", () => {
    expect(salesSync).toContain("const exactSquareValue");
    expect(salesSync).not.toContain(
      "(customer.lifetime_value || 0) + metrics.totalSpent",
    );
    expect(webhook).toContain("calculateSquareCustomerSpend");
    expect(webhook).not.toContain("(existing.total_spent || 0) + totalAmount");
    expect(webhook).not.toContain("customer_external_id");
  });

  it("authorizes browser-triggered reconciliation inside the RPC", () => {
    expect(migration).toContain("public.get_current_crm_access()");
    expect(migration).toContain("('owner_admin', 'marketing')");
    expect(migration).toContain("session_user <> 'postgres'");
    expect(migration).toContain("TO authenticated, service_role");
    expect(migration).toContain("FROM PUBLIC, anon");
  });
});
