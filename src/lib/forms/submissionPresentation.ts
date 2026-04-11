import {
  Form,
  FormField,
  FormSubmission,
  FormSubmissionMetadata,
  SubmissionResult,
} from "@/types/formBuilder";
import {
  getFileUploadDisplayValue,
  getFormFileUploadReferences,
  isFileField,
} from "@/lib/forms/fileUploads";

export interface SubmissionPresentationColumn {
  id: string;
  key: string;
  label: string;
  kind: "field" | "extra";
  field?: FormField;
}

export interface SubmissionPresentationEntry {
  id: string;
  key: string;
  label: string;
  rawValue: unknown;
  displayValue: string;
  kind: "field" | "file" | "extra" | "hidden" | "internal";
  field?: FormField;
}

interface SearchFilters {
  dateFrom?: string | null;
  dateTo?: string | null;
  hideTestSubmissions?: boolean;
  resultFilter?: "all" | SubmissionResult | null;
  searchQuery?: string;
}

const INTERNAL_SUBMISSION_KEYS = new Set([
  "_blank",
  "_honeypot",
  "_hp",
  "hp_field",
  "honeypot",
  "website",
  "url",
]);

const EMAIL_KEYS = ["email", "Email"];
const PRIMARY_NAME_KEYS = ["full_name", "fullName", "name", "Name"];
const FIRST_NAME_KEYS = ["first_name", "firstName", "first name", "First Name"];
const LAST_NAME_KEYS = ["last_name", "lastName", "last name", "Last Name"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getSubmissionData(
  submission: Pick<FormSubmission, "data">,
): Record<string, unknown> {
  return isRecord(submission.data) ? submission.data : {};
}

function getSubmissionMetadata(
  submission: Pick<FormSubmission, "metadata">,
): Partial<FormSubmissionMetadata> {
  return isRecord(submission.metadata)
    ? (submission.metadata as Partial<FormSubmissionMetadata>)
    : {};
}

function normalizeStringValue(value: unknown): string | null {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }

  return null;
}

function normalizeStringWithKeys(
  source: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      continue;
    }

    const normalized = normalizeStringValue(source[key]);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function formatSubmissionValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (isFileFieldValue(value)) {
    return value.file_name;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || "—";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "—";
    }

    const fileReferences = getFormFileUploadReferences(value);
    if (fileReferences.length === value.length) {
      return fileReferences.map((item) => item.file_name).join(", ");
    }

    return value.map((item) => formatSubmissionValue(item)).join(", ");
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function hasMeaningfulValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
}

export function isInternalSubmissionKey(key: string): boolean {
  return key.startsWith("_") || INTERNAL_SUBMISSION_KEYS.has(key);
}

function isConsentField(field: FormField): boolean {
  return field.type === "email_consent" || field.type === "sms_consent";
}

function getFieldLookupKeys(field: FormField): string[] {
  const keys = [
    field.mapping_key,
    field.id,
    (field as FormField & { field_key?: string }).field_key,
  ].filter((key): key is string => Boolean(key));

  return Array.from(new Set(keys));
}

function findValueForField(
  field: FormField,
  data: Record<string, unknown>,
): { key: string | null; value: unknown } {
  for (const key of getFieldLookupKeys(field)) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return { key, value: data[key] };
    }
  }

  return { key: null, value: undefined };
}

function createEntry(
  kind: SubmissionPresentationEntry["kind"],
  key: string,
  label: string,
  rawValue: unknown,
  field?: FormField,
  displayValue?: string,
): SubmissionPresentationEntry {
  return {
    id: field ? field.id : `${kind}:${key}`,
    key,
    label,
    rawValue,
    displayValue: displayValue || formatSubmissionValue(rawValue),
    kind,
    field,
  };
}

function isFileFieldValue(
  value: unknown,
): value is ReturnType<typeof getFormFileUploadReferences>[number] {
  return getFormFileUploadReferences([value]).length === 1;
}

function titleizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getHiddenKeys(form: Pick<Form, "fields_json">): Set<string> {
  return new Set(
    form.fields_json
      .filter((field) => field.type === "hidden")
      .flatMap((field) => getFieldLookupKeys(field)),
  );
}

