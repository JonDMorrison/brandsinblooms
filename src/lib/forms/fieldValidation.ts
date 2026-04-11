import { FormField } from "@/types/formBuilder";
import {
  getFileFieldAllowedMimeTypes,
  getFileFieldMaxFiles,
  getFileFieldMaxFileSizeBytes,
  getFormFileUploadReferences,
  matchesAcceptedFileType,
} from "@/lib/forms/fileUploads";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_ALLOWED_REGEX = /^[\d\s\-+()]+$/;

function isBooleanField(field: FormField): boolean {
  return (
    field.type === "checkbox" ||
    field.type === "email_consent" ||
    field.type === "sms_consent"
  );
}

function isFileField(field: FormField): boolean {
  return field.type === "file";
}

export function getFieldTextValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

export function getFieldCharacterCount(value: unknown): number {
  return getFieldTextValue(value).length;
}

export function getFieldDefaultValue(
  field: FormField,
): string | boolean | ReturnType<typeof getFormFileUploadReferences> {
  if (isBooleanField(field)) {
    return typeof field.default_value === "boolean"
      ? field.default_value
      : false;
  }

  if (isFileField(field)) {
    return [];
  }

  return typeof field.default_value === "string" ? field.default_value : "";
}

export function getResolvedFieldValue(
  field: FormField,
  value: unknown,
): string | boolean | ReturnType<typeof getFormFileUploadReferences> {
  if (value !== undefined) {
    if (isBooleanField(field)) {
      return value === true;
    }

    if (isFileField(field)) {
      return getFormFileUploadReferences(value);
    }

    return getFieldTextValue(value);
  }

  return getFieldDefaultValue(field);
}

export function getFieldMaxLength(field: FormField): number | undefined {
  return field.rules?.max_length && field.rules.max_length > 0
    ? field.rules.max_length
    : undefined;
}

export function isPatternSyntaxValid(pattern?: string): boolean {
  if (!pattern) {
    return true;
  }

  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export interface ValidateFieldValueOptions {
  validateRequired?: boolean;
}

export function validateFieldValue(
  field: FormField,
  rawValue: unknown,
  options: ValidateFieldValueOptions = {},
): string | null {
  const validateRequired = options.validateRequired ?? true;
  const value = getResolvedFieldValue(field, rawValue);

  if (isFileField(field)) {
    const fileReferences = Array.isArray(value)
      ? getFormFileUploadReferences(value)
      : [];

    if (validateRequired && field.required && fileReferences.length === 0) {
      return "Please upload at least one file";
    }

    if (fileReferences.length === 0) {
      return null;
    }

    const maxFiles = getFileFieldMaxFiles(field);
    if (fileReferences.length > maxFiles) {
      return `You can upload up to ${maxFiles} file${maxFiles === 1 ? "" : "s"}`;
    }

    const maxFileSizeBytes = getFileFieldMaxFileSizeBytes(field);
    const allowedMimeTypes = getFileFieldAllowedMimeTypes(field);

    for (const fileReference of fileReferences) {
      if (fileReference.file_size > maxFileSizeBytes) {
        return `${fileReference.file_name} exceeds the file size limit`;
      }

      if (
        !matchesAcceptedFileType(
          {
            name: fileReference.file_name,
            type: fileReference.mime_type,
          },
          allowedMimeTypes,
        )
      ) {
        return `${fileReference.file_name} is not an allowed file type`;
      }
    }

    return null;
  }

  if (isBooleanField(field)) {
    if (validateRequired && field.required && value !== true) {
      return "This field is required";
    }

    return null;
  }

  const textValue = getFieldTextValue(value);
  const trimmedValue = textValue.trim();

  if (validateRequired && field.required && !trimmedValue) {
    return "This field is required";
  }

  if (!trimmedValue) {
    return null;
  }

  if (field.type === "email" && !EMAIL_REGEX.test(trimmedValue)) {
    return "Please enter a valid email";
  }

  if (field.type === "phone") {
    if (!PHONE_ALLOWED_REGEX.test(trimmedValue)) {
      return "Please enter a valid phone number";
    }

    const digits = trimmedValue.replace(/\D/g, "");
    if (digits.length < 10) {
      return "Please enter a valid phone number";
    }
  }

  const minLength = field.rules?.min_length;
  if (
    typeof minLength === "number" &&
    minLength > 0 &&
    textValue.length < minLength
  ) {
    return `Please enter at least ${minLength} characters`;
  }

  const maxLength = getFieldMaxLength(field);
  if (typeof maxLength === "number" && textValue.length > maxLength) {
    return `Please keep this answer under ${maxLength} characters`;
  }

  const pattern = field.rules?.pattern;
  if (pattern) {
    try {
      const regex = new RegExp(pattern);
      if (!regex.test(textValue)) {
        return (
          field.rules?.pattern_message?.trim() ||
          "Please match the expected format"
        );
      }
    } catch {
      return null;
    }
  }

  return null;
}
