import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903131712_pos_campaign_revenue_attribution.sql",
  "utf8",
);
const emailReport = readFileSync("src/pages/crm/CRMCampaignReport.tsx", "utf8");
const smsReport = readFileSync("src/pages/sms/SMSCampaignDetail.tsx", "utf8");

describe("campaign revenue attribution release gate", () => {
  it("uses a tenant-safe, order-level, refund-aware last-click ledger", () => {
    expect(migration).toContain("UNIQUE (order_id)");
    expect(migration).toContain(
      "v_order.customer_tenant_id IS DISTINCT FROM v_order.resolved_tenant_id",
    );
    expect(migration).toContain("v_net := greatest(v_gross - v_refund, 0)");
    expect(migration).toContain("attribution_model = 'last_click'");
    expect(migration).toContain("event.is_mpp_guess");
    expect(migration).toContain("event.is_spam_trap");
  });

  it("reconciles order, refund, late-click, update, and deletion paths", () => {
    expect(migration).toContain("attribute_pos_order_after_change");
    expect(migration).toContain("attribute_orders_after_email_click_change");
    expect(migration).toContain("attribute_orders_after_sms_click_change");
    expect(migration).toContain("preserve_campaign_revenue_metrics");
    expect(migration).toContain("rebuild_campaign_revenue_attribution");
  });

  it("uses individual SMS click events instead of aggregate first/last timestamps", () => {
    const exactSmsMigration = readFileSync(
      "supabase/migrations/20260903141000_exact_sms_click_event_attribution.sql",
      "utf8",
    );

    expect(exactSmsMigration).toContain("CREATE TABLE public.sms_link_click_events");
    expect(exactSmsMigration).toContain("INSERT INTO public.sms_link_click_events");
    expect(exactSmsMigration).toContain("click_event.clicked_at AS touch_at");
    expect(exactSmsMigration).toContain("attribute_orders_after_sms_click_event_change");
    expect(exactSmsMigration).not.toContain(
      "WHEN link.last_clicked_at <= v_order.order_date",
    );
  });

  it("keeps privileged writes internal while allowing tenant-scoped audit reads", () => {
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("TO authenticated\nUSING");
    expect(migration).toContain(
      "app_user.tenant_id = campaign_revenue_attributions.tenant_id",
    );
    expect(migration).toContain("TO service_role");
    expect(migration).toContain("SET search_path = ''");
  });

  it("shows traceable revenue in both email and SMS campaign reports", () => {
    expect(emailReport).toContain("CampaignRevenueAttribution");
    expect(emailReport).toContain("Attributed Revenue");
    expect(smsReport).toContain('label="Attributed revenue"');
    expect(smsReport).toContain('label="Customers purchased"');
    expect(smsReport).toContain('label="Attributed orders"');
  });
});
