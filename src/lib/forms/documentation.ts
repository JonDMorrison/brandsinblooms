import {
  getFieldDefinition,
  isConsentFieldType,
} from "@/lib/forms/fieldRegistry";
import {
  getNormalizedFormSteps,
  groupFieldsByStep,
  isMultiStepEnabled,
} from "@/lib/forms/formFlow";
import {
  buildIframeEmbedCode,
  buildJavaScriptEmbedCode,
  buildReactEmbedCode,
  getPublicFormSubmissionEndpoint,
  getPublicFormUrl,
  getStaticEmbedScriptUrl,
} from "@/lib/forms/share";
import { Form, FormField } from "@/types/formBuilder";

export const FORM_DOCUMENTATION_CANONICAL_PREFIX = "/dashboard/forms";
export const FORM_DOCUMENTATION_ALIAS_PREFIX = "/crm/forms";

const FILE_UPLOAD_REFERENCE_TYPE_NAME = "BloomSuiteFileUploadReference";

type PreferredKeySource = "mapping_key" | "field_id";

export interface FormDocumentationFieldReference {
  fieldId: string;
  label: string;
  fieldType: FormField["type"];
  typeLabel: string;
  description: string;
  required: boolean;
  stepIndex: number;
  stepTitle: string;
  mappingKey: string;
  submissionKey: string;
  preferredKeySource: PreferredKeySource;
  options: string[];
  exampleValue: unknown;
  directApiSafe: boolean;
  note: string | null;
}

export interface FormDocumentationStepReference {
  id: string;
  index: number;
  title: string;
  description: string;
  fields: FormDocumentationFieldReference[];
}

export interface FormDocumentationModel {
  canonicalPath: string;
  aliasPath: string;
  publicFormUrl: string;
  submitEndpoint: string;
  runtimeUrl: string;
  fieldCount: number;
  stepCount: number;
  isEmpty: boolean;
  multiStep: boolean;
  hasFileUploads: boolean;
  requiresEmailConsent: boolean;
  requiresSmsConsent: boolean;
  fieldReferences: FormDocumentationFieldReference[];
  stepReferences: FormDocumentationStepReference[];
  requestExample: string;
  successResponseExample: string;
  validationErrorExample: string;
  notFoundErrorExample: string;
  rateLimitErrorExample: string;
  typescriptSchemaSnippet: string;
  curlSnippet: string;
  fetchSnippet: string;
  nextJsSnippet: string;
  inlineEmbedSnippet: string;
  modalEmbedSnippet: string;
  iframeEmbedSnippet: string;
  reactEmbedSnippet: string;
  eventPayloadSnippet: string;
  markdownGuide: string;
}

export type MinimalForm = Pick<
  Form,
  | "id"
  | "tenant_id"
  | "name"
  | "status"
  | "embed_key"
  | "fields_json"
  | "settings_json"
  | "compliance_json"
>;

interface ExampleEntry {
  field: FormDocumentationFieldReference;
  includeInStarterPayload: boolean;
}

export function getCanonicalFormDocumentationPath(formId: string): string {
  return `${FORM_DOCUMENTATION_CANONICAL_PREFIX}/${formId}/docs`;
}

export function getAliasFormDocumentationPath(formId: string): string {
  return `${FORM_DOCUMENTATION_ALIAS_PREFIX}/${formId}/docs`;
}

export function getCanonicalFormDocumentationUrl(
  formId: string,
  origin: string = window.location.origin,
): string {
  return `${origin}${getCanonicalFormDocumentationPath(formId)}`;
}

