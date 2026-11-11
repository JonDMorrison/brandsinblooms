// The upload types Ask Bloom accepts, shared by attachment processing and the
// tools that read uploads. No other imports, so tool modules (and tests that
// load them outside Deno) can use it without loading the spreadsheet parser.

const CSV_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "text/comma-separated-values",
]);

const EXCEL_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);

const TEXT_MIME_TYPES = new Set(["text/plain"]);
const PDF_MIME_TYPES = new Set(["application/pdf"]);
const IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg"]);

export const ALLOWED_MIME_TYPES = new Set([
  ...CSV_MIME_TYPES,
  ...EXCEL_MIME_TYPES,
  ...TEXT_MIME_TYPES,
  ...PDF_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
]);

export type AttachmentKind = "csv" | "excel" | "pdf" | "text" | "image";

export function fileKind(mimeType: string): AttachmentKind | null {
  if (CSV_MIME_TYPES.has(mimeType)) {
    return "csv";
  }

  if (EXCEL_MIME_TYPES.has(mimeType)) {
    return "excel";
  }

  if (PDF_MIME_TYPES.has(mimeType)) {
    return "pdf";
  }

  if (TEXT_MIME_TYPES.has(mimeType)) {
    return "text";
  }

  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return "image";
  }

  return null;
}

