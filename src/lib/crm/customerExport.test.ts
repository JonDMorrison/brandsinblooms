import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildCustomerExportCsv,
  normalizeCustomerExportPage,
  toSafeCsvValue,
} from "./customerExport";

const migration = readFileSync(
  "supabase/migrations/20260903234000_owner_authorized_customer_export.sql",
  "utf8",
);
const customersPage = readFileSync(
  "src/pages/crm/CRMCustomersPage.tsx",
  "utf8",
);
const exportHook = readFileSync("src/hooks/useCustomerExport.ts", "utf8");

describe("complete customer data export", () => {
  it("exports every discovered custom field in a stable column", () => {
    const csv = buildCustomerExportCsv([
      {
        id: "customer-1",
        email: "jane@example.com",
        custom_fields: { plant_interest: "Tomatoes", experience: "Beginner" },
      },
      {
        id: "customer-2",
        email: "lee@example.com",
        custom_fields: { client_type: "IGC", plant_interest: "Native plants" },
      },
    ]);

    const [header, firstRow, secondRow] = csv.split("\r\n");
    expect(header).toContain("Custom: client_type");
    expect(header).toContain("Custom: experience");
    expect(header).toContain("Custom: plant_interest");
    expect(header.indexOf("Custom: client_type")).toBeLessThan(
      header.indexOf("Custom: experience"),
    );
    expect(firstRow).toContain("jane@example.com");
    expect(firstRow).toContain("Tomatoes");
    expect(secondRow).toContain("IGC");
  });

  it("quotes CSV delimiters and neutralizes spreadsheet formulas", () => {
    expect(toSafeCsvValue('A "quoted", value')).toBe('"A ""quoted"", value"');
    expect(toSafeCsvValue('=HYPERLINK("https://bad.example")')).toBe(
      '"\'=HYPERLINK(""https://bad.example"")"',
    );
    expect(toSafeCsvValue(-42)).toBe("-42");
  });

  it("normalizes an untrusted export page and rejects non-objects", () => {
    expect(
      normalizeCustomerExportPage({
        items: [{ id: "one" }, null, "bad"],
        nextCursor: "one",
        hasMore: true,
        pageSize: 3,
      }),
    ).toEqual({
      items: [{ id: "one" }],
      nextCursor: "one",
      hasMore: true,
      pageSize: 3,
    });
    expect(() => normalizeCustomerExportPage(null)).toThrow("invalid page");
  });

  it("paginates at the database boundary without the browser row cap", () => {
    expect(migration).toContain("FUNCTION public.get_customer_export_page");
    expect(migration).toContain("LIMIT p_limit + 1");
    expect(migration).toContain("customer.id > p_after_id");
    expect(migration).toContain("SET search_path = ''");
    expect(migration).toContain("public.get_current_crm_access()");
    expect(migration).toContain(
      "v_access->>'role' IS DISTINCT FROM 'owner_admin'",
    );
    expect(migration).toContain("FROM PUBLIC, anon");
    expect(exportHook).toContain("supabase.rpc");
    expect(exportHook).toContain('"get_customer_export_page"');
    expect(exportHook).toContain("pagination did not advance safely");
  });

  it("includes customer-owned data and exposes the export from the customer list", () => {
    for (const field of [
      "custom_fields",
      "segments",
      "email_consent_source",
      "sms_consent_source",
      "pos_order_count",
      "linked_pos_identities",
      "loyalty_points_balance",
    ]) {
      expect(migration).toContain(`'${field}'`);
    }
    expect(customersPage).toContain("Export All Customers");
    expect(customersPage).toContain("exportAllCustomers");
  });
});