export function buildFormDocumentationModel(
  form: MinimalForm,
): FormDocumentationModel {
  const mappingKeyCounts = getMappingKeyCounts(form.fields_json);
  const steps = getNormalizedFormSteps(form.fields_json, form.settings_json);
  const stepGroups = groupFieldsByStep(form.fields_json, steps);
  const stepReferences = stepGroups.map((group) => ({
    id: `step-${group.step.index}`,
    index: group.step.index,
    title: group.step.title,
    description: group.step.description,
    fields: group.fields.map((field) =>
      createFieldReference(
        field,
        form.fields_json,
        mappingKeyCounts,
        group.step.title,
      ),
    ),
  }));
  const fieldReferences = stepReferences.flatMap((step) => step.fields);
  const exampleEntries = fieldReferences.map((field) => ({
    field,
    includeInStarterPayload: field.directApiSafe,
  }));
  const starterPayloadData = buildStarterPayloadData(exampleEntries);
  const requestPayload = {
    ...starterPayloadData,
    ...buildSubmissionMetaExample(form),
  };
  const requestExample = toJson(requestPayload);
  const submitEndpoint = getPublicFormSubmissionEndpoint(form.id);
  const publicFormUrl = getPublicFormUrl(form.embed_key);
  const runtimeUrl = getStaticEmbedScriptUrl();
  const inlineEmbedSnippet = buildJavaScriptEmbedCode({
    embedKey: form.embed_key,
    formName: form.name,
    displayMode: "inline",
  });
  const modalEmbedSnippet = buildJavaScriptEmbedCode({
    embedKey: form.embed_key,
    formName: form.name,
    displayMode: "modal",
    buttonText: form.settings_json.submit_button_text || "Open Form",
  });
  const iframeEmbedSnippet = buildIframeEmbedCode({
    embedKey: form.embed_key,
  });
  const reactEmbedSnippet = buildReactEmbedCode({
    embedKey: form.embed_key,
    formName: form.name,
    displayMode: "inline",
  });

  const typescriptSchemaSnippet = buildTypeScriptSchemaSnippet(
    form.name,
    fieldReferences,
  );
  const curlSnippet = buildCurlSnippet(submitEndpoint, requestPayload);
  const fetchSnippet = buildFetchSnippet(submitEndpoint, requestPayload);
  const nextJsSnippet = buildNextJsSnippet(submitEndpoint, requestPayload);
  const validationFields = fieldReferences
    .filter((field) => field.required && field.directApiSafe)
    .slice(0, 2);
  const validationDetails = validationFields.map(
    (field) => `${field.label} is required`,
  );
  const validationErrors = validationFields.reduce<Record<string, string>>(
    (accumulator, field, index) => {
      accumulator[field.submissionKey] = validationDetails[index];
      return accumulator;
    },
    {},
  );
  const successResponseExample = toJson({
    success: true,
    message:
      form.settings_json.success_message || "Thank you for your submission!",
    redirectUrl: form.settings_json.success_redirect_url || null,
    customerId: "customer_uuid",
    suppressed: false,
  });
  const validationErrorExample = toJson({
    success: false,
    error: "Validation failed",
    details: validationDetails,
    errors: validationErrors,
  });
  const notFoundErrorExample = toJson({
    success: false,
    error: "Form not found",
  });
  const rateLimitErrorExample = toJson({
    success: false,
    error: "Too many submissions from this visitor. Please wait and try again.",
    retryAfter: 60,
  });
  const eventPayloadSnippet = buildEventPayloadSnippet(form, fieldReferences);
  const markdownGuide = buildMarkdownGuide({
    form,
    canonicalPath: getCanonicalFormDocumentationPath(form.id),
    publicFormUrl,
    submitEndpoint,
    runtimeUrl,
    fieldReferences,
    requestExample,
    typescriptSchemaSnippet,
    curlSnippet,
    fetchSnippet,
    nextJsSnippet,
    inlineEmbedSnippet,
    modalEmbedSnippet,
    iframeEmbedSnippet,
    reactEmbedSnippet,
    successResponseExample,
    validationErrorExample,
    notFoundErrorExample,
    rateLimitErrorExample,
    eventPayloadSnippet,
  });

  return {
    canonicalPath: getCanonicalFormDocumentationPath(form.id),
    aliasPath: getAliasFormDocumentationPath(form.id),
    publicFormUrl,
    submitEndpoint,
    runtimeUrl,
    fieldCount: fieldReferences.length,
    stepCount: stepReferences.length,
    isEmpty: fieldReferences.length === 0,
    multiStep: isMultiStepEnabled(form.settings_json),
    hasFileUploads: fieldReferences.some((field) => field.fieldType === "file"),
    requiresEmailConsent: Boolean(form.compliance_json.email_consent_required),
    requiresSmsConsent: Boolean(form.compliance_json.sms_consent_required),
    fieldReferences,
    stepReferences,
    requestExample,
    successResponseExample,
    validationErrorExample,
    notFoundErrorExample,
    rateLimitErrorExample,
    typescriptSchemaSnippet,
    curlSnippet,
    fetchSnippet,
    nextJsSnippet,
    inlineEmbedSnippet,
    modalEmbedSnippet,
    iframeEmbedSnippet,
    reactEmbedSnippet,
    eventPayloadSnippet,
    markdownGuide,
  };
}

