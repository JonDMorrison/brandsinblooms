import { SUPABASE_URL } from "@/integrations/supabase/config";
import { FormField, FormFileUploadReference } from "@/types/formBuilder";

const DEFAULT_SUPABASE_URL = SUPABASE_URL;
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkbGRta3F3bnhoZGV6dHlxY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNTg0MzQsImV4cCI6MjA2NDYzNDQzNH0.1iO2-DRx5aX_WpEcDGv9aKHGy1rdDPOZaQC6Ke4MpRM";

export const FORM_UPLOAD_BUCKET = "form-uploads";
export const FORM_UPLOAD_MAX_FILE_SIZE_MB = 25;
export const FORM_UPLOAD_MAX_FILE_SIZE_BYTES =
  FORM_UPLOAD_MAX_FILE_SIZE_MB * 1024 * 1024;
export const DEFAULT_FILE_FIELD_MAX_FILES = 1;
export const DEFAULT_FILE_FIELD_MAX_FILE_SIZE_MB = 10;

export const FILE_TYPE_PRESETS = {
  images: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  documents: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ],
} as const;

export interface FormUploadRequest {
  cancel: () => void;
  promise: Promise<FormFileUploadReference>;
  uploadId: string;
}

type FileLike = Pick<File, "name" | "type" | "size">;

function clampInteger(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)));
}

function normalizeMimeTypeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function encodeStoragePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function getFileNameFromUnknown(value: {
  name?: string;
  file_name?: string;
}): string {
  return value.name || value.file_name || "file";
}

export function isFileField(field: Pick<FormField, "type">): boolean {
  return field.type === "file";
}

export function getFileFieldAllowedMimeTypes(
  field: Pick<FormField, "rules">,
): string[] {
  return normalizeMimeTypeList(field.rules?.allowed_mime_types);
}

export function getFileFieldMaxFiles(field: Pick<FormField, "rules">): number {
  const rawValue = field.rules?.max_files;

  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return DEFAULT_FILE_FIELD_MAX_FILES;
  }

  return clampInteger(rawValue, 1, 10);
}

export function getFileFieldMaxFileSizeMb(
  field: Pick<FormField, "rules">,
): number {
  const rawValue = field.rules?.max_file_size_mb;

  if (typeof rawValue !== "number" || !Number.isFinite(rawValue)) {
    return DEFAULT_FILE_FIELD_MAX_FILE_SIZE_MB;
  }

  return clampInteger(rawValue, 1, FORM_UPLOAD_MAX_FILE_SIZE_MB);
}

