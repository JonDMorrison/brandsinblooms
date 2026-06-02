import type {
  AttachmentContext,
  JsonArray,
  JsonObject,
  JsonValue,
  OpenAIImageContentPart,
  OpenAITextContentPart,
  PersistenceClient,
} from "./types.ts";

type XlsxModule = typeof import("npm:xlsx@0.18.5");

export const BLOOM_UPLOADS_BUCKET = "bloom-uploads";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 100_000;
const MAX_CONTEXT_TEXT_CHARS = 12_000;
const TEXT_PREVIEW_CHARS = 500;
const MAX_CSV_ANALYSIS_ROWS = 5;
const MAX_ATTACHMENT_NAME_CHARS = 180;

let xlsxModulePromise: Promise<XlsxModule> | null = null;

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

const ALLOWED_MIME_TYPES = new Set([
  ...CSV_MIME_TYPES,
  ...EXCEL_MIME_TYPES,
  ...TEXT_MIME_TYPES,
  ...PDF_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
]);

type AttachmentKind = "csv" | "excel" | "pdf" | "text" | "image";

type NormalizedAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  storagePath: string;
};

type ProcessAttachmentOptions = {
  conversationId: string;
  dataClient: PersistenceClient;
  openAiApiKey: string;
};

export type ProcessAttachmentResult = {
  attachment: JsonObject;
  analysisResult: JsonValue | null;
  contextInjection: string;
  imagePart: OpenAIImageContentPart | null;
};

export type ProcessAttachmentsResult = {
  attachments: JsonArray;
  context: AttachmentContext;
  readyCount: number;
  failedCount: number;
};

type CsvDataProfile = {
  rows: string[][];
  sampleRows: string[][];
  delimiter: string;
  columnCount: number;
};

type CsvAnalyzerColumn = {
  columnIndex: number | null;
  columnName: string;
  suggestedField: string | null;
  confidence: string | null;
  reasoning: string | null;
};

type CsvAnalyzerResult = {
  columnNames: string[];
  dataConsistency: {
    isConsistent: boolean;
    issues: string[];
    rowsAnalyzed: number;
  };
  suggestedMappings: CsvAnalyzerColumn[];
};

type ImageDimensions = {
  width: number | null;
  height: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) {
    return true;
  }

  if (
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return typeof value !== "number" || Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every(isJsonValue);
}

function isJsonObject(value: unknown): value is JsonObject {
  return isRecord(value) && Object.values(value).every(isJsonValue);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}

async function loadXlsxModule(): Promise<XlsxModule> {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import("npm:xlsx@0.18.5");
  }

  try {
    return await xlsxModulePromise;
  } catch (error) {
    xlsxModulePromise = null;
    throw new Error(`Excel parser failed to load: ${toErrorMessage(error)}`);
  }
}