export function getPreferredFieldSubmissionKey(
  field: FormField,
  fields: FormField[],
): string {
  return getPreferredFieldSubmissionKeyFromCounts(
    field,
    getMappingKeyCounts(fields),
  );
}

function createFieldReference(
  field: FormField,
  allFields: FormField[],
  mappingKeyCounts: Map<string, number>,
  stepTitle: string,
): FormDocumentationFieldReference {
  const definition = getFieldDefinition(field.type);
  const submissionKey = getPreferredFieldSubmissionKeyFromCounts(
    field,
    mappingKeyCounts,
  );
  const preferredKeySource = getPreferredKeySource(field, mappingKeyCounts);

  return {
    fieldId: field.id,
    label: field.label,
    fieldType: field.type,
    typeLabel: definition.label,
    description: definition.description,
    required: Boolean(field.required),
    stepIndex: field.step_index ?? 0,
    stepTitle,
    mappingKey: field.mapping_key,
    submissionKey,
    preferredKeySource,
    options: [...(field.options ?? [])],
    exampleValue: buildExampleValue(field, allFields, submissionKey),
    directApiSafe: field.type !== "file",
    note: buildFieldNote(
      field,
      submissionKey,
      preferredKeySource,
      mappingKeyCounts,
    ),
  };
}

function buildStarterPayloadData(
  entries: ExampleEntry[],
): Record<string, unknown> {
  return entries.reduce<Record<string, unknown>>((accumulator, entry) => {
    if (!entry.includeInStarterPayload) {
      return accumulator;
    }

    accumulator[entry.field.submissionKey] = entry.field.exampleValue;
    return accumulator;
  }, {});
}

function buildSubmissionMetaExample(form: MinimalForm): Record<string, string> {
  return {
    page_url: `https://example.com/forms/${slugify(form.name) || "custom-form"}`,
    referrer: "https://example.com",
    source: "custom-site",
  };
}

function buildCurlSnippet(
  submitEndpoint: string,
  requestPayload: Record<string, unknown>,
): string {
  return `curl -X POST "${submitEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '${toJson(requestPayload)}'`;
}

function buildFetchSnippet(
  submitEndpoint: string,
  requestPayload: Record<string, unknown>,
): string {
  return `const SUBMIT_ENDPOINT = "${submitEndpoint}";

const payload = ${toJson(requestPayload)};

const response = await fetch(SUBMIT_ENDPOINT, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(payload),
});

const result = await response.json();

if (!response.ok) {
  console.error("BloomSuite rejected the submission", result);
  throw new Error(result.error || "Submission failed");
}

if (result.redirectUrl) {
  window.location.assign(result.redirectUrl);
} else {
  console.log(result.message);
}`;
}

function buildNextJsSnippet(
  submitEndpoint: string,
  requestPayload: Record<string, unknown>,
): string {
  const basePayload = toJson(requestPayload);

  return `// app/api/bloomsuite/forms/route.ts
import { NextResponse } from "next/server";

const SUBMIT_ENDPOINT = "${submitEndpoint}";
const BASE_PAYLOAD = ${basePayload};

export async function POST(request: Request) {
  const body = await request.json();
  const { page_url, referrer, source, ...data } = body;

  const outboundPayload = {
    ...BASE_PAYLOAD,
    ...data,
    page_url: page_url ?? BASE_PAYLOAD.page_url,
    referrer: referrer ?? BASE_PAYLOAD.referrer,
    source: source ?? BASE_PAYLOAD.source ?? "nextjs-server-route",
  };

  const response = await fetch(SUBMIT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(outboundPayload),
  });

  const result = await response.json();
  return NextResponse.json(result, { status: response.status });
}`;
}

