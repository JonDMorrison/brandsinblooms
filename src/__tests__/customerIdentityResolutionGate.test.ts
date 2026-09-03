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
const orderMigration = readSource(
  "supabase/migrations/20260903090000_pos_order_customer_resolution.sql",
);
const legacyOrderMigration = readSource(
  "supabase/migrations/20260903093000_legacy_pos_order_identity_resolution.sql",
);
const providerBatchMigration = readSource(
  "supabase/migrations/20260903100000_provider_customer_identity_batch.sql",
);
const linker = readSource("supabase/functions/pos-link-customers/index.ts");
const squareCustomerSync = readSource(
  "supabase/functions/square-sync-customers/index.ts",
);
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

  it("attaches POS orders only when canonical identity is deterministic", () => {
    expect(orderMigration).toContain("crm_customer_id uuid");
    expect(orderMigration).toContain("HAVING count(*) = 1");
    expect(orderMigration).not.toContain("min(pc.id)");
    expect(orderMigration).toContain("crm_customer_identity_links");
    expect(orderMigration).toContain("customer_resolution_status");
    expect(orderMigration).toContain("'ambiguous'");
    expect(orderMigration).toContain("'unmatched'");
  });

  it("resolves legacy provider orders through tenant-scoped external IDs", () => {
    expect(legacyOrderMigration).toContain("square_connections");
    expect(legacyOrderMigration).toContain("clover_connections");
    expect(legacyOrderMigration).toContain("pos_sync_jobs");
    expect(legacyOrderMigration).toContain("c.square_customer_id");
    expect(legacyOrderMigration).toContain("c.clover_customer_id");
    expect(legacyOrderMigration).toContain("cardinality(v_tenant_ids) = 1");
    expect(legacyOrderMigration).toContain("ambiguous_external_id");
  });

  it("re-evaluates orders when provider identities change", () => {
    expect(legacyOrderMigration).toContain(
      "CREATE TRIGGER trg_reconcile_provider_orders_from_crm_customer",
    );
    expect(legacyOrderMigration).toContain(
      "UPDATE OF square_customer_id, clover_customer_id, deleted_at",
    );
    expect(legacyOrderMigration).toContain(
      "SET external_customer_id = o.external_customer_id",
    );
    expect(legacyOrderMigration).not.toMatch(/email_opt_in\s*=/i);
    expect(legacyOrderMigration).not.toMatch(/sms_opt_in\s*=/i);
  });

  it("routes provider-native customer batches through canonical identity", () => {
    expect(providerBatchMigration).toContain(
      "CREATE OR REPLACE FUNCTION public.resolve_provider_customer_identity",
    );
    expect(providerBatchMigration).toContain("provider_external_id");
    expect(providerBatchMigration).toContain("ambiguous_external_id");
    expect(providerBatchMigration).toContain("pg_advisory_xact_lock");
    expect(providerBatchMigration).not.toMatch(/email_opt_in\s*=/i);
    expect(providerBatchMigration).not.toMatch(/sms_opt_in\s*=/i);
  });

  it("never deduplicates or upserts Square customers by email", () => {
    expect(squareCustomerSync).toContain("deduplicatedMap.set(customer.id");
    expect(squareCustomerSync).toContain(
      "resolve_provider_customer_identity_batch",
    );
    expect(squareCustomerSync).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(squareCustomerSync).not.toContain(".upsert(customerRecords");
    expect(squareCustomerSync).not.toContain("email_opt_in:");
    expect(squareCustomerSync).not.toContain("email_consent_source:");
  });
});
