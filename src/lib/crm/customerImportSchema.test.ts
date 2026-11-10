import { describe, expect, it } from "vitest";

import {
  applyCustomImportField,
  inferCustomFieldType,
  mergeImportedCustomerWithExisting,
  normalizeCustomFieldKey,
} from "./customerImportSchema";
import { deriveCustomSegmentFields } from "@/lib/segmentFields";

describe("customer import custom fields", () => {
  it("creates stable segment-safe keys from arbitrary headers", () => {
    expect(normalizeCustomFieldKey("  IGC / Nursery Type ")).toBe(
      "igc_nursery_type",
    );
    expect(normalizeCustomFieldKey("Loyalty Points")).toBe("loyalty_points");
  });

  it("infers useful scalar types without corrupting identifier fields", () => {
    expect(inferCustomFieldType("Annual Spend", ["1200.50", "80"])).toBe(
      "number",
    );
    expect(inferCustomFieldType("Loyalty Member", ["yes", "no"])).toBe(
      "boolean",
    );
    expect(inferCustomFieldType("Renewal Date", ["2026-04-01"])).toBe("date");
    expect(inferCustomFieldType("Customer ID", ["00123", "00456"])).toBe(
      "string",
    );
  });

  it("stores typed arbitrary fields in custom_fields", () => {
    const customer: Record<string, unknown> = { custom_fields: {} };
    applyCustomImportField(customer, "annual_spend", "1,200.50", "number");
    applyCustomImportField(customer, "loyalty_member", "yes", "boolean");
    applyCustomImportField(customer, "renewal_date", "2026-04-01", "date");

    expect(customer.custom_fields).toEqual({
      annual_spend: 1200.5,
      loyalty_member: true,
      renewal_date: "2026-04-01",
    });
  });

  it("makes imported typed fields discoverable by segmentation", () => {
    const first: Record<string, unknown> = { custom_fields: {} };
    const second: Record<string, unknown> = { custom_fields: {} };
    applyCustomImportField(first, "annual_spend", "1200.50", "number");
    applyCustomImportField(second, "annual_spend", "80", "number");
    applyCustomImportField(first, "is_supplier", "yes", "boolean");
    applyCustomImportField(second, "is_supplier", "no", "boolean");

    const fields = deriveCustomSegmentFields([
      first.custom_fields as Record<string, unknown>,
      second.custom_fields as Record<string, unknown>,
    ]);

    expect(fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "custom:annual_spend",
          dataType: "number",
        }),
        expect.objectContaining({
          id: "custom:is_supplier",
          dataType: "boolean",
        }),
      ]),
    );
  });

  it("merges custom fields without re-subscribing an opted-out customer", () => {
    const merged = mergeImportedCustomerWithExisting(
      {
        email: "customer@example.com",
        email_opt_in: true,
        email_opt_in_at: "2026-09-03T00:00:00Z",
        email_consent_source: "csv_import",
        custom_fields: { client_type: "IGC" },
      },
      {
        custom_fields: { existing_note: "keep" },
        email_opt_in: false,
        email_opt_out_at: "2026-08-01T00:00:00Z",
      },
      true,
    );

    expect(merged).toMatchObject({
      email_opt_in: false,
      custom_fields: {
        existing_note: "keep",
        client_type: "IGC",
      },
    });
    expect(merged).not.toHaveProperty("email_opt_in_at");
    expect(merged).not.toHaveProperty("email_consent_source");
  });
});