function buildTypeScriptSchemaSnippet(
  formName: string,
  fieldReferences: FormDocumentationFieldReference[],
): string {
  const typeName = `${toPascalCase(formName) || "BloomSuiteForm"}SubmissionData`;
  const includesFileReferences = fieldReferences.some(
    (field) => field.fieldType === "file",
  );
  const lines: string[] = [];

  if (includesFileReferences) {
    lines.push(`type ${FILE_UPLOAD_REFERENCE_TYPE_NAME} = {`);
    lines.push(`  upload_id: string;`);
    lines.push(`  field_id: string;`);
    lines.push(`  bucket: string;`);
    lines.push(`  path: string;`);
    lines.push(`  file_name: string;`);
    lines.push(`  file_size: number;`);
    lines.push(`  mime_type: string;`);
    lines.push(`  uploaded_at: string;`);
    lines.push(`};`);
    lines.push("");
  }

  lines.push(`interface ${typeName} {`);
  if (fieldReferences.length === 0) {
    lines.push(
      `  // Add form fields in the builder to replace this placeholder.`,
    );
  }
  fieldReferences.forEach((field) => {
    const optionalSuffix = field.required ? "" : "?";
    lines.push(
      `  ${JSON.stringify(field.submissionKey)}${optionalSuffix}: ${getTypeScriptValueType(field)};`,
    );
  });
  lines.push(`}`);

  return lines.join("\n");
}

function buildEventPayloadSnippet(
  form: MinimalForm,
  fieldReferences: FormDocumentationFieldReference[],
): string {
  const emailConsentField = fieldReferences.find(
    (field) => field.fieldType === "email_consent",
  );
  const smsConsentField = fieldReferences.find(
    (field) => field.fieldType === "sms_consent",
  );

  return toJson({
    event_type: "form_submitted",
    form_id: form.id,
    submission_id: "submission_uuid",
    customer_id: "customer_uuid",
    tenant_id: form.tenant_id,
    timestamp: "2026-04-12T16:00:00.000Z",
    consent: {
      email_consent: emailConsentField
        ? Boolean(emailConsentField.exampleValue)
        : false,
      email_consent_text: form.compliance_json.email_consent_text || null,
      email_consent_at: emailConsentField ? "2026-04-12T16:00:00.000Z" : null,
      sms_consent: smsConsentField
        ? Boolean(smsConsentField.exampleValue)
        : false,
      sms_consent_text: form.compliance_json.sms_consent_text || null,
      sms_consent_at: smsConsentField ? "2026-04-12T16:00:00.000Z" : null,
    },
    referrer: "https://example.com",
    page_url: `https://example.com/forms/${slugify(form.name) || "custom-form"}`,
  });
}

