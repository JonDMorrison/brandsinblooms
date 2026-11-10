import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260903230000_harden_security_definer_execution.sql",
  "utf8",
);

describe("SECURITY DEFINER execution hardening", () => {
  it("removes inherited anonymous execution from every privileged public function", () => {
    expect(migration).toContain("AND procedure.prosecdef");
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon",
    );
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role",
    );
  });

  it("removes ordinary-user execution from internal worker primitives", () => {
    for (const name of [
      "claim_email_send_jobs",
      "claim_next_pos_sync_job",
      "claim_outbox_messages",
      "claim_sms_send_jobs",
      "complete_campaign_send",
      "record_email_sends",
      "record_sms_sends",
      "recover_stuck_pos_sync_jobs",
      "update_pos_sync_progress",
    ]) {
      expect(migration).toContain(`'${name}'`);
    }
    expect(migration).toContain(
      "REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated",
    );
  });

  it("covers trigger functions without maintaining a fragile name list", () => {
    expect(migration).toContain("procedure.prorettype = 'trigger'::regtype");
  });

  it("does not revoke authenticated access from tenant-checked UI RPCs", () => {
    const internalBlock = migration.slice(
      migration.indexOf("v_internal_names"),
    );
    for (const name of [
      "set_customer_marketing_consent",
      "begin_customer_csv_import",
      "import_crm_customer_batch",
      "get_current_crm_access",
      "save_tenant_location",
    ]) {
      expect(internalBlock).not.toContain(`'${name}',`);
    }
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated",
    );
  });
});
