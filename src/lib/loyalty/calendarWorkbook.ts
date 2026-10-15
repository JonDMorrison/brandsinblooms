import type { WorkBook, WorkSheet } from "xlsx";
export interface WorkbookSource {
  name: string;
  workbook: WorkBook;
  sheets: string[];
  epoch: "excel_1900" | "excel_1904";
}
export async function openCalendarWorkbook(
  file: File,
): Promise<WorkbookSource> {
  if (
    !/\.(xlsx|xls|csv|tsv|txt)$/i.test(file.name) ||
    file.size > 5 * 1024 * 1024
  )
    throw new Error("Choose an Excel or CSV file no larger than 5 MB.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: false,
    cellFormula: true,
    raw: true,
  });
  if (!workbook.SheetNames.length || workbook.SheetNames.length > 30)
    throw new Error("Choose a workbook containing 1 to 30 sheets.");
  return {
    name: file.name,
    workbook,
    sheets: workbook.SheetNames,
    epoch: workbook.Workbook?.WBProps?.date1904 ? "excel_1904" : "excel_1900",
  };
}
export async function calendarWorkbookRows(
  source: WorkbookSource,
  sheetName: string,
  headerRow: number,
): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const XLSX = await import("xlsx");
  const sheet: WorkSheet | undefined = source.workbook.Sheets[sheetName];
  if (!sheet || !sheet["!ref"] || !Number.isInteger(headerRow) || headerRow < 1)
    throw new Error("Choose a sheet and its heading row.");
  const range = XLSX.utils.decode_range(sheet["!ref"]);
  if (
    range.e.c - range.s.c > 39 ||
    range.e.r - headerRow > 2000 ||
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
