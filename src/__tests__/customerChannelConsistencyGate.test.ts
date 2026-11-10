import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903224500_sync_customer_contactable_channels.sql",
  "utf8",
);

describe("customer channel consistency", () => {
  it("derives the channel from both consent flags for every write path", () => {
    expect(migration).toContain(
      "BEFORE INSERT OR UPDATE OF email_opt_in, sms_opt_in",
    );
    expect(migration).toContain(
      "NEW.email_opt_in IS TRUE AND NEW.sms_opt_in IS TRUE",
    );
    expect(migration).toContain("THEN 'both'");
    expect(migration).toContain("THEN 'email'");
    expect(migration).toContain("THEN 'sms'");
    expect(migration).toContain("ELSE 'none'");
  });

  it("repairs historical mismatches without changing their business timestamp", () => {
    expect(migration).toContain("UPDATE public.crm_customers AS customer");
    expect(migration).toContain(
      "customer.preferred_channel IS DISTINCT FROM CASE",
    );
    expect(migration).toContain("updated_at = customer.updated_at");
    expect(migration).toContain(
      "DISABLE TRIGGER update_crm_customers_updated_at",
    );
    expect(migration).toContain(
      "ENABLE TRIGGER update_crm_customers_updated_at",
    );
  });

  it("does not expose the trigger helper as a browser RPC", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.sync_customer_preferred_channel() FROM PUBLIC",
    );
    expect(migration).not.toContain("GRANT EXECUTE");
  });
});
