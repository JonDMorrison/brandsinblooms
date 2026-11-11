import type { WorkBook, WorkSheet } from "xlsx";

export interface SpreadsheetLimits {
  readonly label: string;
  readonly maxBytes: number;
  readonly maxSheets: number;
  readonly maxRows: number;
  readonly maxColumns: number;
}

const MEBIBYTE = 1024 * 1024;
const A1_RANGE = /^\$?([A-Z]+)\$?([1-9]\d*)(?::\$?([A-Z]+)\$?([1-9]\d*))?$/i;

function columnIndex(column: string): number {
  let value = 0;
  for (const character of column.toUpperCase()) {
    value = value * 26 + character.charCodeAt(0) - 64;
    if (!Number.isSafeInteger(value)) return -1;
  }
  return value - 1;
}

function decodeStrictRange(reference: unknown) {
  if (typeof reference !== "string") return null;
  const match = A1_RANGE.exec(reference);
  if (!match) return null;
  const startRow = Number(match[2]) - 1;
  const endRow = Number(match[4] ?? match[2]) - 1;
  const startColumn = columnIndex(match[1]);
  const endColumn = columnIndex(match[3] ?? match[1]);
  const boundaries = [startRow, startColumn, endRow, endColumn];
  if (
    boundaries.some(
      (boundary) => !Number.isSafeInteger(boundary) || boundary < 0,
    ) ||
    endRow < startRow ||
    endColumn < startColumn
  )
    return null;
  return {
    s: { r: startRow, c: startColumn },
    e: { r: endRow, c: endColumn },
  };
}

export const MASTER_TEMPLATE_SPREADSHEET_LIMITS: SpreadsheetLimits = {
  label: "template import file",
  maxBytes: 5 * MEBIBYTE,
  maxSheets: 1,
  maxRows: 500,
  maxColumns: 50,
};

export const ADMIN_RESOURCE_SPREADSHEET_LIMITS: SpreadsheetLimits = {
  label: "AI resource file",
  maxBytes: 5 * MEBIBYTE,
  maxSheets: 1,
  maxRows: 5_000,
  maxColumns: 100,
};

export const CUSTOMER_IMPORT_SPREADSHEET_LIMITS: SpreadsheetLimits = {
  label: "customer import file",
  maxBytes: 5 * MEBIBYTE,
  maxSheets: 1,
  maxRows: 10_001,
  maxColumns: 50,
};

export const LOYALTY_CALENDAR_SPREADSHEET_LIMITS: SpreadsheetLimits = {
  label: "loyalty calendar file",
  maxBytes: 5 * MEBIBYTE,
  maxSheets: 30,
  maxRows: 2_100,
  maxColumns: 40,
};

export function assertSpreadsheetFileSize(
  file: Pick<File, "size">,
  limits: SpreadsheetLimits,
): void {
  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    throw new Error(`The ${limits.label} has an invalid file size.`);
  }
  if (file.size > limits.maxBytes) {
    throw new Error(
      `The ${limits.label} must be ${Math.floor(limits.maxBytes / MEBIBYTE)} MB or smaller.`,
    );
  }
}

export function firstWorksheetWithinLimits(
  workbook: Pick<WorkBook, "SheetNames" | "Sheets">,
  limits: SpreadsheetLimits,
): { sheetName: string; worksheet: WorkSheet; rows: number; columns: number } {
  assertWorkbookSheetCount(workbook, limits);

  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet?.["!ref"]) {
    throw new Error(`The first worksheet in the ${limits.label} is empty.`);
  }

  const { rows, columns } = worksheetDimensionsWithinLimits(worksheet, limits);
  return { sheetName, worksheet, rows, columns };
}

export function assertWorkbookSheetCount(
  workbook: Pick<WorkBook, "SheetNames">,
  limits: SpreadsheetLimits,
): void {
  if (
    !Array.isArray(workbook.SheetNames) ||
    workbook.SheetNames.length < 1 ||
    workbook.SheetNames.length > limits.maxSheets
  ) {
    throw new Error(
      limits.maxSheets === 1
        ? `The ${limits.label} must contain exactly one worksheet.`
        : `The ${limits.label} must contain 1 to ${limits.maxSheets} worksheets.`,
    );
  }
}

export function worksheetDimensionsWithinLimits(
  worksheet: WorkSheet,
  limits: SpreadsheetLimits,
): { rows: number; columns: number } {
  if (!worksheet?.["!ref"]) {
    throw new Error(`A worksheet in the ${limits.label} is empty.`);
  }

  // SheetJS preserves the original range in !fullref when sheetRows truncates
  // parsing. Validate that range so a workbook cannot hide excess rows behind
  // the parser's protective read limit.
  const rangeReference = worksheet["!fullref"] ?? worksheet["!ref"];
  const range = decodeStrictRange(rangeReference);
  if (!range) {
    throw new Error(`The ${limits.label} contains an invalid worksheet range.`);
  }

  // `sheetRows` is an absolute worksheet-row ceiling, not a row-count limit.
  // An offset range can therefore have an allowed span while still being cut
  // short. Any distinct !fullref proves the parser truncated source data.
  if (
    worksheet["!fullref"] &&
    worksheet["!fullref"] !== worksheet["!ref"]
  ) {
    throw new Error(
      `The ${limits.label} may contain at most ${limits.maxRows.toLocaleString()} rows and ${limits.maxColumns} columns. Nothing was imported or truncated.`,
    );
  }

  const rows = range.e.r - range.s.r + 1;
  const columns = range.e.c - range.s.c + 1;
  if (rows > limits.maxRows || columns > limits.maxColumns) {
    throw new Error(
      `The ${limits.label} may contain at most ${limits.maxRows.toLocaleString()} rows and ${limits.maxColumns} columns.`,
    );
  }

  return { rows, columns };
}

export function assertNoWorksheetFormulas(
  worksheet: WorkSheet,
  limits: SpreadsheetLimits,
): void {
  for (const [address, value] of Object.entries(worksheet)) {
    if (address.startsWith("!") || !value || typeof value !== "object") {
      continue;
    }
    const formula = (value as { f?: unknown }).f;
    if (typeof formula === "string" && formula.trim().length > 0) {
      throw new Error(
        `The ${limits.label} contains formulas. Replace formulas with their literal values before importing. Nothing was imported.`,
      );
    }
  }
}
