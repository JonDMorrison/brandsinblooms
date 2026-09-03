import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903110000_crm_customer_merge_engine.sql",
  "utf8",
);

describe("CRM customer merge release gate", () => {
  it("keeps duplicate profiles as suppressed aliases with an audit record", () => {
    expect(migration).toContain("crm_customer_merge_history");
    expect(migration).toContain("merged_into_customer_id");
    expect(migration).toContain("suppressed_reason = 'merged_duplicate'");
    expect(migration).toContain("moved_references");
    expect(migration).toContain("removed_duplicate_rows");
  });

  it("discovers enforced references and covers audited legacy references", () => {
    expect(migration).toContain(
      "con.confrelid = 'public.crm_customers'::regclass",
    );
    expect(migration).toContain("email_governance_email_events");
    expect(migration).toContain("import_job_items");
    expect(migration).toContain("cannot safely merge");
    expect(migration).toContain("consolidate before merging");
  });

  it("preserves opt-outs and fails closed on changed rollback references", () => {
    expect(migration).toContain("v_email_blocked");
    expect(migration).toContain("v_sms_blocked");
    expect(migration).toContain("rollback blocked: tracked references changed");
    expect(migration).toContain("jsonb_populate_record");
  });

  it("allows only the service role to execute merge operations", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.merge_crm_customers(uuid, uuid, uuid, text, uuid, uuid)",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.rollback_crm_customer_merge(uuid, text, uuid)",
    );
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.merge_crm_customers[\s\S]*TO authenticated/,
    );
  });
});
