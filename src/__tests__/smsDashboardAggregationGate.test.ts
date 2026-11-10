import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(process.cwd());
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260903132358_accurate_sms_dashboard_stats.sql",
  ),
  "utf8",
);
const hook = readFileSync(resolve(root, "src/hooks/useSMSStats.ts"), "utf8");

describe("SMS dashboard aggregation release gate", () => {
  it("uses an authenticated tenant-scoped server aggregate", () => {
    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION public.get_sms_dashboard_stats()",
    );
    expect(migration).toContain("v_user_id uuid := auth.uid();");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.get_sms_dashboard_stats()\nTO authenticated, service_role;",
    );
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.get_sms_dashboard_stats()\nFROM PUBLIC, anon;",
    );
  });

  it("counts only customers who remain eligible to receive SMS", () => {
    expect(migration).toContain("customer.sms_opt_in = true");
    expect(migration).toContain("customer.sms_consent IS DISTINCT FROM false");
    expect(migration).toContain("customer.sms_opt_in_at IS NOT NULL");
    expect(migration).toContain(
      "nullif(trim(customer.sms_consent_source), '') IS NOT NULL",
    );
    expect(migration).toContain("customer.deleted_at IS NULL");
    expect(migration).toContain("customer.merged_into_customer_id IS NULL");
    expect(migration).toContain("consent.status <> 'opted_in'");
  });

  it("derives delivery, click, and queue totals from message records", () => {
    expect(migration).toContain("FROM public.sms_messages AS message");
    expect(migration).toContain(
      "status IN ('sent', 'delivered', 'failed')",
    );
    expect(migration).toContain("coalesce(sum(links_clicked), 0)");
    expect(migration).toContain("status = 'queued'");
    expect(migration).toContain("v_now - interval '30 days'");
    expect(migration).toContain("v_now - interval '60 days'");
  });

  it("does not infer all-time totals from capped browser queries", () => {
    expect(hook).toContain('supabase.rpc("get_sms_dashboard_stats")');
    expect(hook).not.toContain('.from("crm_customers")\n        .select("id")');
    expect(hook).not.toContain("const totalSent = campaigns.reduce");
    expect(hook).not.toContain("const campaignIds = campaigns.map");
    expect(hook).toContain("clicked: metrics.totalClicks");
  });
});