function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function truncateText(value: string, maxChars: number): string {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxChars - 90)).trim()}\n[truncated]`;
}

function readAttachmentFilename(value: Record<string, unknown>): string {
  return (
    readString(value.filename) ??
    readString(value.original_filename) ??
    readString(value.originalFilename) ??
    "attachment"
  ).slice(0, MAX_ATTACHMENT_NAME_CHARS);
}

function readAttachmentMimeType(value: Record<string, unknown>): string | null {
  return (
    (
      readString(value.mime_type) ??
      readString(value.mimeType) ??
      readString(value.type) ??
      readString(value.content_type) ??
      readString(value.contentType)
    )?.toLowerCase() ?? null
  );
}

function readAttachmentStoragePath(
  value: Record<string, unknown>,
): string | null {
  return readString(value.storage_path) ?? readString(value.storagePath);
}

function normalizeAttachment(value: JsonValue): NormalizedAttachment | null {
  if (!isRecord(value)) {
    return null;
  }

  const filename = readAttachmentFilename(value);
  const mimeType = readAttachmentMimeType(value);
  const size = readNumber(value.size) ?? readNumber(value.file_size);
  const storagePath = readAttachmentStoragePath(value);

  if (!mimeType || size === null || !storagePath) {
    return null;
  }

  return { filename, mimeType, size, storagePath };
}

function fileKind(mimeType: string): AttachmentKind | null {
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

function attachmentBase(attachment: NormalizedAttachment): JsonObject {
  return {
    original_filename: attachment.filename,
    filename: attachment.filename,
    mime_type: attachment.mimeType,
    size: attachment.size,
    storage_path: attachment.storagePath,
  };
}

function failedAttachment(
  attachment: NormalizedAttachment | null,
  errorMessage: string,
): JsonObject {
  return {
    ...(attachment
      ? attachmentBase(attachment)
      : {
          original_filename: "attachment",
          filename: "attachment",
          mime_type: "application/octet-stream",
          size: 0,
          storage_path: "",
        }),
    processing_status: "failed",
    analysis_result: null,
    error_message: errorMessage.slice(0, 500),
  };
}

function pendingAttachment(attachment: NormalizedAttachment): JsonObject {
  return {
    ...attachmentBase(attachment),
    processing_status: "pending",
    analysis_result: null,
  };
}

function readyAttachment(
  attachment: NormalizedAttachment,
  analysisResult: JsonValue | null,
): JsonObject {
  return {
    ...attachmentBase(attachment),
    processing_status: "ready",
    analysis_result: analysisResult,
  };
}

function validateStoragePath(
  storagePath: string,
  tenantId: string,
  conversationId: string,
): string | null {
  const parts = storagePath.split("/").filter(Boolean);
  if (parts.length < 3) {
    return "Storage path must include tenant, conversation, and filename.";
  }

  if (parts[0] !== tenantId) {
    return "Storage path is outside this tenant.";
  }

  if (parts[1] !== conversationId) {
    return "Storage path is outside this conversation.";
  }

  return null;
}

function validationError(
  attachment: NormalizedAttachment,
  tenantId: string,
  conversationId: string,
): string | null {
  if (attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return "File exceeds the 10MB upload limit.";
  }

  if (!ALLOWED_MIME_TYPES.has(attachment.mimeType)) {
    return `Unsupported file type: ${attachment.mimeType}.`;
  }

  return validateStoragePath(attachment.storagePath, tenantId, conversationId);
}

async function downloadAttachmentBytes(
  storageClient: PersistenceClient,
  storagePath: string,
): Promise<Uint8Array> {
  const { data, error } = await storageClient.storage
    .from(BLOOM_UPLOADS_BUCKET)
    .download(storagePath);

  if (error) {
    throw new Error(`Failed to read uploaded file: ${error.message}`);
  }

  if (!data) {
    throw new Error("Uploaded file was empty or unavailable.");
  }

  if (data.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("File exceeds the 10MB upload limit.");
  }

  return new Uint8Array(await data.arrayBuffer());
}

function parseCsvLine(line: string, delimiter = ","): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  result.push(current.trim());
  return result;
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const delimiters = [",", ";", "\t", "|"];
  let detectedDelimiter = ",";
  let maxCount = 0;

  for (const delimiter of delimiters) {
    const count = firstLine.split(delimiter).length;
    if (count > maxCount) {
      maxCount = count;
      detectedDelimiter = delimiter;
    }
  }

  return detectedDelimiter;
}

function parseCsvText(text: string): CsvDataProfile {
  const delimiter = detectDelimiter(text);
  const rows = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseCsvLine(line, delimiter))
    .filter((row) => row.some((cell) => cell.trim().length > 0));
  const columnCount = rows.reduce(
    (maxColumns, row) => Math.max(maxColumns, row.length),
    0,
  );

  return {
    rows,
    sampleRows: rows.slice(0, MAX_CSV_ANALYSIS_ROWS),
    delimiter,
    columnCount,
  };
}

function normalizeSheetRows(rawRows: unknown): string[][] {
  if (!Array.isArray(rawRows)) {
    return [];
  }

  return rawRows
    .filter(Array.isArray)
    .map((row) =>
      row.map((cell) =>
        cell === null || cell === undefined ? "" : String(cell).trim(),
      ),
    )
    .filter((row) => row.some((cell) => cell.length > 0));
}

async function parseExcelBytes(bytes: Uint8Array): Promise<CsvDataProfile> {
  const xlsx = await loadXlsxModule();
  const workbook = xlsx.read(bytes, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error("Excel workbook did not contain any sheets.");
  }

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) {
    throw new Error("Excel workbook sheet was unavailable.");
  }

  const rows = normalizeSheetRows(
    xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      blankrows: false,
    }),
  );
  const columnCount = rows.reduce(
    (maxColumns, row) => Math.max(maxColumns, row.length),
    0,
  );

  return {
    rows,
    sampleRows: rows.slice(0, MAX_CSV_ANALYSIS_ROWS),
    delimiter: "\t",
    columnCount,
  };
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];
}

function parseCsvAnalyzerColumn(value: unknown): CsvAnalyzerColumn | null {
  if (!isRecord(value)) {
    return null;
  }

  const columnName = readString(value.columnName) ?? readString(value.name);
  if (!columnName) {
    return null;
  }

  return {
    columnIndex: readNumber(value.columnIndex) ?? readNumber(value.index),
    columnName,
    suggestedField: readString(value.suggestedField),
    confidence: readString(value.confidence),
    reasoning: readString(value.reasoning),
  };
}

function parseCsvAnalyzerResult(value: unknown): CsvAnalyzerResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const analysis = isRecord(value.analysis) ? value.analysis : value;
  const rawConsistency = isRecord(analysis.dataConsistency)
    ? analysis.dataConsistency
    : {};
  const suggestedMappings = Array.isArray(analysis.suggestedMappings)
    ? analysis.suggestedMappings
        .map(parseCsvAnalyzerColumn)
        .filter((item): item is CsvAnalyzerColumn => Boolean(item))
    : [];

  return {
    columnNames: readStringArray(analysis.columnNames),
    dataConsistency: {
      isConsistent: rawConsistency.isConsistent !== false,
      issues: readStringArray(rawConsistency.issues),
      rowsAnalyzed: readNumber(rawConsistency.rowsAnalyzed) ?? 0,
    },
    suggestedMappings,
  };
}

async function analyzeCsvWithExistingFunction(
  dataClient: PersistenceClient,
  profile: CsvDataProfile,
): Promise<CsvAnalyzerResult | null> {
  const { data, error } = await dataClient.functions.invoke(
    "analyze-csv-intelligent",
    {
      body: {
        csvRows: profile.sampleRows,
        delimiter: profile.delimiter,
        columnCount: profile.columnCount,
      },
    },
  );

  if (error) {
    throw error;
  }

  return parseCsvAnalyzerResult(data);
}

function inferColumnType(values: string[]): string {
  const samples = values
    .filter((value) => value.trim().length > 0)
    .slice(0, 20);
  if (samples.length === 0) {
    return "empty";
  }

  const numericCount = samples.filter(
    (value) => !Number.isNaN(Number(value)),
  ).length;
  const dateCount = samples.filter(
    (value) => !Number.isNaN(Date.parse(value)),
  ).length;
  const booleanCount = samples.filter((value) =>
    /^(true|false|yes|no|y|n|0|1)$/i.test(value),
  ).length;

  if (numericCount / samples.length >= 0.8) {
    return "number";
  }

  if (dateCount / samples.length >= 0.8) {
    return "date";
  }

  if (booleanCount / samples.length >= 0.8) {
    return "boolean";
  }

  return "text";
}

function distinctSampleValues(rows: string[][], columnIndex: number): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = row[columnIndex]?.trim();
    if (value) {
      values.add(value.slice(0, 80));
    }
    if (values.size >= 5) {
      break;
    }
  }

  return [...values];
}

function suggestedVisualizations(columns: JsonObject[]): string[] {
  const hasNumber = columns.some((column) => column.type === "number");
  const hasDate = columns.some((column) => column.type === "date");
  const hasCategory = columns.some((column) => column.type === "text");
  const suggestions: string[] = [];

  if (hasDate && hasNumber) {
    suggestions.push("line chart over time");
  }
  if (hasCategory && hasNumber) {
    suggestions.push("bar chart by category");
  }
  if (hasCategory) {
    suggestions.push("summary table");
  }

  return suggestions.length > 0 ? suggestions : ["data quality table"];
}

function buildCsvAnalysisResult(
  profile: CsvDataProfile,
  analyzerResult: CsvAnalyzerResult | null,
): JsonObject {
  const analyzerColumns = analyzerResult?.suggestedMappings ?? [];
  const columns = Array.from(
    { length: profile.columnCount },
    (_item, index) => {
      const analyzerColumn = analyzerColumns.find(
        (column) => column.columnIndex === index,
      );
      const name =
        analyzerColumn?.columnName ??
        analyzerResult?.columnNames[index] ??
        `Column ${index + 1}`;
      const sampleValues = distinctSampleValues(profile.rows, index);
      const column: JsonObject = {
        name,
        type: inferColumnType(profile.rows.map((row) => row[index] ?? "")),
        sample_values: sampleValues,
      };

      if (analyzerColumn?.suggestedField) {
        column.suggested_field = analyzerColumn.suggestedField;
      }
      if (analyzerColumn?.confidence) {
        column.mapping_confidence = analyzerColumn.confidence;
      }
      if (analyzerColumn?.reasoning) {
        column.mapping_reasoning = analyzerColumn.reasoning;
      }

      return column;
    },
  );

  const qualityIssues = analyzerResult?.dataConsistency.issues ?? [];
  return {
    row_count: profile.rows.length,
    column_count: profile.columnCount,
    columns,
    quality_issues: qualityIssues,
    suggested_visualizations: suggestedVisualizations(columns),
  };
}

function csvContextInjection(
  filename: string,
  analysisResult: JsonObject,
): string {
  const columns = Array.isArray(analysisResult.columns)
    ? analysisResult.columns.filter(isJsonObject)
    : [];
  const columnNames = columns
    .map((column) => readString(column.name))
    .filter(Boolean)
    .join(", ");
  const qualityIssues = Array.isArray(analysisResult.quality_issues)
    ? analysisResult.quality_issues.filter(
        (issue): issue is string => typeof issue === "string",
      )
    : [];

  return [
    `Uploaded spreadsheet "${filename}" has ${analysisResult.row_count} rows and ${analysisResult.column_count} columns.`,
    columnNames ? `Columns: ${columnNames}.` : null,
    qualityIssues.length > 0
      ? `Analysis issues: ${qualityIssues.slice(0, 5).join("; ")}.`
      : "Analysis issues: none detected in the sample.",
  ]
    .filter(Boolean)
    .join(" ");
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function decodePdfLiteralString(value: string): string {
  let output = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character !== "\\") {
      output += character;
      continue;
    }

    const next = value[index + 1];
    if (!next) {
      continue;
    }

    switch (next) {
      case "n":
        output += "\n";
        index += 1;
        break;
      case "r":
        output += "\r";
        index += 1;
        break;
      case "t":
        output += "\t";
        index += 1;
        break;
      case "b":
      case "f":
        index += 1;
        break;
      case "(":
      case ")":
      case "\\":
        output += next;
        index += 1;
        break;
      default: {
        const octal = value.slice(index + 1).match(/^[0-7]{1,3}/)?.[0];
        if (octal) {
          output += String.fromCharCode(Number.parseInt(octal, 8));
          index += octal.length;
        } else {
          output += next;
          index += 1;
        }
      }
    }
  }

  return output;
}

function extractPdfText(bytes: Uint8Array): {
  text: string;
  pageCount: number;
} {
  const raw = new TextDecoder("latin1", { fatal: false }).decode(bytes);
  const pageCount = Math.min(
    Math.max(1, raw.match(/\/Type\s*\/Page\b/g)?.length ?? 1),
    50,
  );
  const textChunks: string[] = [];
  const literalPattern = /\((?:\\.|[^\\)]){2,}\)\s*T[jJ]/g;
  const looseLiteralPattern = /\((?:\\.|[^\\)]){4,}\)/g;

  for (const match of raw.matchAll(literalPattern)) {
    const literal = match[0].replace(/\)\s*T[jJ]$/, "").slice(1);
    const decoded = decodePdfLiteralString(literal).replace(/\s+/g, " ").trim();
    if (decoded) {
      textChunks.push(decoded);
    }
    if (textChunks.join(" ").length >= MAX_TEXT_CHARS) {
      break;
    }
  }

  if (textChunks.length === 0) {
    for (const match of raw.matchAll(looseLiteralPattern)) {
      const literal = match[0].slice(1, -1);
      const decoded = decodePdfLiteralString(literal)
        .replace(/\s+/g, " ")
        .trim();
      if (/^[\p{L}\p{N}\p{P}\p{Zs}]{4,}$/u.test(decoded)) {
        textChunks.push(decoded);
      }
      if (textChunks.join(" ").length >= MAX_TEXT_CHARS) {
        break;
      }
    }
  }

  return {
    text: truncateText(
      textChunks.join(" ").replace(/\s+/g, " ").trim(),
      MAX_TEXT_CHARS,
    ),
    pageCount,
  };
}

function documentAnalysisResult(args: {
  text: string;
  pageCount: number | null;
}): JsonObject {
  return {
    page_count: args.pageCount,
    character_count: args.text.length,
    extracted_text_preview: args.text.slice(0, TEXT_PREVIEW_CHARS),
    full_text_token_count: estimateTokenCount(args.text),
  };
}

function documentContextInjection(
  filename: string,
  text: string,
  totalTokens: number,
): string {
  const truncated = text.length > MAX_CONTEXT_TEXT_CHARS;
  const visibleText = truncateText(text, MAX_CONTEXT_TEXT_CHARS);

  return [
    `Uploaded document "${filename}" extracted text${truncated ? " (truncated for context)" : ""}:`,
    visibleText || "No readable text could be extracted.",
    truncated
      ? `Document truncated. The full document has approximately ${totalTokens} tokens. Ask about specific sections if needed.`
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    bytes[offset] * 16_777_216 +
    bytes[offset + 1] * 65_536 +
    bytes[offset + 2] * 256 +
    bytes[offset + 3]
  );
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return bytes[offset] * 256 + bytes[offset + 1];
}

function readPngDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47
  ) {
    return null;
  }

  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20),
  };
}

function readJpegDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    const length = readUint16BE(bytes, offset + 2);
    if (length < 2) {
      break;
    }

    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: readUint16BE(bytes, offset + 5),
        width: readUint16BE(bytes, offset + 7),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function imageDimensions(bytes: Uint8Array, mimeType: string): ImageDimensions {
  const dimensions =
    mimeType === "image/png"
      ? readPngDimensions(bytes)
      : readJpegDimensions(bytes);

  return dimensions ?? { width: null, height: null };
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function imageFormat(mimeType: string): string {
  return mimeType === "image/png" ? "png" : "jpeg";
}

function parseOpenAiTextResponse(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.choices)) {
    return null;
  }

  const firstChoice = payload.choices[0];
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) {
    return null;
  }

  return readString(firstChoice.message.content);
}

async function describeImage(args: {
  openAiApiKey: string;
  filename: string;
  dataUrl: string;
}): Promise<string> {
  const content: Array<OpenAITextContentPart | OpenAIImageContentPart> = [
    {
      type: "text",
      text: `Describe this uploaded image for Bloom Assist. Include visible objects, text, composition, and any business-relevant observations. Filename: ${args.filename}`,
    },
    {
      type: "image_url",
      image_url: { url: args.dataUrl, detail: "low" },
    },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content }],
      max_tokens: 160,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI image analysis failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload: unknown = await response.json();
  return parseOpenAiTextResponse(payload) ?? "Image uploaded for analysis.";
}

function sanitizeStorageFilename(filename: string): string {
  const cleaned = filename
    .replace(/[/\\]/g, "_")
    .replace(/[^a-zA-Z0-9._ -]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, MAX_ATTACHMENT_NAME_CHARS)
    .replace(/^\.+/, "")
    .trim();

  return cleaned || "attachment";
}

export async function uploadToBloomStorage(
  storageClient: PersistenceClient,
  tenantId: string,
  conversationId: string,
  file: File,
): Promise<{ storagePath: string }> {
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error("File exceeds the 10MB upload limit.");
  }

  const mimeType = file.type.toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType || "unknown"}.`);
  }

  const storagePath = `${tenantId}/${conversationId}/${crypto.randomUUID()}_${sanitizeStorageFilename(file.name)}`;
  const { error } = await storageClient.storage
    .from(BLOOM_UPLOADS_BUCKET)
    .upload(storagePath, file, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload Bloom attachment: ${error.message}`);
  }

  return { storagePath };
}

export function preparePendingAttachments(
  attachments: JsonArray | null,
): JsonArray | null {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return attachments.map((attachment) => {
    const normalized = normalizeAttachment(attachment);
    if (!normalized) {
      return failedAttachment(null, "Attachment metadata was incomplete.");
    }

    return pendingAttachment(normalized);
  });
}

async function processSpreadsheetAttachment(args: {
  dataClient: PersistenceClient;
  attachment: NormalizedAttachment;
  bytes: Uint8Array;
  kind: "csv" | "excel";
}): Promise<{ analysisResult: JsonObject; contextInjection: string }> {
  const profile =
    args.kind === "csv"
      ? parseCsvText(decodeText(args.bytes))
      : await parseExcelBytes(args.bytes);

  if (profile.rows.length === 0 || profile.columnCount === 0) {
    throw new Error("Spreadsheet did not contain readable rows.");
  }

  const analyzerResult = await analyzeCsvWithExistingFunction(
    args.dataClient,
    profile,
  );
  const analysisResult = buildCsvAnalysisResult(profile, analyzerResult);

  return {
    analysisResult,
    contextInjection: csvContextInjection(
      args.attachment.filename,
      analysisResult,
    ),
  };
}

async function processDocumentAttachment(args: {
  attachment: NormalizedAttachment;
  bytes: Uint8Array;
  kind: "pdf" | "text";
}): Promise<{ analysisResult: JsonObject; contextInjection: string }> {
  const extracted =
    args.kind === "pdf"
      ? extractPdfText(args.bytes)
      : {
          text: truncateText(decodeText(args.bytes), MAX_TEXT_CHARS),
          pageCount: 1,
        };
  const analysisResult = documentAnalysisResult({
    text: extracted.text,
    pageCount: extracted.pageCount,
  });

  return {
    analysisResult,
    contextInjection: documentContextInjection(
      args.attachment.filename,
      extracted.text,
      estimateTokenCount(extracted.text),
    ),
  };
}

async function processImageAttachment(args: {
  attachment: NormalizedAttachment;
  bytes: Uint8Array;
  openAiApiKey: string;
}): Promise<{
  analysisResult: JsonObject;
  contextInjection: string;
  imagePart: OpenAIImageContentPart;
}> {
  const format = imageFormat(args.attachment.mimeType);
  const dataUrl = `data:${args.attachment.mimeType};base64,${bytesToBase64(args.bytes)}`;
  const dimensions = imageDimensions(args.bytes, args.attachment.mimeType);
  const description = await describeImage({
    openAiApiKey: args.openAiApiKey,
    filename: args.attachment.filename,
    dataUrl,
  });
  const analysisResult: JsonObject = {
    width: dimensions.width,
    height: dimensions.height,
    format,
    description,
  };

  return {
    analysisResult,
    contextInjection: `Uploaded image "${args.attachment.filename}" (${format}) analysis: ${description}`,
    imagePart: {
      type: "image_url",
      image_url: { url: dataUrl, detail: "low" },
    },
  };
}

export async function processAttachment(
  storageClient: PersistenceClient,
  serviceClient: PersistenceClient,
  attachment: JsonValue,
  tenantId: string,
  options: ProcessAttachmentOptions,
): Promise<ProcessAttachmentResult> {
  void serviceClient;
  const normalized = normalizeAttachment(attachment);
  if (!normalized) {
    return {
      attachment: failedAttachment(null, "Attachment metadata was incomplete."),
      analysisResult: null,
      contextInjection:
        "An uploaded attachment could not be processed because its metadata was incomplete.",
      imagePart: null,
    };
  }

  const error = validationError(normalized, tenantId, options.conversationId);
  if (error) {
    return {
      attachment: failedAttachment(normalized, error),
      analysisResult: null,
      contextInjection: `Attachment "${normalized.filename}" could not be processed: ${error}`,
      imagePart: null,
    };
  }

  const kind = fileKind(normalized.mimeType);
  if (!kind) {
    const message = `Unsupported file type: ${normalized.mimeType}.`;
    return {
      attachment: failedAttachment(normalized, message),
      analysisResult: null,
      contextInjection: `Attachment "${normalized.filename}" could not be processed: ${message}`,
      imagePart: null,
    };
  }

  try {
    const bytes = await downloadAttachmentBytes(
      storageClient,
      normalized.storagePath,
    );

    if (bytes.length > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error("File exceeds the 10MB upload limit.");
    }

    if (kind === "csv" || kind === "excel") {
      const result = await processSpreadsheetAttachment({
        dataClient: options.dataClient,
        attachment: normalized,
        bytes,
        kind,
      });
      return {
        attachment: readyAttachment(normalized, result.analysisResult),
        analysisResult: result.analysisResult,
        contextInjection: result.contextInjection,
        imagePart: null,
      };
    }

    if (kind === "pdf" || kind === "text") {
      const result = await processDocumentAttachment({
        attachment: normalized,
        bytes,
        kind,
      });
      return {
        attachment: readyAttachment(normalized, result.analysisResult),
        analysisResult: result.analysisResult,
        contextInjection: result.contextInjection,
        imagePart: null,
      };
    }

    const result = await processImageAttachment({
      attachment: normalized,
      bytes,
      openAiApiKey: options.openAiApiKey,
    });
    return {
      attachment: readyAttachment(normalized, result.analysisResult),
      analysisResult: result.analysisResult,
      contextInjection: result.contextInjection,
      imagePart: result.imagePart,
    };
  } catch (processingError) {
    const message = toErrorMessage(processingError);
    return {
      attachment: failedAttachment(normalized, message),
      analysisResult: null,
      contextInjection: `Attachment "${normalized.filename}" could not be processed: ${message}`,
      imagePart: null,
    };
  }
}

export async function processAttachments(args: {
  storageClient: PersistenceClient;
  serviceClient: PersistenceClient;
  dataClient: PersistenceClient;
  attachments: JsonArray | null;
  tenantId: string;
  conversationId: string;
  openAiApiKey: string;
}): Promise<ProcessAttachmentsResult> {
  if (!args.attachments || args.attachments.length === 0) {
    return {
      attachments: [],
      context: { contextInjections: [], imageParts: [] },
      readyCount: 0,
      failedCount: 0,
    };
  }

  const results = await Promise.all(
    args.attachments.map((attachment) =>
      processAttachment(
        args.storageClient,
        args.serviceClient,
        attachment,
        args.tenantId,
        {
          conversationId: args.conversationId,
          dataClient: args.dataClient,
          openAiApiKey: args.openAiApiKey,
        },
      ),
    ),
  );
  const attachments = results.map((result) => result.attachment);

  return {
    attachments,
    context: {
      contextInjections: results
        .map((result) => result.contextInjection)
        .filter((item) => item.trim().length > 0),
      imageParts: results
        .map((result) => result.imagePart)
        .filter((item): item is OpenAIImageContentPart => Boolean(item)),
    },
    readyCount: attachments.filter(
      (attachment) =>
        isJsonObject(attachment) && attachment.processing_status === "ready",
    ).length,
    failedCount: attachments.filter(
      (attachment) =>
        isJsonObject(attachment) && attachment.processing_status === "failed",
    ).length,
  };
}

export async function updateMessageAttachments(args: {
  serviceClient: PersistenceClient;
  tenantId: string;
  conversationId: string;
  messageId: string;
  attachments: JsonArray;
}): Promise<void> {
  const { error } = await args.serviceClient
    .from("bloom_messages")
    .update({ attachments: args.attachments })
    .eq("id", args.messageId)
    .eq("tenant_id", args.tenantId)
    .eq("conversation_id", args.conversationId);

  if (error) {
    throw new Error(
      `Failed to update Bloom message attachments: ${error.message}`,
    );
  }
}
