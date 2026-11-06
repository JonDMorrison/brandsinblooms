import { describe, expect, it } from "vitest";
import {
  buildImportCustomers,
  splitFullName,
  getDefaultImportField,
  isAllowedImportField,
} from "@/lib/crm/customerImportRows";
import { getAttestationOption as getFromConsent } from "@/lib/crm/importConsent";
import { getAttestationOption } from "@/lib/crm/importAttestationOptions";
import {
  BLOOM_PHOTO_HINT,
  BLOOM_SPREADSHEET_HINT,
  getBloomAttachmentHints,
} from "@/components/bloom/bloomFileUtils";
import { resolveApproval } from "@/components/bloom/utils/resolveApprovalData";

const mappings = (fields: string[]) =>
  fields.map((databaseField, sourceIndex) => ({
    csvHeader: `col${sourceIndex}`,
    databaseField,
    sampleData: [],
    sourceIndex,
  }));

describe("shared customer import rows", () => {
  it("matches headers the same way the import dialog did", () => {
    expect(getDefaultImportField("Email Address")).toBe("email");
    expect(getDefaultImportField("First Name")).toBe("first_name");
    expect(getDefaultImportField("mobile")).toBe("phone");
    expect(getDefaultImportField("Favourite Plant")).toBe(
      "custom:favourite_plant",
    );
  });

  it("only allows fields the import knows how to write", () => {
    expect(isAllowedImportField("email")).toBe(true);
    expect(isAllowedImportField("sms_opt_in")).toBe(true);
    expect(isAllowedImportField("custom:favourite_plant")).toBe(true);
    expect(isAllowedImportField("custom:Not Normalized")).toBe(false);
    expect(isAllowedImportField("tenant_id")).toBe(false);
    expect(isAllowedImportField("email_consent_method")).toBe(false);
  });

  it("skips bad emails, merges repeated emails and keeps the first row's values", () => {
    const built = buildImportCustomers(
      [
        ["Ann@Example.com", "Ann", "555-111-2222", "vip, roses"],
        ["bad-email", "Bo", "", ""],
        ["", "Cy", "", ""],
        ["ann@example.com", "Annie", "", "spring"],
      ],
      mappings(["email", "first_name", "phone", "tags"]),
    );
    expect(built.customers).toHaveLength(1);
    expect(built.customers[0]).toMatchObject({
      email: "ann@example.com",
      first_name: "Ann",
      phone: "5551112222",
      tags: ["vip", "roses"],
    });
    expect(built.invalidEmailRows).toEqual([
      { row: 2, value: "bad-email" },
      { row: 3, value: "" },
    ]);
    expect(built.duplicatesMerged).toBe(1);
    expect(built.duplicateEmails).toEqual(["ann@example.com"]);
  });

  it("marks explicit opt-in columns so the RPC honours them", () => {
    const built = buildImportCustomers(
      [["a@b.co", "unsubscribed", "yes"]],
      mappings(["email", "email_opt_in", "sms_opt_in"]),
    );
    expect(built.customers[0]).toMatchObject({
      email_opt_in: false,
      email_opt_in_explicit: true,
      sms_opt_in: true,
      sms_opt_in_explicit: true,
    });
  });

  it("keeps the attestation wording identical through the consent module", () => {
    expect(getFromConsent("express").wording).toBe(
      getAttestationOption("express").wording,
    );
  });
});

describe("Bloom attachment hints", () => {
  it("says what Bloom can do with a spreadsheet or a photo", () => {
    expect(
      getBloomAttachmentHints([{ mimeType: "text/csv", filename: "list.csv" }]),
    ).toEqual([BLOOM_SPREADSHEET_HINT]);
    expect(
      getBloomAttachmentHints([{ mimeType: "image/jpeg", filename: "t.jpg" }]),
    ).toEqual([BLOOM_PHOTO_HINT]);
    expect(
      getBloomAttachmentHints([
        { mimeType: "application/pdf", filename: "a.pdf" },
      ]),
    ).toEqual([]);
  });
});

