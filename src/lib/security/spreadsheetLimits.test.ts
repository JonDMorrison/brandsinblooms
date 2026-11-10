import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  ADMIN_RESOURCE_SPREADSHEET_LIMITS,
  CUSTOMER_IMPORT_SPREADSHEET_LIMITS,
  LOYALTY_CALENDAR_SPREADSHEET_LIMITS,
  MASTER_TEMPLATE_SPREADSHEET_LIMITS,
  assertNoWorksheetFormulas,
  assertSpreadsheetFileSize,
  firstWorksheetWithinLimits,
} from "./spreadsheetLimits";

function workbook(ref: string, sheetCount = 1, fullRef?: string) {
  const SheetNames = Array.from({ length: sheetCount }, (_, index) =>
    index === 0 ? "Data" : `Sheet ${index + 1}`,
  );
  return {
    SheetNames,
    Sheets: Object.fromEntries(
      SheetNames.map((name, index) => [
        name,
        index === 0
          ? { "!ref": ref, ...(fullRef ? { "!fullref": fullRef } : {}) }
          : { "!ref": "A1" },
      ]),
    ),
  };
}

function serializedWorkbook(sheets: Record<string, XLSX.WorkSheet>) {
  return XLSX.write(
    { SheetNames: Object.keys(sheets), Sheets: sheets },
    { type: "array", bookType: "xlsx" },
  );
}

describe("spreadsheet import limits", () => {
  it.each([
    ["template", MASTER_TEMPLATE_SPREADSHEET_LIMITS],
    ["admin resource", ADMIN_RESOURCE_SPREADSHEET_LIMITS],
    ["customer import", CUSTOMER_IMPORT_SPREADSHEET_LIMITS],
    ["loyalty calendar", LOYALTY_CALENDAR_SPREADSHEET_LIMITS],
  ])("rejects an oversized %s workbook before parsing", (_name, limits) => {
    expect(() =>
      assertSpreadsheetFileSize({ size: limits.maxBytes + 1 }, limits),
    ).toThrow(/MB or smaller/);
  });

  it("rejects a template workbook with an adversarial row range", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook(`A1:A${MASTER_TEMPLATE_SPREADSHEET_LIMITS.maxRows + 1}`),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/at most 500 rows and 50 columns/);
  });

  it("validates the original range when the parser truncates excess rows", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("A1:A500", 1, "A1:A501"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/at most 500 rows and 50 columns/);
  });

  it("rejects an offset range whenever SheetJS reports truncation", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("A3:A501", 1, "A3:A502"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/Nothing was imported or truncated/);
  });

  it("rejects a real offset workbook when SheetJS truncates at an absolute row ceiling", () => {
    const data = serializedWorkbook({
      Data: {
        "!ref": "A3:A502",
        A3: { v: "heading" },
        A502: { v: "last source row" },
      },
    });
    const parsed = XLSX.read(data, {
      type: "array",
      sheets: 0,
      sheetRows: MASTER_TEMPLATE_SPREADSHEET_LIMITS.maxRows + 1,
    });
    expect(parsed.Sheets.Data["!fullref"]).toBe("A3:A502");
    expect(() =>
      firstWorksheetWithinLimits(
        parsed,
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/Nothing was imported or truncated/);
  });

  it("rejects a real multi-sheet customer import instead of silently ignoring data", () => {
    const data = serializedWorkbook({
      Customers: { "!ref": "A1", A1: { v: "email" } },
      MoreCustomers: { "!ref": "A1", A1: { v: "email" } },
    });
    const parsed = XLSX.read(data, {
      type: "array",
      sheets: 0,
      sheetRows: CUSTOMER_IMPORT_SPREADSHEET_LIMITS.maxRows + 1,
    });
    expect(() =>
      firstWorksheetWithinLimits(parsed, CUSTOMER_IMPORT_SPREADSHEET_LIMITS),
    ).toThrow(/exactly one worksheet/);
  });

  it("rejects a malformed worksheet range", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("not-a-range"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/invalid worksheet range/);
  });

  it("rejects malformed and reversed original ranges reported after truncation", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("A1:A2", 1, "not-a-range"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/invalid worksheet range/);
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("A1:A2", 1, "A5000000:A1"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/invalid worksheet range/);
  });

  it("rejects a reversed worksheet range", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("A5000000:A1"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/invalid worksheet range/);
  });

  it("rejects an admin workbook with an adversarial column range", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook("A1:DW2"),
        ADMIN_RESOURCE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/at most 5,000 rows and 100 columns/);
  });

  it("rejects excessive worksheet counts", () => {
    expect(() =>
      firstWorksheetWithinLimits(
        workbook(
          "A1:B2",
          MASTER_TEMPLATE_SPREADSHEET_LIMITS.maxSheets + 1,
        ),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/exactly one worksheet/);
  });

  it("returns the bounded first worksheet", () => {
    expect(
      firstWorksheetWithinLimits(
        workbook("B2:D5"),
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toMatchObject({ sheetName: "Data", rows: 4, columns: 3 });
  });

  it("rejects formula cells instead of trusting cached values", () => {
    expect(() =>
      assertNoWorksheetFormulas(
        { "!ref": "A1:A2", A1: { v: "value" }, A2: { f: "1+1", v: 2 } },
        MASTER_TEMPLATE_SPREADSHEET_LIMITS,
      ),
    ).toThrow(/contains formulas/);
  });
});
