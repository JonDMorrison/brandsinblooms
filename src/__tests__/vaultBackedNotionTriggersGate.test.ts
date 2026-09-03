import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260903155000_vault_backed_internal_notion_triggers.sql",
  ),
  "utf8",
);

describe("Vault-backed internal Notion triggers", () => {
  it("removes every legacy trigger before recreating it", () => {
    for (const trigger of [
      "notion-clients-imported",
      "notion-profile-update",
      "notion-email-domain",
      "notion-pos-clover",
      "notion-pos-square",
      "notion-pos-lightspeed",
      "notify-notion-trial",
    ]) {
      expect(migration).toContain(`DROP TRIGGER IF EXISTS "${trigger}"`);
      expect(migration).toContain(`CREATE TRIGGER "${trigger}"`);
    }
  });

  it("resolves the service key at execution time instead of storing a JWT", () => {
    expect(migration).toContain("public.get_service_role_key()");
    expect(migration).toContain("'Authorization', 'Bearer ' || v_service_key");
    expect(migration).toContain("'apikey', v_service_key");
    expect(migration).not.toMatch(/eyJ[A-Za-z0-9_-]+[.]eyJ/);
    expect(migration).not.toContain("supabase_functions.http_request");
  });

  it("allowlists destinations and preserves webhook payload shape", () => {
    expect(migration).toContain(
      "v_function_slug NOT IN ('update-notion-profile', 'notify-notion-trial')",
    );
    for (const field of ["'type'", "'table'", "'schema'", "'record'", "'old_record'"]) {
      expect(migration).toContain(field);
    }
  });

  it("does not expose the trigger function through the API", () => {
    expect(migration).toContain("SECURITY DEFINER");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.invoke_internal_notion_sync\(\)[\s\S]*FROM PUBLIC, anon, authenticated/,
    );
    expect(migration).toContain("TO service_role");
  });
});
