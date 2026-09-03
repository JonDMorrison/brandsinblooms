import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903150000_loyalty_consent_security.sql",
  "utf8",
);

describe("loyalty and consent security gate", () => {
  it("removes the legacy bulk resubscription function", () => {
    expect(migration).toContain(
      "DROP FUNCTION IF EXISTS public.optin_perks_members()",
    );
    expect(migration).not.toContain("SET email_opt_in = true");
  });

  it("makes loyalty ledgers read-only for tenant browser users", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.loyalty_points_transactions",
    );
    expect(migration).toContain(
      "GRANT SELECT ON TABLE public.loyalty_points_transactions TO authenticated",
    );
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can insert points transactions for their tenant"',
    );
  });

  it("keeps all loyalty mutation functions service-only", () => {
    for (const functionName of [
      "track_loyalty_enrollment",
      "track_points_earned",
      "track_points_redeemed",
      "update_loyalty_tier",
      "recalculate_loyalty_metrics",
      "refresh_all_loyalty_metrics",
    ]) {
      expect(migration).toContain(`public.${functionName}`);
    }
    expect(migration).toContain("FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("TO service_role");
  });

  it("authorizes the browser enrollment-rate RPC inside the database", () => {
    expect(migration).toContain("auth.role() IS DISTINCT FROM 'service_role'");
    expect(migration).toContain("public.is_master_admin(auth.uid())");
    expect(migration).toContain("app_user.tenant_id = p_tenant_id");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("FROM PUBLIC, anon");
  });

  it("keeps the exact SMS click ledger append-only for workers", () => {
    expect(migration).toContain(
      "REVOKE ALL ON TABLE public.sms_link_click_events FROM service_role",
    );
    expect(migration).toContain(
      "GRANT SELECT, INSERT ON TABLE public.sms_link_click_events TO service_role",
    );
  });
});
