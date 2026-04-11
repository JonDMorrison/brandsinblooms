export const FORM_UPLOAD_BUCKET = "form-uploads";
export const FORM_UPLOAD_MAX_FILE_SIZE_MB = 25;
export const FORM_UPLOAD_DEFAULT_MAX_FILE_SIZE_MB = 10;
export const FORM_UPLOAD_DEFAULT_MAX_FILES = 1;

export interface FormFileUploadReference {
  upload_id: string;
  field_id: string;
  session_id?: string;
  bucket: string;
  path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_at: string;
}

interface FileRulesLike {
  max_files?: unknown;
  max_file_size_mb?: unknown;
  allowed_mime_types?: unknown;
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

export function sanitizeUploadFileName(fileName: string): string {
  const normalizedFileName = fileName.trim().replace(/\s+/g, "-");
  const sanitized = normalizedFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.slice(0, 160) || "upload.bin";
}

export function normalizeAllowedMimeTypes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 25),
    ),
  );
}

export function getFileFieldMaxFiles(rules?: FileRulesLike | null): number {
  const rawValue = rules?.max_files;

  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return FORM_UPLOAD_DEFAULT_MAX_FILES;
  }

  return clampInteger(rawValue, 1, 10);
}

export function getFileFieldMaxFileSizeMb(
  rules?: FileRulesLike | null,
): number {
  const rawValue = rules?.max_file_size_mb;

  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return FORM_UPLOAD_DEFAULT_MAX_FILE_SIZE_MB;
  }

  return clampInteger(rawValue, 1, FORM_UPLOAD_MAX_FILE_SIZE_MB);
}

export function getFileFieldAllowedMimeTypes(
  rules?: FileRulesLike | null,
): string[] {
  return normalizeAllowedMimeTypes(rules?.allowed_mime_types);
}

export function sanitizeFileFieldRules(rules: unknown): {
  max_files: number;
  max_file_size_mb: number;
  allowed_mime_types: string[];
} {
  const rawRules =
    rules && typeof rules === "object" && !Array.isArray(rules)
      ? (rules as FileRulesLike)
      : undefined;

  return {
    max_files: getFileFieldMaxFiles(rawRules),
    max_file_size_mb: getFileFieldMaxFileSizeMb(rawRules),
    allowed_mime_types: getFileFieldAllowedMimeTypes(rawRules),
  };
}

export function matchesAcceptedFileType(
  file: { file_name: string; mime_type: string },
  allowedMimeTypes: string[],
): boolean {
  if (allowedMimeTypes.length === 0) {
    return true;
  }

  const fileName = file.file_name.toLowerCase();
  const mimeType = (file.mime_type || "").toLowerCase();

  return allowedMimeTypes.some((allowedType) => {
    const normalizedAllowedType = allowedType.toLowerCase();

    if (normalizedAllowedType.startsWith(".")) {
      return fileName.endsWith(normalizedAllowedType);
    }

    if (normalizedAllowedType.endsWith("/*")) {
      const typePrefix = normalizedAllowedType.slice(0, -1);
      return mimeType.startsWith(typePrefix);
    }

    if (normalizedAllowedType.includes("/")) {
      return mimeType === normalizedAllowedType;
    }

    return fileName.endsWith(`.${normalizedAllowedType}`);
  });
}

export function isFormFileUploadReference(
  value: unknown,
): value is FormFileUploadReference {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const candidate = value as Partial<FormFileUploadReference>;

  return (
    typeof candidate.upload_id === "string" &&
    typeof candidate.field_id === "string" &&
    typeof candidate.bucket === "string" &&
    typeof candidate.path === "string" &&
    typeof candidate.file_name === "string" &&
    typeof candidate.file_size === "number" &&
    Number.isFinite(candidate.file_size) &&
    typeof candidate.mime_type === "string" &&
    typeof candidate.uploaded_at === "string"
  );
}

export function getFormFileUploadReferences(
  value: unknown,
): FormFileUploadReference[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isFormFileUploadReference);
}

export function isTemporaryFormUploadPath(
  path: string,
  embedKey: string,
  fieldId: string,
  uploadId: string,
): boolean {
  const segments = path.split("/");

  return (
    segments.length >= 5 &&
    segments[0] === "temp" &&
    segments[1] === embedKey &&
    segments[3] === fieldId &&
    segments[4].startsWith(`${uploadId}-`)
  );
}

export function buildFormPermanentUploadPath(
  tenantId: string,
  formId: string,
  submissionId: string,
  fieldId: string,
  uploadId: string,
  fileName: string,
): string {
  return [
    "tenants",
    tenantId,
    "forms",
    formId,
    "submissions",
    submissionId,
    fieldId,
    `${uploadId}-${sanitizeUploadFileName(fileName)}`,
  ].join("/");
}