export function getFileFieldMaxFileSizeBytes(
  field: Pick<FormField, "rules">,
): number {
  return getFileFieldMaxFileSizeMb(field) * 1024 * 1024;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes >= 100 ? 0 : 1)} KB`;
  }

  const megabytes = kilobytes / 1024;
  return `${megabytes.toFixed(megabytes >= 100 ? 0 : 1)} MB`;
}

export function sanitizeUploadFileName(fileName: string): string {
  const normalizedFileName = fileName.trim().replace(/\s+/g, "-");
  const sanitized = normalizedFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return sanitized.slice(0, 160) || "upload.bin";
}

export function matchesAcceptedFileType(
  file: Pick<FileLike, "name" | "type">,
  allowedMimeTypes: string[],
): boolean {
  if (allowedMimeTypes.length === 0) {
    return true;
  }

  const fileName = getFileNameFromUnknown(file).toLowerCase();
  const mimeType = (file.type || "").toLowerCase();

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

export function getFileUploadAcceptAttribute(
  allowedMimeTypes: string[],
): string | undefined {
  return allowedMimeTypes.length > 0 ? allowedMimeTypes.join(",") : undefined;
}

export function buildFormTempUploadPath(
  embedKey: string,
  sessionId: string,
  fieldId: string,
  uploadId: string,
  fileName: string,
): string {
  return [
    "temp",
    embedKey,
    sessionId,
    fieldId,
    `${uploadId}-${sanitizeUploadFileName(fileName)}`,
  ].join("/");
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

export function getFileUploadDisplayValue(
  references: FormFileUploadReference[],
): string {
  if (references.length === 0) {
    return "No files";
  }

  if (references.length === 1) {
    const [reference] = references;
    return `${reference.file_name} (${formatFileSize(reference.file_size)})`;
  }

  return `${references.length} files`;
}

export function simulateFormFileUpload(params: {
  fieldId: string;
  file: File;
  sessionId: string;
  onProgress?: (progress: number) => void;
}): FormUploadRequest {
  const uploadId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  let canceled = false;
  let intervalId: ReturnType<typeof setInterval> | null = null;

  const promise = new Promise<FormFileUploadReference>((resolve, reject) => {
    let progress = 0;
    params.onProgress?.(0);

    intervalId = setInterval(() => {
      if (canceled) {
        if (intervalId) {
          clearInterval(intervalId);
        }
        reject(new Error("Upload canceled"));
        return;
      }

      progress = Math.min(100, progress + 20);
      params.onProgress?.(progress);

      if (progress < 100) {
        return;
      }

      if (intervalId) {
        clearInterval(intervalId);
      }

      resolve({
        upload_id: uploadId,
        field_id: params.fieldId,
        session_id: params.sessionId,
        bucket: FORM_UPLOAD_BUCKET,
        path: buildFormTempUploadPath(
          "preview",
          params.sessionId,
          params.fieldId,
          uploadId,
          params.file.name,
        ),
        file_name: params.file.name,
        file_size: params.file.size,
        mime_type: params.file.type || "application/octet-stream",
        uploaded_at: startedAt,
      });
    }, 140);
  });

  return {
    uploadId,
    cancel: () => {
      canceled = true;
      if (intervalId) {
        clearInterval(intervalId);
      }
    },
    promise,
  };
}

export function uploadFileToFormStorage(params: {
  embedKey: string;
  fieldId: string;
  file: File;
  sessionId: string;
  onProgress?: (progress: number) => void;
  publishableKey?: string;
  supabaseUrl?: string;
}): FormUploadRequest {
  const uploadId = crypto.randomUUID();
  const path = buildFormTempUploadPath(
    params.embedKey,
    params.sessionId,
    params.fieldId,
    uploadId,
    params.file.name,
  );
  const xhr = new XMLHttpRequest();
  const requestUrl = `${params.supabaseUrl || DEFAULT_SUPABASE_URL}/storage/v1/object/${FORM_UPLOAD_BUCKET}/${encodeStoragePath(path)}`;
  const publishableKey =
    params.publishableKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;
  const startedAt = new Date().toISOString();

  const promise = new Promise<FormFileUploadReference>((resolve, reject) => {
    xhr.open("POST", requestUrl);
    xhr.setRequestHeader("apikey", publishableKey);
    xhr.setRequestHeader("Authorization", `Bearer ${publishableKey}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader(
      "content-type",
      params.file.type || "application/octet-stream",
    );

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        return;
      }

      const progress = Math.max(
        0,
        Math.min(100, Math.round((event.loaded / event.total) * 100)),
      );
      params.onProgress?.(progress);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        params.onProgress?.(100);
        resolve({
          upload_id: uploadId,
          field_id: params.fieldId,
          session_id: params.sessionId,
          bucket: FORM_UPLOAD_BUCKET,
          path,
          file_name: params.file.name,
          file_size: params.file.size,
          mime_type: params.file.type || "application/octet-stream",
          uploaded_at: startedAt,
        });
        return;
      }

      try {
        const payload = JSON.parse(xhr.responseText) as { error?: string };
        reject(new Error(payload.error || "Upload failed"));
      } catch {
        reject(new Error("Upload failed"));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed"));
    };

    xhr.onabort = () => {
      reject(new Error("Upload canceled"));
    };

    xhr.send(params.file);
  });

  return {
    uploadId,
    cancel: () => xhr.abort(),
    promise,
  };
}
