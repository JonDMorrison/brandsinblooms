import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import {
  assertSafeSpreadsheetWorksheet,
  parseSpreadsheetRows,
} from "./attachments.ts";

const encode = (value: string) => new TextEncoder().encode(value);

function workbookBytes(
  sheets: Record<string, Record<string, unknown>>,
  bookType: "xlsx" | "biff8" = "xlsx",
): Uint8Array {
  const output = XLSX.write(
    { SheetNames: Object.keys(sheets), Sheets: sheets },
    { type: "array", bookType },
  );
  return output instanceof Uint8Array ? output : new Uint8Array(output);
}

Deno.test("Bloom spreadsheet parser pins the reviewed SheetJS release", () => {
  assertEquals(XLSX.version, "0.20.3");
});

Deno.test("Bloom CSV parser preserves quoted delimiters and newlines", async () => {
  const rows = await parseSpreadsheetRows(
    encode(
      'Email,Tags,Notes\njane@example.com,"gardening,tools","First line\nSecond line"',
    ),
    "csv",
  );
  assertEquals(rows, [
    ["Email", "Tags", "Notes"],
    ["jane@example.com", "gardening,tools", "First line\nSecond line"],
  ]);
});

Deno.test("Bloom CSV parser rejects excessive rows and columns", async () => {
  await assertRejects(
    () =>
      parseSpreadsheetRows(
        encode(Array.from({ length: 5_001 }, () => "value").join("\n")),
        "csv",
      ),
    Error,
    "at most 5,000 rows",
  );
  await assertRejects(
    () =>
      parseSpreadsheetRows(
        encode(Array.from({ length: 101 }, (_, index) => `c${index}`).join(",")),
        "csv",
      ),
    Error,
    "at most 100 columns",
  );
});

Deno.test("Bloom spreadsheet parser rejects files above five MB", async () => {
  await assertRejects(
    () => parseSpreadsheetRows(new Uint8Array(5 * 1024 * 1024 + 1), "csv"),
    Error,
    "5 MB",
  );
});

Deno.test("Bloom Excel parser rejects multiple sheets and formulas", async () => {
  await assertRejects(
    () =>
      parseSpreadsheetRows(
        workbookBytes({
          Customers: { "!ref": "A1", A1: { v: "Email" } },
          More: { "!ref": "A1", A1: { v: "Email" } },
        }),
        "excel",
      ),
    Error,
    "exactly one worksheet",
  );
  await assertRejects(
    () =>
      parseSpreadsheetRows(
        workbookBytes(
          {
            Customers: { "!ref": "A1", A1: { v: "Email" } },
            More: { "!ref": "A1", A1: { v: "Email" } },
          },
          "biff8",
        ),
        "excel",
      ),
    Error,
    "exactly one worksheet",
  );
  await assertRejects(
    () =>
      parseSpreadsheetRows(
        workbookBytes({
          Customers: {
            "!ref": "A1:A2",
            A1: { v: "Value" },
            A2: { f: "1+1", v: 2 },
          },
        }),
        "excel",
      ),
    Error,
    "cannot contain formulas",
  );
});

Deno.test("Bloom Excel parser rejects offset truncation", async () => {
  await assertRejects(
    () =>
      parseSpreadsheetRows(
        workbookBytes({
          Customers: {
            "!ref": "A3:A5002",
            A3: { v: "Email" },
            A5002: { v: "last@example.com" },
          },
        }),
        "excel",
      ),
    Error,
    "Nothing was truncated",
  );
});

Deno.test("Bloom Excel parser accepts exact row and column boundaries", async () => {
  const exactRows = XLSX.utils.aoa_to_sheet(
    Array.from({ length: 5_000 }, (_, index) => [index]),
  ) as Record<string, unknown>;
  const exactColumns = XLSX.utils.aoa_to_sheet([
    Array.from({ length: 100 }, (_, index) => `column ${index + 1}`),
  ]) as Record<string, unknown>;
  assertEquals(
    (await parseSpreadsheetRows(workbookBytes({ Data: exactRows }), "excel"))
      .length,
    5_000,
  );
  assertEquals(
    (await parseSpreadsheetRows(
      workbookBytes({ Data: exactColumns }),
      "excel",
    ))[0].length,
    100,
  );
});

Deno.test("Bloom Excel parser rejects one row or column beyond its boundary", async () => {
  const excessRows = XLSX.utils.aoa_to_sheet(
    Array.from({ length: 5_001 }, (_, index) => [index]),
  ) as Record<string, unknown>;
  const excessColumns = XLSX.utils.aoa_to_sheet([
    Array.from({ length: 101 }, (_, index) => `column ${index + 1}`),
  ]) as Record<string, unknown>;
  await assertRejects(
    () =>
      parseSpreadsheetRows(workbookBytes({ Data: excessRows }), "excel"),
    Error,
    "at most 5,000 rows",
  );
  await assertRejects(
    () =>
      parseSpreadsheetRows(workbookBytes({ Data: excessColumns }), "excel"),
    Error,
    "at most 5,000 rows and 100 columns",
  );
});

Deno.test("Bloom Excel range validation rejects malformed and reversed metadata", () => {
  assertThrows(
    () => assertSafeSpreadsheetWorksheet({ "!ref": "not-a-range" }),
    Error,
    "Nothing was truncated",
  );
  assertThrows(
    () => assertSafeSpreadsheetWorksheet({ "!ref": "A5000000:A1" }),
    Error,
    "Nothing was truncated",
  );
  assertThrows(
    () =>
      assertSafeSpreadsheetWorksheet({
        "!ref": "A1:A2",
        "!fullref": "not-a-range",
      }),
    Error,
    "Nothing was truncated",
  );
  assertThrows(
    () =>
      assertSafeSpreadsheetWorksheet({
        "!ref": "A1:A2",
        "!fullref": "A3:A1",
      }),
    Error,
    "Nothing was truncated",
  );
  assertThrows(
    () =>
      assertSafeSpreadsheetWorksheet({
        "!ref": "A1:A5000",
        "!fullref": "A1:A5001",
      }),
    Error,
    "Nothing was truncated",
  );
});