function buildMarkdownGuide({
  form,
  canonicalPath,
  publicFormUrl,
  submitEndpoint,
  runtimeUrl,
  fieldReferences,
  requestExample,
  typescriptSchemaSnippet,
  curlSnippet,
  fetchSnippet,
  nextJsSnippet,
  inlineEmbedSnippet,
  modalEmbedSnippet,
  iframeEmbedSnippet,
  reactEmbedSnippet,
  successResponseExample,
  validationErrorExample,
  notFoundErrorExample,
  rateLimitErrorExample,
  eventPayloadSnippet,
}: {
  form: MinimalForm;
  canonicalPath: string;
  publicFormUrl: string;
  submitEndpoint: string;
  runtimeUrl: string;
  fieldReferences: FormDocumentationFieldReference[];
  requestExample: string;
  typescriptSchemaSnippet: string;
  curlSnippet: string;
  fetchSnippet: string;
  nextJsSnippet: string;
  inlineEmbedSnippet: string;
  modalEmbedSnippet: string;
  iframeEmbedSnippet: string;
  reactEmbedSnippet: string;
  successResponseExample: string;
  validationErrorExample: string;
  notFoundErrorExample: string;
  rateLimitErrorExample: string;
  eventPayloadSnippet: string;
}): string {
  const fieldLines = fieldReferences.map((field) => {
    const detailParts = [
      `${field.typeLabel}`,
      field.required ? "required" : "optional",
      `submit as ${field.submissionKey}`,
    ];
    if (field.note) {
      detailParts.push(field.note);
    }

    return `- ${field.label}: ${detailParts.join("; ")}`;
  });

  const fieldReferenceLines =
    fieldLines.length > 0
      ? fieldLines
      : [
          "- No submit fields are configured yet. The minimal examples below only include optional metadata keys until fields are added in the builder.",
        ];

  return [
    `# ${form.name} Developer Guide`,
    "",
    `- Form ID: ${form.id}`,
    `- Embed key: ${form.embed_key}`,
    `- Form status: ${form.status}`,
    `- Canonical docs route: ${canonicalPath}`,
    `- Public form URL: ${publicFormUrl}`,
    `- Primary submission endpoint: ${submitEndpoint}`,
    `- Embed runtime URL: ${runtimeUrl}`,
    "",
    "## Field Reference",
    ...fieldReferenceLines,
    "",
    "## TypeScript Payload Shape",
    "```ts",
    typescriptSchemaSnippet,
    "```",
    "",
    "## Request Example",
    "```json",
    requestExample,
    "```",
    "",
    "## cURL Example",
    "```bash",
    curlSnippet,
    "```",
    "",
    "## Fetch Example",
    "```ts",
    fetchSnippet,
    "```",
    "",
    "## Next.js Example",
    "```ts",
    nextJsSnippet,
    "```",
    "",
    "## Embed Runtime",
    "```html",
    inlineEmbedSnippet,
    "```",
    "",
    "```html",
    modalEmbedSnippet,
    "```",
    "",
    "```html",
    iframeEmbedSnippet,
    "```",
    "",
    "```tsx",
    reactEmbedSnippet,
    "```",
    "",
    "## Success Response",
    "```json",
    successResponseExample,
    "```",
    "",
    "## Validation Error Response",
    "```json",
    validationErrorExample,
    "```",
    "",
    "## Not Found Response",
    "```json",
    notFoundErrorExample,
    "```",
    "",
    "## Rate Limit Response",
    "```json",
    rateLimitErrorExample,
    "```",
    "",
    "## Downstream Event Payload",
    "```json",
    eventPayloadSnippet,
    "```",
  ].join("\n");
}

function getPreferredFieldSubmissionKeyFromCounts(
  field: FormField,
  mappingKeyCounts: Map<string, number>,
): string {
  const mappingKey = normalizeMappingKey(field.mapping_key);

  if (mappingKey && (mappingKeyCounts.get(mappingKey) ?? 0) === 1) {
    return mappingKey;
  }

  return field.id;
}

function getPreferredKeySource(
  field: FormField,
  mappingKeyCounts: Map<string, number>,
): PreferredKeySource {
  const mappingKey = normalizeMappingKey(field.mapping_key);

  return mappingKey && (mappingKeyCounts.get(mappingKey) ?? 0) === 1
    ? "mapping_key"
    : "field_id";
}

function buildFieldNote(
  field: FormField,
  submissionKey: string,
  preferredKeySource: PreferredKeySource,
  mappingKeyCounts: Map<string, number>,
): string | null {
  if (field.type === "file") {
    return "Starter API examples omit this field because direct submissions must send upload references, not raw files.";
  }

  if (field.mapping_key === "custom") {
    return preferredKeySource === "field_id"
      ? `This field is submission-only, so the docs use its field ID (${submissionKey}) instead of the generic custom mapping key.`
      : null;
  }

  const normalizedMappingKey = normalizeMappingKey(field.mapping_key);
  if (
    preferredKeySource === "field_id" &&
    normalizedMappingKey &&
    (mappingKeyCounts.get(normalizedMappingKey) ?? 0) > 1
  ) {
    return `This mapping key is duplicated elsewhere in the form, so the docs fall back to the stable field ID (${submissionKey}).`;
  }

  if (isConsentFieldType(field.type)) {
    return "The backend also accepts legacy fallback keys for consent, but these docs show the current field-aware contract.";
  }

  return null;
}