describe("list import approval card", () => {
  it("shows the server preview and the consent statement in full", () => {
    const resolved = resolveApproval(
      {
        toolName: "import_customer_list",
        params: { upload_id: "t/c/f.csv" },
        description: 'Import 4 contacts from "list.csv"',
        fieldChanges: [
          { field: "New customers", currentValue: null, newValue: 2 },
          { field: "Rows skipped", currentValue: null, newValue: 3 },
        ],
        notice: {
          title: "By approving, you confirm:",
          body: getAttestationOption("express").wording,
          detail: null,
        },
      },
      [],
    );
    expect(resolved.title).toBe('Import 4 contacts from "list.csv"');
    expect(resolved.details).toEqual([
      { label: "New customers", value: "2" },
      { label: "Rows skipped", value: "3" },
    ]);
    expect(resolved.notice?.body).toBe(getAttestationOption("express").wording);
    expect(resolved.isReversible).toBe(false);
  });
});

describe("duplicate rows keep the first row's values", () => {
  it("does not let a later copy overwrite the first row's custom fields", () => {
    const mappings = [
      { csvHeader: "Email", databaseField: "email", sampleData: [], sourceIndex: 0 },
      { csvHeader: "First", databaseField: "first_name", sampleData: [], sourceIndex: 1 },
      { csvHeader: "Notes", databaseField: "custom:notes", sampleData: [], sourceIndex: 2 },
      { csvHeader: "Store", databaseField: "custom:store", sampleData: [], sourceIndex: 3 },
    ];
    const built = buildImportCustomers(
      [
        ["a@example.com", "Alice", "Loves tulips", ""],
        ["a@example.com", "Alicia", "duplicate row", "Main St"],
      ],
      mappings,
    );
    expect(built.customers).toHaveLength(1);
    expect(built.customers[0].first_name).toBe("Alice");
    expect(built.customers[0].custom_fields).toEqual({ notes: "Loves tulips", store: "Main St" });
  });
});

describe("full name column", () => {
  it("splits common name shapes", () => {
    expect(splitFullName("Ann Lee")).toEqual({ first: "Ann", last: "Lee" });
    expect(splitFullName("Ann Marie van der Berg")).toEqual({ first: "Ann", last: "Marie van der Berg" });
    expect(splitFullName("Lee, Ann")).toEqual({ first: "Ann", last: "Lee" });
    expect(splitFullName("Cher")).toEqual({ first: "Cher", last: null });
    expect(splitFullName("  Bob   Singh (Main St) ")).toEqual({ first: "Bob", last: "Singh" });
    expect(splitFullName("Dee Park <dee@example.com>")).toEqual({ first: "Dee", last: "Park" });
    expect(splitFullName("   ")).toEqual({ first: null, last: null });
  });

  it("maps Name / Full Name / Customer Name headers, but not a bare Customer column", () => {
    expect(getDefaultImportField("Name")).toBe("full_name");
    expect(getDefaultImportField("Full Name")).toBe("full_name");
    expect(getDefaultImportField("Customer Name")).toBe("full_name");
    expect(getDefaultImportField("Customer")).toBe("custom:customer");
    expect(isAllowedImportField("full_name")).toBe(true);
  });

  it("fills first and last name, and separate first/last columns win", () => {
    const m = (h: string, f: string, i: number) => ({ csvHeader: h, databaseField: f, sampleData: [], sourceIndex: i });
    const built = buildImportCustomers(
      [
        ["Ann Lee", "a@example.com", ""],
        ["Bob Singh", "b@example.com", "Robert"],
      ],
      [m("Name", "full_name", 0), m("Email", "email", 1), m("First", "first_name", 2)],
    );
    expect(built.customers[0]).toMatchObject({ first_name: "Ann", last_name: "Lee" });
    expect(built.customers[1]).toMatchObject({ first_name: "Robert", last_name: "Singh" });
    expect(built.customers[0]).not.toHaveProperty("full_name");
  });
});