function getConsentKeys(form: Pick<Form, "fields_json">): Set<string> {
  return new Set(
    form.fields_json
      .filter((field) => isConsentField(field))
      .flatMap((field) => getFieldLookupKeys(field)),
  );
}

export function getSubmissionDisplayEmail(
  submission: Pick<FormSubmission, "data">,
): string {
  const data = getSubmissionData(submission);
  return normalizeStringWithKeys(data, EMAIL_KEYS) || "—";
}

export function getSubmissionDisplayName(
  submission: Pick<FormSubmission, "data">,
): string | null {
  const data = getSubmissionData(submission);
  const explicitName = normalizeStringWithKeys(data, PRIMARY_NAME_KEYS);
  if (explicitName) {
    return explicitName;
  }

  const firstName = normalizeStringWithKeys(data, FIRST_NAME_KEYS);
  const lastName = normalizeStringWithKeys(data, LAST_NAME_KEYS);

  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ");
  }

  return null;
}

function formatUrlDisplay(urlValue: string): string {
  try {
    const url = new URL(urlValue);
    const pathname = url.pathname !== "/" ? url.pathname : "";
    return `${url.hostname}${pathname}`;
  } catch {
    return urlValue;
  }
}

export function getSubmissionDisplaySource(
  submission: Pick<FormSubmission, "metadata">,
): string {
  const metadata = getSubmissionMetadata(submission);

  const utmSource = normalizeStringValue(metadata.utm_source);
  if (utmSource) {
    return utmSource;
  }

  const referrer = normalizeStringValue(metadata.referrer);
  if (referrer) {
    return formatUrlDisplay(referrer);
  }

  const pageUrl = normalizeStringValue(metadata.page_url);
  if (pageUrl) {
    return formatUrlDisplay(pageUrl);
  }

  return "Direct";
}

export function isTestSubmission(
  submission: Pick<FormSubmission, "metadata">,
): boolean {
  const metadata = getSubmissionMetadata(submission);
  return metadata.is_test === true;
}

export function getSubmissionVisibleEntries(
  form: Pick<Form, "fields_json">,
  submission: Pick<FormSubmission, "data">,
): SubmissionPresentationEntry[] {
  const data = getSubmissionData(submission);
  const hiddenKeys = getHiddenKeys(form);
  const consentKeys = getConsentKeys(form);
  const coveredKeys = new Set<string>();

  const fieldEntries = form.fields_json
    .filter((field) => field.type !== "hidden" && !isConsentField(field))
    .map((field) => {
      const matched = findValueForField(field, data);
      if (!matched.key || !hasMeaningfulValue(matched.value)) {
        return null;
      }

      coveredKeys.add(matched.key);

      if (isFileField(field)) {
        const fileReferences = getFormFileUploadReferences(matched.value);
        if (fileReferences.length === 0) {
          return null;
        }

        return createEntry(
          "file",
          matched.key,
          field.label,
          fileReferences,
          field,
          getFileUploadDisplayValue(fileReferences),
        );
      }

      return createEntry(
        "field",
        matched.key,
        field.label,
        matched.value,
        field,
      );
    })
    .filter((entry): entry is SubmissionPresentationEntry => entry !== null);

  const extraEntries = Object.entries(data)
    .filter(([key, value]) => {
      if (coveredKeys.has(key)) {
        return false;
      }

      if (
        hiddenKeys.has(key) ||
        consentKeys.has(key) ||
        isInternalSubmissionKey(key)
      ) {
        return false;
      }

      return hasMeaningfulValue(value);
    })
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => createEntry("extra", key, titleizeKey(key), value));

  return [...fieldEntries, ...extraEntries];
}

export function getSubmissionDiagnosticEntries(
  form: Pick<Form, "fields_json">,
  submission: Pick<FormSubmission, "data">,
): SubmissionPresentationEntry[] {
  const data = getSubmissionData(submission);
  const hiddenEntries = form.fields_json
    .filter((field) => field.type === "hidden")
    .map((field) => {
      const matched = findValueForField(field, data);
      if (!matched.key || !hasMeaningfulValue(matched.value)) {
        return null;
      }

      return createEntry(
        "hidden",
        matched.key,
        field.label,
        matched.value,
        field,
      );
    })
    .filter((entry): entry is SubmissionPresentationEntry => entry !== null);

  const internalEntries = Object.entries(data)
    .filter(
      ([key, value]) =>
        isInternalSubmissionKey(key) && hasMeaningfulValue(value),
    )
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) =>
      createEntry("internal", key, titleizeKey(key), value),
    );

  return [...hiddenEntries, ...internalEntries];
}

