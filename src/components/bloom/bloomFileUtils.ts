import type { Json } from "@/integrations/supabase/types";

export const BLOOM_UPLOADS_BUCKET = "bloom-uploads";
export const MAX_BLOOM_ATTACHMENTS = 3;
export const MAX_BLOOM_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_BLOOM_KNOWLEDGE_DOCUMENT_BYTES = MAX_BLOOM_ATTACHMENT_BYTES;

export const BLOOM_ATTACHMENT_ACCEPT = {
  "text/csv": [".csv"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    ".xlsx",
  ],
  "application/vnd.ms-excel": [".xls"],
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
} as const;

export const BLOOM_KNOWLEDGE_DOCUMENT_ACCEPT = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
} as const;

export type BloomAttachmentKind = "spreadsheet" | "document" | "image";
export type BloomKnowledgeFileType = "pdf" | "txt" | "docx";
export type BloomAttachmentProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | string;

type JsonRecord = { [key: string]: Json | undefined };

const MIME_BY_EXTENSION: Record<string, string> = {
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  xls: "application/vnd.ms-excel",
  pdf: "application/pdf",
  txt: "text/plain",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

const SUPPORTED_MIME_TYPES = new Set(Object.keys(BLOOM_ATTACHMENT_ACCEPT));

const KNOWLEDGE_FILE_BY_EXTENSION: Record<
  string,
  { fileType: BloomKnowledgeFileType; mimeType: string }
> = {
  pdf: { fileType: "pdf", mimeType: "application/pdf" },
  txt: { fileType: "txt", mimeType: "text/plain" },
  docx: {
    fileType: "docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
};

const KNOWLEDGE_FILE_BY_MIME_TYPE: Record<
  string,
  { fileType: BloomKnowledgeFileType; mimeType: string }
> = Object.values(KNOWLEDGE_FILE_BY_EXTENSION).reduce<
  Record<string, { fileType: BloomKnowledgeFileType; mimeType: string }>
>((lookup, value) => {
  lookup[value.mimeType] = value;
  return lookup;
}, {});

export function getBloomFileExtension(filename: string): string {
  const extension = filename.split(".").pop()?.trim().toLowerCase();
  return extension && extension !== filename.toLowerCase() ? extension : "";
}

export function resolveBloomAttachmentMimeType(file: File): string | null {
  const extensionMime = MIME_BY_EXTENSION[getBloomFileExtension(file.name)];
  if (extensionMime) {
    return extensionMime;
  }

  const browserMime = file.type.trim().toLowerCase();
  return SUPPORTED_MIME_TYPES.has(browserMime) ? browserMime : null;
}

export function resolveBloomKnowledgeDocumentFile(file: File): {
  fileType: BloomKnowledgeFileType;
  mimeType: string;
} | null {
  const extensionMatch =
    KNOWLEDGE_FILE_BY_EXTENSION[getBloomFileExtension(file.name)];
  if (extensionMatch) {
    return extensionMatch;
  }

  const browserMime = file.type.trim().toLowerCase();
  return KNOWLEDGE_FILE_BY_MIME_TYPE[browserMime] ?? null;
}

export function getBloomFileBaseName(filename: string): string {
  const trimmed = filename.trim();
  const extension = getBloomFileExtension(trimmed);
  if (!extension) {
    return trimmed || "Untitled document";
  }

  return trimmed.slice(0, -(extension.length + 1)).trim() || trimmed;
}

export function sanitizeBloomStorageFilename(filename: string): string {
  const sanitized = filename
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);

  return sanitized || "document";
}

export function isSupportedBloomAttachment(file: File): boolean {
  return Boolean(resolveBloomAttachmentMimeType(file));
}

export function formatBloomFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function truncateBloomFilename(
  filename: string,
  maxLength = 25,
): string {
  const trimmed = filename.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const extension = getBloomFileExtension(trimmed);
  const suffix = extension ? `.${extension}` : "";
  const available = Math.max(8, maxLength - suffix.length - 1);
  return `${trimmed.slice(0, available).trim()}...${suffix}`;
}

export function getBloomAttachmentKind(
  mimeType: string | null,
  filename = "",
): BloomAttachmentKind {
  const normalizedMime = mimeType?.toLowerCase() ?? "";
  const extension = getBloomFileExtension(filename);

  if (
    normalizedMime.startsWith("image/") ||
    ["png", "jpg", "jpeg"].includes(extension)
  ) {
    return "image";
  }

  if (
    normalizedMime === "text/csv" ||
    normalizedMime.includes("spreadsheet") ||
    normalizedMime === "application/vnd.ms-excel" ||
    ["csv", "xlsx", "xls"].includes(extension)
  ) {
    return "spreadsheet";
  }

  return "document";
}

export function toBloomAttachmentRecord(value: Json): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value
    : null;
}

export function readBloomAttachmentString(
  attachment: Json,
  keys: string[],
): string | null {
  if (typeof attachment === "string" && keys.includes("filename")) {
    const trimmed = attachment.trim();
    return trimmed || null;
  }

  const record = toBloomAttachmentRecord(attachment);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

export function readBloomAttachmentNumber(
  attachment: Json,
  keys: string[],
): number | null {
  const record = toBloomAttachmentRecord(attachment);
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

export function getBloomAttachmentFilename(
  attachment: Json,
  index: number,
): string {
  return (
    readBloomAttachmentString(attachment, [
      "filename",
      "original_filename",
      "name",
      "title",
    ]) ?? `Attachment ${index + 1}`
  );
}

export function getBloomAttachmentMimeType(attachment: Json): string | null {
  return readBloomAttachmentString(attachment, [
    "mime_type",
    "mimeType",
    "content_type",
    "contentType",
    "type",
  ]);
}

export function getBloomAttachmentStoragePath(attachment: Json): string | null {
  return readBloomAttachmentString(attachment, ["storage_path", "storagePath"]);
}

export function getBloomAttachmentStatus(
  attachment: Json,
): BloomAttachmentProcessingStatus | null {
  return readBloomAttachmentString(attachment, [
    "processing_status",
    "processingStatus",
  ]);
}

export function getBloomAttachmentSize(attachment: Json): number | null {
  return readBloomAttachmentNumber(attachment, [
    "size",
    "file_size",
    "fileSize",
  ]);
}