function buildExampleValue(
  field: FormField,
  allFields: FormField[],
  submissionKey: string,
): unknown {
  switch (field.type) {
    case "checkbox":
      return true;
    case "email_consent":
      return true;
    case "sms_consent":
      return allFields.some((candidate) => candidate.type === "phone");
    case "email":
      return "customer@example.com";
    case "phone":
      return "+1 555 123 4567";
    case "select":
      return field.options?.[0] || "Option 1";
    case "hidden":
      return getExampleStringValue(field, submissionKey, true);
    case "file":
      return [
        {
          upload_id: "upload_uuid",
          field_id: field.id,
          bucket: "form-uploads",
          path: `forms/${field.id}/example.pdf`,
          file_name: "example.pdf",
          file_size: 245670,
          mime_type: "application/pdf",
          uploaded_at: "2026-04-12T16:00:00.000Z",
        },
      ];
    case "text":
    default:
      return getExampleStringValue(field, submissionKey, false);
  }
}

function getExampleStringValue(
  field: FormField,
  submissionKey: string,
  hiddenField: boolean,
): string {
  const normalizedKey = submissionKey.toLowerCase();
  const normalizedLabel = field.label.toLowerCase();

  if (normalizedKey.includes("email") || normalizedLabel.includes("email")) {
    return "customer@example.com";
  }

  if (
    normalizedKey.includes("first_name") ||
    normalizedLabel.includes("first name")
  ) {
    return "Avery";
  }

  if (
    normalizedKey.includes("last_name") ||
    normalizedLabel.includes("last name")
  ) {
    return "Morrison";
  }

  if (normalizedKey === "name" || normalizedLabel === "name") {
    return "Avery Morrison";
  }

  if (
    normalizedKey.includes("phone") ||
    normalizedLabel.includes("phone") ||
    normalizedLabel.includes("mobile")
  ) {
    return "+1 555 123 4567";
  }

  if (
    normalizedKey.includes("company") ||
    normalizedLabel.includes("company") ||
    normalizedLabel.includes("business")
  ) {
    return "Bloom & Co.";
  }

  if (normalizedKey.includes("city") || normalizedLabel.includes("city")) {
    return "Toronto";
  }

  if (
    normalizedKey.includes("province") ||
    normalizedKey.includes("state") ||
    normalizedLabel.includes("province") ||
    normalizedLabel.includes("state")
  ) {
    return "Ontario";
  }

  if (
    normalizedKey.includes("postal") ||
    normalizedKey.includes("zip") ||
    normalizedLabel.includes("postal") ||
    normalizedLabel.includes("zip")
  ) {
    return "M5V 2T6";
  }

  if (normalizedKey.includes("url") || normalizedLabel.includes("website")) {
    return "https://example.com";
  }

  if (
    normalizedKey.includes("instagram") ||
    normalizedLabel.includes("instagram")
  ) {
    return "@bloomsuite";
  }

  if (normalizedKey.includes("date") || normalizedLabel.includes("date")) {
    return "2026-04-12";
  }

  if (hiddenField) {
    return field.default_value && typeof field.default_value === "string"
      ? field.default_value
      : "campaign-spring-launch";
  }

  return field.placeholder?.trim() || "Sample answer";
}

function getTypeScriptValueType(
  field: FormDocumentationFieldReference,
): string {
  switch (field.fieldType) {
    case "checkbox":
    case "email_consent":
    case "sms_consent":
      return "boolean";
    case "file":
      return `${FILE_UPLOAD_REFERENCE_TYPE_NAME}[]`;
    default:
      return "string";
  }
}

function getMappingKeyCounts(fields: FormField[]): Map<string, number> {
  return fields.reduce<Map<string, number>>((counts, field) => {
    const mappingKey = normalizeMappingKey(field.mapping_key);
    if (!mappingKey) {
      return counts;
    }

    counts.set(mappingKey, (counts.get(mappingKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

function normalizeMappingKey(mappingKey?: string): string | null {
  const trimmed = mappingKey?.trim();

  if (!trimmed || trimmed === "custom") {
    return null;
  }

  return trimmed;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function toPascalCase(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("")
    .replace(/^[^A-Z]+/, "BloomSuite");
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
