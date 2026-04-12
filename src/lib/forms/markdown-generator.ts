import { supabase } from "@/integrations/supabase/client";
import type { Form, FormField } from "@/types/formBuilder";

import {
  buildFormDocumentationModel,
  getCanonicalFormDocumentationPath,
  type FormDocumentationFieldReference,
  type MinimalForm,
} from "./documentation";
import {
  buildCurlSubmissionSnippet,
  buildNextJsSubmissionSnippet,
  buildReactSubmissionSnippet,
} from "./share";

const AI_MARKDOWN_META_KEYS = [
  "page_url",
  "referrer",
  "source",
  "user_agent",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

type AIGeneratorForm = MinimalForm;

export function buildFormMarkdownForAI(form: AIGeneratorForm): string {
  const model = buildFormDocumentationModel(form);
  const curlSnippet = buildCurlSubmissionSnippet({
    embedKey: form.embed_key,
    endpoint: model.submitEndpoint,
    formId: form.id,
    formName: form.name,
  });
  const reactSnippet = buildReactSubmissionSnippet({
    embedKey: form.embed_key,
    endpoint: model.submitEndpoint,
    formId: form.id,
    formName: form.name,
  });
  const nextJsSnippet = buildNextJsSubmissionSnippet({
    embedKey: form.embed_key,
    endpoint: model.submitEndpoint,
    formId: form.id,
    formName: form.name,
  });
  const zodSchemaSnippet = buildZodSchemaSnippet(form, model.fieldReferences);
  const implementationChecklist = buildImplementationChecklist(form, model);
  const fieldCatalog = buildFieldCatalog(
    form.fields_json,
    model.fieldReferences,
  );
  const compatibilityPayload = buildCompatibilityPayload(model.requestExample);

  return [
    `# ${form.name} Integration Spec for AI Coding Agents`,
    "",
    "> For AI Training & Integration Purposes",
    "",
    "## Integration Goal",
    `Implement a working integration for the BloomSuite form \`${form.name}\` using the public BloomSuite submit proxy. Use the exact field keys and response contract below. Do not invent additional required fields.`,
    "",
    "## Form Metadata",
    `- Form ID: ${form.id}`,
    `- Status: ${form.status}`,
    `- Public form URL: ${model.publicFormUrl}`,
    `- Primary submit endpoint: ${model.submitEndpoint}`,
    `- Canonical docs route: ${getCanonicalFormDocumentationPath(form.id)}`,
    `- Embed key: ${form.embed_key}`,
    "",
    "## Submission Contract",
    "- Primary request format: send a flat JSON body directly to the public BloomSuite endpoint for this form.",
    "- Do not send `embed_key` in the primary request body. The BloomSuite proxy resolves the correct embed key server-side from the form ID in the URL.",
    "- The proxy also accepts a compatibility wrapper body shaped like `{ data, meta }`, but new integrations should prefer the flat JSON body documented here.",
    "- The endpoint only accepts published forms.",
    "- If the response includes `redirectUrl`, redirect the browser to that URL after a successful submission.",
    "",
    "## Field Catalog",
    fieldCatalog,
    "",
    "## Zod Schema",
    "```ts",
    zodSchemaSnippet,
    "```",
    "",
    "## Primary Request Example",
    "```json",
    model.requestExample,
    "```",
    "",
    "## Compatibility Wrapper Example",
    "```json",
    compatibilityPayload,
    "```",
    "",
    "## Success Response",
    "```json",
    model.successResponseExample,
    "```",
    "",
    "## Validation Error Response",
    "```json",
    model.validationErrorExample,
    "```",
    "",
    "## Not Found Response",
    "```json",
    model.notFoundErrorExample,
    "```",
    "",
    "## Rate Limit Response",
    "```json",
    model.rateLimitErrorExample,
    "```",
    "",
    "## Quick Start Snippets",
    "### cURL",
    "```bash",
    curlSnippet,
    "```",
    "",
    "### React",
    "```tsx",
    reactSnippet,
    "```",
    "",
    "### Next.js",
    "```tsx",
    nextJsSnippet,
    "```",
    "",
    "## Embed Options",
    "### Inline Script Embed",
    "```html",
    model.inlineEmbedSnippet,
    "```",
    "",
    "### Modal Script Embed",
    "```html",
    model.modalEmbedSnippet,
    "```",
    "",
    "### React Embed Component",
    "```tsx",
    model.reactEmbedSnippet,
    "```",
    "",
    "### Iframe Embed",
    "```html",
    model.iframeEmbedSnippet,
    "```",
    "",
    "## Constraints And Edge Cases",
    implementationChecklist,
    "",
    "## Downstream Event Payload",
    "```json",
    model.eventPayloadSnippet,
    "```",
    "",
    "## Implementation Instructions",
    "1. Post JSON to the public BloomSuite submit endpoint shown above.",
    "2. Use the exact submission keys from the field catalog. If a field uses a field ID instead of a mapping key, do not rename it.",
    "3. Preserve optional metadata like `page_url`, `referrer`, and `source` when available.",
    "4. Handle `400`, `404`, and `429` responses explicitly in the client.",
    "5. If the form contains file fields, upload files separately and submit file upload references instead of raw multipart data.",
    "6. If the form is still draft, treat live submissions as unavailable until it is published.",
  ].join("\n");
}

export async function generateFormMarkdownForAI(
  formId: string,
): Promise<string> {
  const { data: authData } = await supabase.auth.getUser();
  const user = authData.user;

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: userRecord, error: userError } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (userError) {
    throw userError;
  }

  if (!userRecord?.tenant_id) {
    throw new Error("No tenant found");
  }

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select(
      "id, tenant_id, name, status, embed_key, fields_json, settings_json, compliance_json",
    )
    .eq("id", formId)
    .eq("tenant_id", userRecord.tenant_id)
    .single();

  if (formError) {
    throw formError;
  }

  return buildFormMarkdownForAI(form as unknown as AIGeneratorForm);
}

