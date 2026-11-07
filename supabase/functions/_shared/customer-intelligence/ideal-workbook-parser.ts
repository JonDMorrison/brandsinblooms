// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import {
  collectIdealWorkbookRows,
  idealWorksheetBounds,
  type IdealWorkbook,
} from "./ideal-workbook.ts";

export const MAX_IDEAL_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_IDEAL_SOURCE_ROWS = 120_000;
const OLE_COMPOUND_FILE_HEADER = [
  0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
] as const;

function isLegacyBiffWorkbook(bytes: Uint8Array): boolean {
  return OLE_COMPOUND_FILE_HEADER.every(
    (value, index) => bytes[index] === value,
  );
}

function isZipContainer(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

function isXmlWorkbook(bytes: Uint8Array): boolean {
  const content = new TextDecoder().decode(bytes).toLowerCase();
  return (
    (content.includes("<workbook") &&
      content.includes("urn:schemas-microsoft-com:office:spreadsheet")) ||
    (content.includes("<office:document") &&
      content.includes("urn:oasis:names:tc:opendocument:xmlns"))
  );
}

function looksLikeWorkbookContainer(bytes: Uint8Array): boolean {
  return (
    isLegacyBiffWorkbook(bytes) ||
    isZipContainer(bytes) ||
    isXmlWorkbook(bytes)
  );
}

function isAlternateWorkbookFormat(workbook: {
  bookType?: unknown;
}): boolean {
  // SheetJS identifies XLML, ODS and FODS through bookType. Those formats
  // ignore selected-sheet reads and are outside the supported file contract.
  return "bookType" in workbook;
}

export function parseIdealWorkbookRows(
  bytes: Uint8Array,
  name: string,
): Record<string, unknown>[] {
  if (bytes.byteLength > MAX_IDEAL_SOURCE_BYTES) {
    throw new Error("File exceeds 25 MB limit");
  }
  if (!/\.xlsx?$/i.test(name)) {
    if (looksLikeWorkbookContainer(bytes)) {
      throw new Error(
        "Workbook content must be saved as XLSX before import, not renamed as CSV or text.",
      );
    }
    const workbook = XLSX.read(
      new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      {
        type: "string",
        FS: /\.txt$/i.test(name) ? "\t" : ",",
        cellFormula: true,
        sheetRows: MAX_IDEAL_SOURCE_ROWS + 1,
      },
    );
    return collectIdealWorkbookRows(
      workbook as unknown as IdealWorkbook,
      MAX_IDEAL_SOURCE_ROWS,
    );
  }

  const metadata = XLSX.read(bytes, { type: "array", bookSheets: true });
  if (metadata.SheetNames.length < 1) {
    throw new Error("No worksheet in the supplied Ideal report.");
  }
  if (metadata.SheetNames.length > 30) {
    throw new Error("Ideal reports may contain at most 30 worksheets.");
  }
  if (isAlternateWorkbookFormat(metadata)) {
    throw new Error(
      "This spreadsheet format cannot be bounded safely and must be converted to XLSX or prepared locally before import.",
    );
  }
  if (metadata.SheetNames.length > 1 && isLegacyBiffWorkbook(bytes)) {
    throw new Error(
      "Legacy XLS reports with multiple worksheets must be converted to XLSX or prepared locally before import.",
    );
  }

  const sheets: IdealWorkbook["Sheets"] = Object.create(null);
  let remainingRows = MAX_IDEAL_SOURCE_ROWS;
  for (const sheetName of metadata.SheetNames) {
    const selected = XLSX.read(bytes, {
      type: "array",
      cellDates: false,
      cellFormula: true,
      sheets: [sheetName],
      sheetRows: remainingRows + 1,
    });
    const loadedSheetNames = Object.keys(selected.Sheets);
    if (
      loadedSheetNames.length !== 1 ||
      loadedSheetNames[0] !== sheetName
    ) {
      throw new Error(
        "This spreadsheet format cannot safely isolate the selected worksheet. Convert it to XLSX before import.",
      );
    }
    const sheet = selected.Sheets[sheetName] as unknown as Record<
      string,
      unknown
    >;
    if (!sheet) throw new Error("Worksheet missing from source.");
    const range = idealWorksheetBounds(sheet);
    if (range) {
      const rowCount = range.end - range.start + 1;
      if (rowCount > remainingRows) {
        throw new Error(
          "Workbook exceeds the reviewed row limit. Use local source preparation; do not remove source rows.",
        );
      }
      remainingRows -= rowCount;
    }
    sheets[sheetName] = sheet;
  }

  return collectIdealWorkbookRows(
    { SheetNames: metadata.SheetNames, Sheets: sheets },
    MAX_IDEAL_SOURCE_ROWS,
  );
}
