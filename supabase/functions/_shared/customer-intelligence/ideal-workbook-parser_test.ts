import { assertEquals, assertThrows } from "@std/assert";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { parseIdealWorkbookRows } from "./ideal-workbook-parser.ts";

const encode = (value: string) => new TextEncoder().encode(value);

function workbookBytes(
  sheets: Record<string, Record<string, unknown>>,
  bookType: "xlsx" | "biff8" | "xlml" | "ods" | "fods" = "xlsx",
): Uint8Array {
  const output = XLSX.write(
    { SheetNames: Object.keys(sheets), Sheets: sheets },
    { type: "array", bookType },
  );
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

Deno.test("Ideal parser pins the reviewed SheetJS release", () => {
  assertEquals(XLSX.version, "0.20.3");
});

Deno.test("Ideal parser rejects files over its byte budget", () => {
  assertThrows(
    () =>
      parseIdealWorkbookRows(
        new Uint8Array(25 * 1024 * 1024 + 1),
        "report.csv",
      ),
    Error,
    "25 MB",
  );
});

Deno.test("Ideal CSV parsing preserves quoted commas and newlines", () => {
  const rows = parseIdealWorkbookRows(
    encode(
      'Customer Code,Notes\n000001,"Bought pots, soil\nand seeds"',
    ),
    "Customer Sales.csv",
  );
  assertEquals(rows[0]["Customer Code"], "000001");
  assertEquals(rows[0].Notes, "Bought pots, soil\nand seeds");
});

Deno.test("Ideal workbook parsing rejects formula cache values", () => {
  const bytes = workbookBytes({
    Report: {
      "!ref": "A1:A2",
      A1: { t: "s", v: "Customer Code" },
      A2: { t: "n", f: "1+1", v: 2 },
    },
  });
  assertThrows(
    () => parseIdealWorkbookRows(bytes, "report.xlsx"),
    Error,
    "Formula cells are not accepted",
  );
});

Deno.test("Ideal workbook parsing rejects excess sheets and columns", () => {
  const sheets = Object.fromEntries(
    Array.from({ length: 31 }, (_, index) => [
      `Report ${index + 1}`,
      { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
    ]),
  );
  assertThrows(
    () => parseIdealWorkbookRows(workbookBytes(sheets), "report.xlsx"),
    Error,
    "at most 30 worksheets",
  );

  const wide = {
    "!ref": "A1:IW2",
    A1: { t: "s", v: "Customer Code" },
    IW2: { t: "s", v: "outside reviewed width" },
  };
  assertThrows(
    () =>
      parseIdealWorkbookRows(workbookBytes({ Report: wide }), "report.xlsx"),
    Error,
    "range exceeds reviewed limits",
  );
});

Deno.test("Ideal parser rejects multi-sheet legacy XLS renamed as XLSX before cell parsing", () => {
  const bytes = workbookBytes(
    {
      Report: { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
      More: { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
    },
    "biff8",
  );
  assertThrows(
    () => parseIdealWorkbookRows(bytes, "report.xlsx"),
    Error,
    "converted to XLSX or prepared locally",
  );
});

for (const bookType of ["xlml", "ods", "fods"] as const) {
  Deno.test(`Ideal parser rejects multi-sheet ${bookType} renamed as XLSX`, () => {
    const bytes = workbookBytes(
      {
        Report: { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
        More: { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
      },
      bookType,
    );
    assertThrows(
      () => parseIdealWorkbookRows(bytes, "report.xlsx"),
      Error,
      "cannot be bounded safely",
    );
  });
}

for (const bookType of ["ods", "fods"] as const) {
  Deno.test(`Ideal parser rejects single-sheet ${bookType} renamed as XLSX`, () => {
    const bytes = workbookBytes(
      {
        Report: { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
      },
      bookType,
    );
    assertThrows(
      () => parseIdealWorkbookRows(bytes, "report.xlsx"),
      Error,
      "cannot be bounded safely",
    );
  });
}

for (const bookType of ["ods", "xlml"] as const) {
  Deno.test(`Ideal parser rejects ${bookType} bytes disguised as CSV`, () => {
    const bytes = workbookBytes(
      {
        Report: { "!ref": "A1", A1: { t: "s", v: "Customer Code" } },
      },
      bookType,
    );
    const disguised =
      bookType === "xlml" ? new Uint8Array(bytes.length + 2048) : bytes;
    if (bookType === "xlml") {
      disguised.fill(0x20, 0, 2048);
      disguised.set(bytes, 2048);
    }
    assertThrows(
      () => parseIdealWorkbookRows(disguised, "report.csv"),
      Error,
      "not renamed as CSV or text",
    );
  });
}

Deno.test("Ideal workbook parsing rejects real offset truncation", () => {
  const bytes = workbookBytes({
    Report: {
      "!ref": "A3:A120002",
      A3: { t: "s", v: "Customer Code" },
      A120002: { t: "s", v: "last" },
    },
  });
  assertThrows(
    () => parseIdealWorkbookRows(bytes, "report.xlsx"),
    Error,
    "truncated by the safe parser limit",
  );
});
