import { SUPABASE_URL } from "@/integrations/supabase/config";

export type FormEmbedDisplayMode = "inline" | "modal" | "slide-in";

export interface FormDeveloperSnippetOptions {
  embedKey: string;
  endpoint?: string;
  formId: string;
  formName?: string;
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

  return `import { useEffect } from "react";\n\nconst EMBED_KEY = "${embedKey}";\nconst SCRIPT_SRC = "${scriptUrl}";\n\nexport function BloomSuiteForm() {\n  useEffect(() => {\n    if (document.querySelector(\`script[src=\"${escapeTemplateLiteral(scriptUrl)}\"]\`)) {\n      return;\n    }\n\n    const script = document.createElement("script");\n    script.src = SCRIPT_SRC;\n    script.defer = true;\n    document.body.appendChild(script);\n\n    return () => {\n      // Keep the shared runtime loaded for later mounts.\n    };\n  }, []);\n\n  return (\n    <div\n      data-bloomsuite-form={EMBED_KEY}\n      data-display-mode="${displayMode}"${
    displayMode === "inline"
      ? ""
      : `\n      data-button-text=\"${escapeAttribute(buttonText)}\"\n      data-form-title=\"${escapeAttribute(formName)}\"`
  }\n    />\n  );\n}`;
}

function getDeveloperSubmissionEndpoint(
  formId: string,
  endpoint?: string,
): string {
  return endpoint || getPublicFormSubmissionEndpoint(formId);
}

export function buildCurlSubmissionSnippet({
  endpoint,
  formId,
}: FormDeveloperSnippetOptions): string {
  const submitEndpoint = getDeveloperSubmissionEndpoint(formId, endpoint);

  return `curl -X POST "${submitEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "customer@example.com",
    "first_name": "Avery",
    "page_url": "https://example.com/forms",
    "referrer": "https://example.com"
  }'`;
}

export function buildReactSubmissionSnippet({
  endpoint,
  formId,
}: FormDeveloperSnippetOptions): string {
  const submitEndpoint = getDeveloperSubmissionEndpoint(formId, endpoint);

  return `import { useState } from "react";\n\nconst FORM_ID = "${formId}";\nconst SUBMIT_ENDPOINT = "${submitEndpoint}";\n\nexport function BloomSuiteCustomForm() {\n  const [email, setEmail] = useState("");\n  const [status, setStatus] = useState("idle");\n\n  async function handleSubmit(event) {\n    event.preventDefault();\n    setStatus("submitting");\n\n    const response = await fetch(SUBMIT_ENDPOINT, {\n      method: "POST",\n      headers: {\n        "Content-Type": "application/json",\n      },\n      body: JSON.stringify({\n        email,\n        page_url: window.location.href,\n        referrer: document.referrer,\n      }),\n    });\n\n    if (!response.ok) {\n      setStatus("error");\n      return;\n    }\n\n    setEmail("");\n    setStatus("success");\n  }\n\n  return (\n    <form onSubmit={handleSubmit} className="space-y-3">\n      <label htmlFor="email">Email address</label>\n      <input\n        id="email"\n        type="email"\n        value={email}\n        onChange={(event) => setEmail(event.target.value)}\n        placeholder="you@example.com"\n      />\n      <button type="submit" disabled={status === "submitting"}>\n        {status === "submitting" ? "Sending..." : "Submit"}\n      </button>\n      <p className="text-xs text-slate-500">Internal form ID: {FORM_ID}</p>\n    </form>\n  );\n}`;
}

export function buildNextJsSubmissionSnippet({
  endpoint,
  formId,
}: FormDeveloperSnippetOptions): string {
  const submitEndpoint = getDeveloperSubmissionEndpoint(formId, endpoint);

  return `// app/api/bloomsuite-form/route.ts\nimport { NextResponse } from "next/server";\n\nconst FORM_ID = "${formId}";\nconst SUBMIT_ENDPOINT = "${submitEndpoint}";\n\nexport async function POST(request: Request) {\n  const payload = await request.json();\n\n  const response = await fetch(SUBMIT_ENDPOINT, {\n    method: "POST",\n    headers: {\n      "Content-Type": "application/json",\n    },\n    body: JSON.stringify({\n      ...payload,\n      source: payload.source ?? "nextjs-app",\n    }),\n  });\n\n  const data = await response.json();\n  return NextResponse.json(data, { status: response.status });\n}\n\n// app/forms/example-form.tsx\n"use client";\n\nimport { useState } from "react";\n\nexport default function ExampleForm() {\n  const [email, setEmail] = useState("");\n\n  async function handleSubmit(event) {\n    event.preventDefault();\n\n    await fetch("/api/bloomsuite-form", {\n      method: "POST",\n      headers: {\n        "Content-Type": "application/json",\n      },\n      body: JSON.stringify({\n        email,\n        page_url: window.location.href,\n      }),\n    });\n  }\n\n  return (\n    <form onSubmit={handleSubmit} className="space-y-3">\n      <label htmlFor="email">Email address</label>\n      <input\n        id="email"\n        type="email"\n        value={email}\n        onChange={(event) => setEmail(event.target.value)}\n      />\n      <button type="submit">Submit</button>\n      <p className="text-xs text-slate-500">Internal form ID: {FORM_ID}</p>\n    </form>\n  );\n}`;
}
