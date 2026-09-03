import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903111500_crm_merge_provider_finalization.sql",
  "utf8",
);

describe("CRM provider merge finalization release gate", () => {
  it("releases duplicate routing keys only when creating a merged alias", () => {
    expect(migration).toContain("tombstone_merged_crm_customer_alias");
    expect(migration).toContain("OLD.merged_into_customer_id IS NULL");
    expect(migration).toContain("NEW.external_id := NULL");
    expect(migration).toContain("@invalid.bloomsuite.local");
    expect(migration).toContain("OLD.merged_into_customer_id IS NOT NULL");
  });

  it("stages provider rows, merges, and resolves in one transaction", () => {
    expect(migration).toContain("merge_external_provider_customer_suggestion");
    expect(migration).toContain("staged_provider_references");
    expect(migration).toContain("public.merge_crm_customers(");
    expect(migration).toContain(
      "public.resolve_external_provider_customer_identity(",
    );
    expect(migration).toContain(
      "provider resolver did not return the selected survivor",
    );
  });

  it("restores quarantine state and staged identity links during rollback", () => {
    expect(migration).toContain(
      "restore_staged_provider_references_after_rollback",
    );
    expect(migration).toContain("provider_previous_contact_id");
    expect(migration).toContain("created_identity_link_id");
    expect(migration).toContain("staged provider sale changed after merge");
  });

  it("keeps orchestration service-role only", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.merge_external_provider_customer_suggestion(uuid, uuid, uuid, text, uuid)",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.merge_external_provider_customer_suggestion(uuid, uuid, uuid, text, uuid)",
    );
    expect(migration).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.merge_external_provider_customer_suggestion[\s\S]*TO authenticated/,
    );
  });
});
