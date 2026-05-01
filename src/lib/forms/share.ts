import { SUPABASE_URL } from "@/integrations/supabase/config";
import type { FormField } from "@/types/formBuilder";

export type FormEmbedDisplayMode = "inline" | "modal" | "slide-in";

export interface FormDeveloperSnippetOptions {
  embedKey: string;
  endpoint?: string;
  formId: string;
  formName?: string;
  fields?: FormField[];
  origin?: string;
  samplePayload?: Record<string, unknown>;
}

export interface FormShareCodeOptions {
  embedKey: string;
  formName?: string;
  origin?: string;
  supabaseUrl?: string;
  iframeHeight?: number;
  displayMode?: FormEmbedDisplayMode;
  containerSelector?: string;
  buttonText?: string;
}

export const STATIC_EMBED_RUNTIME_VERSION = "1.5.0";
export const DEFAULT_CONTAINER_SELECTOR = "#bloomsuite-form";

interface DeveloperFieldConfig {
  key: string;
  label: string;
  inputType: "text" | "email" | "tel" | "checkbox" | "select";
  required: boolean;
  options?: string[];
}

function getBrowserOrigin(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function getPublicFormSubmissionEndpoint(
  formId: string,
  origin: string = getBrowserOrigin(),
): string {
  return `${origin}/api/forms/${formId}/submit`;
}

function getStorageEmbedScriptUrl(supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/object/public/assets/forms/embed.v${STATIC_EMBED_RUNTIME_VERSION}.js`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeTemplateLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

function getContainerSelector(selector?: string): string {
  return selector?.trim() || DEFAULT_CONTAINER_SELECTOR;
}

function getPlaceholderMarkup(
  selector: string,
  attributes: Record<string, string>,
): string {
  const normalizedSelector = getContainerSelector(selector);
  const attributeMarkup = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");

  if (normalizedSelector.startsWith("#")) {
    return `<div id="${escapeAttribute(normalizedSelector.slice(1))}"${attributeMarkup}></div>`;
  }

  if (normalizedSelector.startsWith(".")) {
    return `<div class="${escapeAttribute(normalizedSelector.slice(1).replace(/\./g, " "))}"${attributeMarkup}></div>`;
  }

  return `<div id="${escapeAttribute(normalizedSelector)}"${attributeMarkup}></div>`;
}

export function getPublicFormUrl(
  embedKey: string,
  origin: string = getBrowserOrigin(),
): string {
  return `${origin}/f/${embedKey}`;
}

export function getStaticEmbedScriptUrl(
  origin: string = getBrowserOrigin(),
): string {
  return `${origin}/forms/embed.v${STATIC_EMBED_RUNTIME_VERSION}.js`;
}

export function getLegacyEdgeEmbedScriptUrl(
  supabaseUrl: string = SUPABASE_URL,
): string {
  return `${supabaseUrl}/functions/v1/serve-embed-js`;
}

export function getUpstreamFormSubmissionEndpoint(
  supabaseUrl: string = SUPABASE_URL,
): string {
  return `${supabaseUrl}/functions/v1/submit-form`;
}

export const getFormSubmissionEndpoint = getUpstreamFormSubmissionEndpoint;

export function buildIframeEmbedCode({
  embedKey,
  origin = getBrowserOrigin(),
  iframeHeight = 600,
}: FormShareCodeOptions): string {
  const publicUrl = getPublicFormUrl(embedKey, origin);

  return `<iframe\n  src="${publicUrl}"\n  width="100%"\n  height="${Math.max(320, Math.round(iframeHeight))}"\n  frameborder="0"\n  style="border: none; max-width: 100%;"\n  title="BloomSuite form"\n></iframe>`;
}

export function buildJavaScriptEmbedCode({
  embedKey,
  formName = "BloomSuite Form",
  origin,
  supabaseUrl,
  displayMode = "inline",
  containerSelector = DEFAULT_CONTAINER_SELECTOR,
  buttonText = "Open Form",
}: FormShareCodeOptions): string {
  const scriptUrl = origin
    ? getStaticEmbedScriptUrl(origin)
    : supabaseUrl
      ? getStorageEmbedScriptUrl(supabaseUrl)
      : getStaticEmbedScriptUrl();

  if (displayMode === "inline") {
    return `<!-- BloomSuite Form Embed -->\n${getPlaceholderMarkup(
      containerSelector,
      {
        "data-bloomsuite-form": embedKey,
        "data-display-mode": displayMode,
      },
    )}\n<script src="${scriptUrl}" defer></script>`;
  }

  return `<!-- BloomSuite Form Embed -->\n<div data-bloomsuite-form="${escapeAttribute(embedKey)}" data-display-mode="${displayMode}" data-button-text="${escapeAttribute(buttonText)}" data-form-title="${escapeAttribute(formName)}"></div>\n<script src="${scriptUrl}" defer></script>`;
}

export function buildReactEmbedCode({
  embedKey,
  formName = "BloomSuite Form",
  origin,
  supabaseUrl,
  displayMode = "inline",
  buttonText = "Open Form",
}: FormShareCodeOptions): string {
  const scriptUrl = origin
    ? getStaticEmbedScriptUrl(origin)
    : supabaseUrl
      ? getStorageEmbedScriptUrl(supabaseUrl)
      : getStaticEmbedScriptUrl();

  return `import { useEffect } from "react";\n\nconst EMBED_KEY = "${embedKey}";\nconst SCRIPT_SRC = "${scriptUrl}";\n\nexport function BloomSuiteForm() {\n  useEffect(() => {\n    if (document.querySelector(\`script[src="${escapeTemplateLiteral(scriptUrl)}"]\`)) {\n      return;\n    }\n\n    const script = document.createElement("script");\n    script.src = SCRIPT_SRC;\n    script.defer = true;\n    document.body.appendChild(script);\n\n    return () => {\n      // Keep the shared runtime loaded for later mounts.\n    };\n  }, []);\n\n  return (\n    <div\n      data-bloomsuite-form={EMBED_KEY}\n      data-display-mode="${displayMode}"${
    displayMode === "inline"
      ? ""
      : `\n      data-button-text="${escapeAttribute(buttonText)}"\n      data-form-title="${escapeAttribute(formName)}"`
  }\n    />\n  );\n}`;
}

function getDeveloperSubmissionEndpoint(
  formId: string,
  endpoint?: string,
): string {
  return endpoint || getPublicFormSubmissionEndpoint(formId);
}

function getFieldSubmissionKey(field: FormField): string {
  const normalizedKey = field.mapping_key?.trim();

  return normalizedKey && normalizedKey.length > 0 ? normalizedKey : field.id;
}

function getFieldSampleValue(field: FormField): unknown {
  const normalizedKey = getFieldSubmissionKey(field).toLowerCase();
  const normalizedLabel = field.label.toLowerCase();
  const searchableText = `${normalizedKey} ${normalizedLabel}`;

  if (field.default_value !== undefined && field.default_value !== null) {
    return field.default_value;
  }

  switch (field.type) {
    case "email":
      return "customer@your-store.com";
    case "phone":
      return "+15555550123";
    case "select":
      return field.options?.[0] ?? "Option 1";
    case "checkbox":
    case "segment_checkbox":
    case "email_consent":
    case "sms_consent":
      return true;
    case "hidden":
      return "campaign-source";
    case "file":
      return undefined;
    case "text":
    default:
      if (searchableText.includes("first")) {
        return "Avery";
      }

      if (searchableText.includes("last")) {
        return "Stone";
      }

      if (searchableText.includes("name")) {
        return "Avery Stone";
      }

      if (searchableText.includes("company") || searchableText.includes("business")) {
        return "Bloom & Co";
      }

      if (searchableText.includes("city")) {
        return "Nashville";
      }

      if (searchableText.includes("state") || searchableText.includes("province")) {
        return "Tennessee";
      }

      if (searchableText.includes("zip") || searchableText.includes("postal")) {
        return "37203";
      }

      if (searchableText.includes("message") || searchableText.includes("notes")) {
        return "I would like to learn more about your latest collection.";
      }

      return "Sample value";
  }
}

function buildFieldPayload(fields?: FormField[]): Record<string, unknown> {
  if (!fields || fields.length === 0) {
    return {};
  }

  return fields.reduce<Record<string, unknown>>((payload, field) => {
    const submissionKey = getFieldSubmissionKey(field);
    const sampleValue = getFieldSampleValue(field);

    if (!submissionKey || sampleValue === undefined) {
      return payload;
    }

    payload[submissionKey] = sampleValue;
    return payload;
  }, {});
}

function buildDeveloperPayload(
  options: FormDeveloperSnippetOptions,
): Record<string, unknown> {
  if (options.samplePayload) {
    return options.samplePayload;
  }

  const resolvedOrigin = options.origin ?? getBrowserOrigin();
  const fieldPayload = buildFieldPayload(options.fields);
  const basePayload =
    Object.keys(fieldPayload).length > 0
      ? fieldPayload
      : { email: "customer@your-store.com" };

  return {
    ...basePayload,
    page_url: getPublicFormUrl(options.embedKey, resolvedOrigin),
    referrer: resolvedOrigin || "https://your-store.com",
    source: "custom-integration",
  };
}

function toJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildDeveloperFieldConfigs(fields?: FormField[]): DeveloperFieldConfig[] {
  const sourceFields =
    fields && fields.length > 0
      ? fields.filter((field) => field.type !== "file" && field.type !== "hidden")
      : [];

  if (sourceFields.length === 0) {
    return [
      {
        key: "email",
        label: "Email address",
        inputType: "email",
        required: true,
      },
    ];
  }

  return sourceFields.map((field) => ({
    key: getFieldSubmissionKey(field),
    label: field.label,
    inputType:
      field.type === "email"
        ? "email"
        : field.type === "phone"
          ? "tel"
          : field.type === "select"
            ? "select"
            : field.type === "checkbox" ||
                field.type === "segment_checkbox" ||
                field.type === "email_consent" ||
                field.type === "sms_consent"
              ? "checkbox"
              : "text",
    required: Boolean(field.required),
    options: field.type === "select" ? [...(field.options ?? [])] : undefined,
  }));
}

function buildReactFieldMarkup(fieldConfigs: DeveloperFieldConfig[]): string {
  return fieldConfigs
    .map((field) => {
      if (field.inputType === "checkbox") {
        return `      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={Boolean(formData[${JSON.stringify(field.key)}])}
          onChange={(event) => updateField(${JSON.stringify(field.key)}, event.target.checked)}
        />
        <span>${field.label}</span>
      </label>`;
      }

      if (field.inputType === "select") {
        const options = (field.options ?? ["Option 1"])
          .map(
            (option) =>
              `          <option value=${JSON.stringify(option)}>${option}</option>`,
          )
          .join("\n");

        return `      <label className="grid gap-1">
        <span>${field.label}</span>
        <select
          value={String(formData[${JSON.stringify(field.key)}] ?? "")}
          onChange={(event) => updateField(${JSON.stringify(field.key)}, event.target.value)}
        >
${options}
        </select>
      </label>`;
      }

      return `      <label className="grid gap-1">
        <span>${field.label}</span>
        <input
          type="${field.inputType}"
          name=${JSON.stringify(field.key)}
          value={String(formData[${JSON.stringify(field.key)}] ?? "")}
          onChange={(event) => updateField(${JSON.stringify(field.key)}, event.target.value)}
          ${field.required ? "required" : ""}
        />
      </label>`;
    })
    .join("\n\n");
}

export function buildCurlSubmissionSnippet({
  embedKey,
  endpoint,
  formId,
  fields,
  origin,
  samplePayload,
}: FormDeveloperSnippetOptions): string {
  const submitEndpoint = getDeveloperSubmissionEndpoint(formId, endpoint);
  const payload = buildDeveloperPayload({
    embedKey,
    endpoint,
    fields,
    formId,
    origin,
    samplePayload,
  });

  return `curl -X POST "${submitEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '${toJson(payload)}'`;
}

export function buildReactSubmissionSnippet({
  embedKey,
  endpoint,
  formId,
  fields,
  origin,
  samplePayload,
}: FormDeveloperSnippetOptions): string {
  const submitEndpoint = getDeveloperSubmissionEndpoint(formId, endpoint);
  const payload = buildDeveloperPayload({
    embedKey,
    endpoint,
    fields,
    formId,
    origin,
    samplePayload,
  });
  const metaDefaults = {
    page_url: "window.location.href",
    referrer: "document.referrer",
    source: "react-component",
  };
  const fieldPayload = Object.entries(payload).reduce<Record<string, unknown>>(
    (accumulator, [key, value]) => {
      if (key === "page_url" || key === "referrer" || key === "source") {
        return accumulator;
      }

      accumulator[key] = value;
      return accumulator;
    },
    {},
  );
  const fieldConfigs = buildDeveloperFieldConfigs(fields);

  return `import { useState } from "react";

const FORM_ID = "${formId}";
const SUBMIT_ENDPOINT = "${submitEndpoint}";
const INITIAL_VALUES = ${toJson(fieldPayload)};

export function BloomSuiteCustomForm() {
  const [formData, setFormData] = useState(INITIAL_VALUES);
  const [status, setStatus] = useState("idle");

  function updateField(key, value) {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus("submitting");

    const response = await fetch(SUBMIT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...formData,
        page_url: ${metaDefaults.page_url},
        referrer: ${metaDefaults.referrer},
        source: ${JSON.stringify(metaDefaults.source)},
      }),
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    setStatus("success");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
${buildReactFieldMarkup(fieldConfigs)}

      <button type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Sending..." : "Submit"}
      </button>
      <p className="text-xs text-slate-500">Direct BloomSuite form ID: {FORM_ID}</p>
    </form>
  );
}`;
}

export function buildNextJsSubmissionSnippet({
  embedKey,
  endpoint,
  formId,
  fields,
  origin,
  samplePayload,
}: FormDeveloperSnippetOptions): string {
  const submitEndpoint = getDeveloperSubmissionEndpoint(formId, endpoint);
  const payload = buildDeveloperPayload({
    embedKey,
    endpoint,
    fields,
    formId,
    origin,
    samplePayload,
  });

  return `// app/forms/actions.ts
"use server";

const FORM_ID = "${formId}";
const SUBMIT_ENDPOINT = "${submitEndpoint}";
const BASE_PAYLOAD = ${toJson(payload)};

export async function submitBloomSuiteForm(partialPayload = {}) {
  const response = await fetch(SUBMIT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      ...BASE_PAYLOAD,
      ...partialPayload,
      source: partialPayload.source ?? "nextjs-server-action",
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "BloomSuite submission failed");
  }

  return result;
}

// Usage inside a server component or route handler:
// await submitBloomSuiteForm({
//   email: "customer@your-store.com",
// });
// Direct BloomSuite form ID: ${formId}
// Hosted submit endpoint: ${submitEndpoint}`;
}
