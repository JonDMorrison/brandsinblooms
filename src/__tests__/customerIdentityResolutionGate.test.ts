import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

const migration = readSource(
  "supabase/migrations/20260903080000_customer_identity_resolution.sql",
);
const ingestionMigration = readSource(
  "supabase/migrations/20260903083000_auto_resolve_pos_customer_identity.sql",
);
const linker = readSource("supabase/functions/pos-link-customers/index.ts");
const config = readSource("supabase/config.toml");

describe("customer identity resolution release gate", () => {
  it("uses an external-id-first identity ledger and records ambiguity", () => {
    expect(migration).toContain("crm_customer_identity_links");
    expect(migration).toContain("crm_customer_merge_suggestions");
    expect(migration).toContain("external_identity_signal_conflict");
    expect(migration).toContain("email_phone_disagree");
    expect(migration).toContain("pg_advisory_xact_lock");
  });

  it("never changes marketing consent while resolving POS identity", () => {
    const resolver = migration.slice(
      migration.indexOf(
        "CREATE OR REPLACE FUNCTION public.resolve_crm_customer_identity",
      ),
    );

    expect(resolver).toContain("email_opt_in, sms_opt_in");
    expect(resolver).toMatch(/false,\s*false,\s*v_provider/);
    expect(resolver).not.toMatch(/SET[\s\S]*email_opt_in\s*=/i);
    expect(resolver).not.toMatch(/SET[\s\S]*sms_opt_in\s*=/i);
  });

  it("links the deployed POS schema through the resolver", () => {
    expect(linker).toContain('.eq("pos_connection_id", connection.id)');
    expect(linker).toContain('"resolve_crm_customer_identity"');
    expect(linker).not.toContain("crm_customer_links");
    expect(linker).not.toContain("connection_id\n");
  });

  it("requires a user JWT at the edge", () => {
    expect(config).toMatch(
      /\[functions\.pos-link-customers\]\s*verify_jwt = true/,
    );
    expect(linker).toContain("supabase.auth.getUser(token)");
    expect(linker).toContain('.eq("tenant_id", userData.tenant_id)');
  });

  it("routes every pos_customers ingestion through the canonical resolver", () => {
    expect(ingestionMigration).toContain(
      "CREATE TRIGGER trg_auto_resolve_pos_customer_identity",
    );
    expect(ingestionMigration).toContain(
      "PERFORM public.resolve_crm_customer_identity",
    );
    expect(ingestionMigration).toContain("crm_customer_identity_failures");
    expect(ingestionMigration).toContain("EXCEPTION WHEN OTHERS");
  });
});