function buildCompatibilityPayload(primaryRequestExample: string): string {
  const parsed = JSON.parse(primaryRequestExample) as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};

  Object.entries(parsed).forEach(([key, value]) => {
    if ((AI_MARKDOWN_META_KEYS as readonly string[]).includes(key)) {
      meta[key] = value;
      return;
    }

    data[key] = value;
  });

  return JSON.stringify({ data, meta }, null, 2);
}

function buildFieldCatalog(
  fields: FormField[],
  fieldReferences: FormDocumentationFieldReference[],
): string {
  if (fieldReferences.length === 0) {
    return [
      "No submit fields are configured yet.",
      "Use the minimal payload example with optional metadata until the form builder adds concrete fields.",
    ].join("\n\n");
  }

  const fieldById = new Map(fields.map((field) => [field.id, field]));

  return fieldReferences
    .map((fieldReference) => {
      const field = fieldById.get(fieldReference.fieldId);
      const lines = [
        `### ${fieldReference.label}`,
        `- Submission key: \`${fieldReference.submissionKey}\``,
        `- Field type: \`${fieldReference.fieldType}\``,
        `- Required: ${fieldReference.required ? "yes" : "no"}`,
        `- Step: ${fieldReference.stepTitle}`,
        `- Preferred key source: \`${fieldReference.preferredKeySource}\``,
        `- Example value: \`${formatExampleValue(fieldReference.exampleValue)}\``,
      ];

      if (field?.placeholder) {
        lines.push(`- Placeholder: \`${field.placeholder}\``);
      }

      if (field?.options?.length) {
        lines.push(
          `- Allowed options: ${field.options.map((option) => `\`${option}\``).join(", ")}`,
        );
      }

      const rules = formatRules(field);
      if (rules) {
        lines.push(`- Validation rules: ${rules}`);
      }

      if (fieldReference.note) {
        lines.push(`- Notes: ${fieldReference.note}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function buildImplementationChecklist(
  form: AIGeneratorForm,
  model: ReturnType<typeof buildFormDocumentationModel>,
): string {
  const lines = [
    "- Use the public BloomSuite endpoint as the source of truth for submissions.",
    "- Do not post raw `embed_key` payloads from new clients unless you are preserving a legacy integration.",
    `- The form currently contains ${model.fieldCount} fields across ${model.stepCount} ${model.stepCount === 1 ? "step" : "steps"}.`,
  ];

  if (model.isEmpty) {
    lines.push(
      "- This form has no configured submit fields yet. Keep integrations on the minimal metadata payload until the schema is defined.",
    );
  }

  if (model.fieldCount >= 20) {
    lines.push(
      "- This is a large schema. Generate or map UI fields from the live field catalog instead of assuming a short static payload.",
    );
  }

  if (model.stepCount > 1) {
    lines.push(
      "- Preserve the current multi-step grouping and field order when building a guided submission flow.",
    );
  }

  if (model.fieldReferences.some((field) => field.options.length > 0)) {
    lines.push(
      "- Select fields only accept the documented option values. Do not synthesize new option strings client-side.",
    );
  }

  if (model.requiresEmailConsent) {
    lines.push(
      "- Email consent is required. Treat the email consent field as mandatory in the UI and payload validation.",
    );
  }

  if (model.requiresSmsConsent) {
    lines.push(
      "- SMS consent is required. Do not send SMS opt-in without an accompanying phone field value.",
    );
  }

  if (model.hasFileUploads) {
    lines.push(
      "- This form includes file uploads. Submit upload references only; direct multipart file uploads are not supported by the public submit endpoint.",
    );
  }

  if (form.status !== "published") {
    lines.push(
      "- This form is not published. The public submit endpoint will reject live requests until the form is published.",
    );
  }

  lines.push(
    "- Preserve `page_url` and `referrer` when available so attribution and spam controls keep working.",
  );
  lines.push(
    "- Expect a `429` response when the upstream anti-spam limits are triggered.",
  );

  return lines.join("\n");
}

function buildZodSchemaSnippet(
  form: AIGeneratorForm,
  fieldReferences: FormDocumentationFieldReference[],
): string {
  const fieldById = new Map(form.fields_json.map((field) => [field.id, field]));
  const hasFileFields = fieldReferences.some(
    (field) => field.fieldType === "file",
  );
  const lines: string[] = ['import { z } from "zod";', ""];

  if (hasFileFields) {
    lines.push("const BloomSuiteFileUploadReferenceSchema = z.object({");
    lines.push("  upload_id: z.string(),");
    lines.push("  field_id: z.string(),");
    lines.push("  bucket: z.string(),");
    lines.push("  path: z.string(),");
    lines.push("  file_name: z.string(),");
    lines.push("  file_size: z.number(),");
    lines.push("  mime_type: z.string(),");
    lines.push("  uploaded_at: z.string(),");
    lines.push("});");
    lines.push("");
  }

  lines.push("export const submissionSchema = z.object({");

  if (fieldReferences.length === 0) {
    lines.push(
      "  // Add form fields in the builder to replace this placeholder.",
    );
  }

  fieldReferences.forEach((fieldReference) => {
    const field = fieldById.get(fieldReference.fieldId);
    lines.push(
      `  ${JSON.stringify(fieldReference.submissionKey)}: ${buildFieldZodSchema(fieldReference, field)},`,
    );
  });

  lines.push("  page_url: z.string().url().optional(),");
  lines.push("  referrer: z.string().url().optional(),");
  lines.push("  source: z.string().optional(),");
  lines.push("  user_agent: z.string().optional(),");
  lines.push("  utm_source: z.string().optional(),");
  lines.push("  utm_medium: z.string().optional(),");
  lines.push("  utm_campaign: z.string().optional(),");
  lines.push("});");
  lines.push("");
  lines.push(
    "export type SubmissionPayload = z.infer<typeof submissionSchema>;",
  );

  return lines.join("\n");
}

function buildFieldZodSchema(
  fieldReference: FormDocumentationFieldReference,
  field?: FormField,
): string {
  let schema = getBaseZodSchema(fieldReference, field);

  if (
    fieldReference.fieldType !== "checkbox" &&
    fieldReference.fieldType !== "email_consent" &&
    fieldReference.fieldType !== "sms_consent" &&
    fieldReference.fieldType !== "file"
  ) {
    if (fieldReference.required) {
      schema = `${schema}.min(1, ${JSON.stringify(`${fieldReference.label} is required`)})`;
    }

    if (field?.rules?.min_length) {
      schema = `${schema}.min(${field.rules.min_length}, ${JSON.stringify(`${fieldReference.label} must be at least ${field.rules.min_length} characters`)})`;
    }

    if (field?.rules?.max_length) {
      schema = `${schema}.max(${field.rules.max_length}, ${JSON.stringify(`${fieldReference.label} must be at most ${field.rules.max_length} characters`)})`;
    }

    if (field?.rules?.pattern) {
      schema = `${schema}.regex(new RegExp(${JSON.stringify(field.rules.pattern)}), ${JSON.stringify(field.rules.pattern_message || `${fieldReference.label} is invalid`)})`;
    }
  }

  if (!fieldReference.required) {
    schema = `${schema}.optional()`;
  }

  return schema;
}

function getBaseZodSchema(
  fieldReference: FormDocumentationFieldReference,
  field?: FormField,
): string {
  switch (fieldReference.fieldType) {
    case "email":
      return "z.string().email()";
    case "phone":
      return "z.string()";
    case "select":
      if (field?.options?.length) {
        return `z.enum([${field.options.map((option) => JSON.stringify(option)).join(", ")}])`;
      }
      return "z.string()";
    case "checkbox":
      return fieldReference.required
        ? `z.boolean().refine((value) => value === true, ${JSON.stringify(`${fieldReference.label} must be accepted`)})`
        : "z.boolean()";
    case "email_consent":
    case "sms_consent":
      return fieldReference.required
        ? `z.boolean().refine((value) => value === true, ${JSON.stringify(`${fieldReference.label} must be accepted`)})`
        : "z.boolean()";
    case "file":
      return "z.array(BloomSuiteFileUploadReferenceSchema)";
    case "hidden":
    case "text":
    default:
      return "z.string()";
  }
}

function formatRules(field?: FormField): string | null {
  if (!field?.rules) {
    return null;
  }

  const parts: string[] = [];

  if (field.rules.min_length) {
    parts.push(`min length ${field.rules.min_length}`);
  }

  if (field.rules.max_length) {
    parts.push(`max length ${field.rules.max_length}`);
  }

  if (field.rules.pattern) {
    parts.push(`pattern ${field.rules.pattern}`);
  }

  if (field.rules.max_files) {
    parts.push(`max files ${field.rules.max_files}`);
  }

  if (field.rules.max_file_size_mb) {
    parts.push(`max file size ${field.rules.max_file_size_mb} MB`);
  }

  if (field.rules.allowed_mime_types?.length) {
    parts.push(
      `allowed mime types ${field.rules.allowed_mime_types.join(", ")}`,
    );
  }

  return parts.length ? parts.join("; ") : null;
}

function formatExampleValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}
