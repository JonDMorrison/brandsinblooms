import type { WorkSheet } from "xlsx";
import {
  LOYALTY_CALENDAR_SPREADSHEET_LIMITS,
  assertSpreadsheetFileSize,
  assertWorkbookSheetCount,
  worksheetDimensionsWithinLimits,
} from "@/lib/security/spreadsheetLimits";
export interface WorkbookSource {
  name: string;
  bytes: Uint8Array;
  sheets: string[];
  epoch: "excel_1900" | "excel_1904";
}

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

export async function openCalendarWorkbook(
  file: File,
): Promise<WorkbookSource> {
  if (!/\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name))
    throw new Error("Choose an Excel or CSV file no larger than 5 MB.");
  assertSpreadsheetFileSize(file, LOYALTY_CALENDAR_SPREADSHEET_LIMITS);

  const XLSX = await import("xlsx");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (/\.(csv|tsv|txt)$/i.test(file.name)) {
    if (looksLikeWorkbookContainer(bytes)) {
      throw new Error(
        "Workbook content must be saved as XLSX before import, not renamed as CSV or text.",
      );
    }
    return {
      name: file.name,
      bytes,
      sheets: ["Sheet1"],
      epoch: "excel_1900",
    };
  }
  const workbook = XLSX.read(bytes, {
    type: "array",
    bookSheets: true,
  });
  assertWorkbookSheetCount(workbook, LOYALTY_CALENDAR_SPREADSHEET_LIMITS);
  if (isAlternateWorkbookFormat(workbook)) {
    throw new Error(
      "This spreadsheet format cannot be bounded safely and must be converted to XLSX before import.",
    );
  }
  if (workbook.SheetNames.length > 1 && isLegacyBiffWorkbook(bytes)) {
    throw new Error(
      "Legacy XLS calendars with multiple worksheets must be converted to XLSX before import.",
    );
  }
  const workbookProperties = XLSX.read(bytes, {
    type: "array",
    sheets: [],
    sheetRows: 1,
    cellFormula: false,
  });
  return {
    name: file.name,
    bytes,
    sheets: workbook.SheetNames,
    epoch: workbookProperties.Workbook?.WBProps?.date1904
      ? "excel_1904"
      : "excel_1900",
  };
}
export async function calendarWorkbookRows(
  source: WorkbookSource,
  sheetName: string,
  headerRow: number,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const XLSX = await import("xlsx");
  if (!source.sheets.includes(sheetName))
    throw new Error("Choose a sheet and its heading row.");
  const workbook = XLSX.read(source.bytes, {
    type: "array",
    cellDates: false,
    cellFormula: true,
    raw: true,
    sheets: [sheetName],
    sheetRows: LOYALTY_CALENDAR_SPREADSHEET_LIMITS.maxRows + 1,
  });
  const loadedSheetNames = Object.keys(workbook.Sheets);
  if (
    loadedSheetNames.length !== 1 ||
    loadedSheetNames[0] !== sheetName
  ) {
    throw new Error(
      "This spreadsheet format cannot safely isolate the selected worksheet. Convert it to XLSX before import.",
    );
  }
  const sheet: WorkSheet | undefined = workbook.Sheets[sheetName];
  if (
    !sheet ||
    !sheet["!ref"] ||
    !Number.isInteger(headerRow) ||
    headerRow < 1 ||
    headerRow > 100
  )
    throw new Error("Choose a sheet and its heading row.");
  worksheetDimensionsWithinLimits(
    sheet,
    LOYALTY_CALENDAR_SPREADSHEET_LIMITS,
  );
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (
    range.e.c - range.s.c > 39 ||
    range.e.r - headerRow + 1 > 2000 ||
    headerRow > range.e.r + 1
  )
    throw new Error(
      "Use at most 40 columns and 2,000 data rows beneath the heading row. Nothing was truncated.",
    );
  const headers: string[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: headerRow - 1, c })];
    if (cell?.f)
      throw new Error("Heading cells must be literal text, not formulas.");
    const text = String(cell?.v ?? "").trim();
    if (!text || text.length > 150 || headers.includes(text))
      throw new Error(
        "Every imported column needs a distinct nonempty heading.",
      );
    headers.push(text);
  }
  const rows: Record<string, unknown>[] = [];
  for (let r = headerRow; r <= range.e.r; r++) {
    const row: Record<string, unknown> = {};
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = sheet[XLSX.utils.encode_cell({ r, c })];
      // Formula results are not trusted as original input. The server will mark the row for review.
      row[headers[c - range.s.c]] = cell?.f
        ? { formula: cell.f, cachedValue: cell.v ?? null }
        : (cell?.v ?? "");
    }
    // Preserve even blank rows so the preview accounts for every source row.
    rows.push(row);
  }
  if (!rows.length)
    throw new Error("There are no data rows beneath the selected heading.");
  return { headers, rows };
}