function dedupeLabels(
  columns: SubmissionPresentationColumn[],
): SubmissionPresentationColumn[] {
  const labelCounts = new Map<string, number>();

  return columns.map((column) => {
    const currentCount = labelCounts.get(column.label) || 0;
    labelCounts.set(column.label, currentCount + 1);

    if (currentCount === 0) {
      return column;
    }

    return {
      ...column,
      label: `${column.label} (${column.key})`,
    };
  });
}

export function getSubmissionExportColumns(
  form: Pick<Form, "fields_json">,
  submissions: Array<Pick<FormSubmission, "data">>,
): SubmissionPresentationColumn[] {
  const hiddenKeys = getHiddenKeys(form);
  const consentKeys = getConsentKeys(form);
  const fieldColumns = form.fields_json
    .filter((field) => field.type !== "hidden" && !isConsentField(field))
    .map<SubmissionPresentationColumn>((field) => ({
      id: field.id,
      key: getFieldLookupKeys(field)[0] || field.id,
      label: field.label,
      kind: "field",
      field,
    }));

  const coveredKeys = new Set(
    fieldColumns.flatMap((column) =>
      column.field ? getFieldLookupKeys(column.field) : [column.key],
    ),
  );
  const extraKeys = new Set<string>();

  submissions.forEach((submission) => {
    Object.entries(getSubmissionData(submission)).forEach(([key, value]) => {
      if (coveredKeys.has(key) || hiddenKeys.has(key) || consentKeys.has(key)) {
        return;
      }

      if (isInternalSubmissionKey(key) || !hasMeaningfulValue(value)) {
        return;
      }

      extraKeys.add(key);
    });
  });

  const extraColumns = Array.from(extraKeys)
    .sort((leftKey, rightKey) => leftKey.localeCompare(rightKey))
    .map<SubmissionPresentationColumn>((key) => ({
      id: `extra:${key}`,
      key,
      label: titleizeKey(key),
      kind: "extra",
    }));

  return dedupeLabels([...fieldColumns, ...extraColumns]);
}

export function getSubmissionColumnValue(
  submission: Pick<FormSubmission, "data">,
  column: SubmissionPresentationColumn,
): string {
  const data = getSubmissionData(submission);

  if (column.field) {
    const matched = findValueForField(column.field, data);
    return formatSubmissionValue(matched.value);
  }

  return formatSubmissionValue(data[column.key]);
}

export function getSubmissionSearchableText(
  submission: Pick<FormSubmission, "data">,
): string {
  const data = getSubmissionData(submission);

  return Object.entries(data)
    .filter(
      ([key, value]) =>
        !isInternalSubmissionKey(key) && hasMeaningfulValue(value),
    )
    .map(([, value]) => formatSubmissionValue(value).toLowerCase())
    .join(" ");
}

export function submissionMatchesFilters(
  submission: Pick<
    FormSubmission,
    "data" | "metadata" | "result" | "submitted_at"
  >,
  filters: SearchFilters,
): boolean {
  if (filters.hideTestSubmissions && isTestSubmission(submission)) {
    return false;
  }

  if (filters.resultFilter && filters.resultFilter !== "all") {
    if (submission.result !== filters.resultFilter) {
      return false;
    }
  }

  const submittedAt = new Date(submission.submitted_at).getTime();
  if (filters.dateFrom) {
    const dateFrom = new Date(filters.dateFrom).getTime();
    if (submittedAt < dateFrom) {
      return false;
    }
  }

  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo).getTime();
    if (submittedAt > dateTo) {
      return false;
    }
  }

  const searchQuery = filters.searchQuery?.trim().toLowerCase();
  if (searchQuery) {
    return getSubmissionSearchableText(submission).includes(searchQuery);
  }

  return true;
}
