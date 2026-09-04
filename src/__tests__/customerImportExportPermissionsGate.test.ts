import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const customerPage = readFileSync(
  "src/pages/crm/CRMCustomersPage.tsx",
  "utf8",
);
const exportMigration = readFileSync(
  "supabase/migrations/20260903234000_owner_authorized_customer_export.sql",
  "utf8",
);

describe("customer import and export permissions", () => {
  it("shows full-database export and merge review only to owner/admin", () => {
    expect(customerPage).toContain(
      'const canExportCustomers = crmRole === "owner_admin"',
    );
    expect(customerPage).toContain(
      'const canDeleteCustomers = crmRole === "owner_admin"',
    );
    expect(customerPage).toContain("{canExportCustomers ? (");
    expect(customerPage).toContain("{canDeleteCustomers ? (");
  });

  it("allows list imports only for owner/admin and marketing roles", () => {
    expect(customerPage).toContain('crmRole === "owner_admin"');
    expect(customerPage).toContain('crmRole === "marketing"');
    expect(customerPage).toContain("{canImportCustomers ? (");
    expect(customerPage).toContain(
      'searchParams.get("import") === "1" && canImportCustomers',
    );
  });

  it("authorizes exports with the canonical tenant access resolver", () => {
    expect(exportMigration).toContain("public.get_current_crm_access()");
    expect(exportMigration).toContain(
      "v_access->>'role' IS DISTINCT FROM 'owner_admin'",
    );
    expect(exportMigration).toContain(
      "customer.tenant_id = v_tenant_id",
    );
    expect(exportMigration).toContain("FROM PUBLIC, anon");
  });
});
