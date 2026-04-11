export type FormEmbedDisplayMode = "inline" | "modal" | "slide-in";

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

const DEFAULT_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://udldmkqwnxhdeztyqcau.supabase.co";

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
  origin: string = window.location.origin,
): string {
  return `${origin}/f/${embedKey}`;
}

export function getStaticEmbedScriptUrl(
  supabaseUrl: string = DEFAULT_SUPABASE_URL,
): string {
  return `${supabaseUrl}/storage/v1/object/public/assets/forms/embed.v${STATIC_EMBED_RUNTIME_VERSION}.js`;
}

export function getLegacyEdgeEmbedScriptUrl(
  supabaseUrl: string = DEFAULT_SUPABASE_URL,
): string {
  return `${supabaseUrl}/functions/v1/serve-embed-js`;
}

export function buildIframeEmbedCode({
  embedKey,
  origin = window.location.origin,
  iframeHeight = 600,
}: FormShareCodeOptions): string {
  const publicUrl = getPublicFormUrl(embedKey, origin);

  return `<iframe\n  src="${publicUrl}"\n  width="100%"\n  height="${Math.max(320, Math.round(iframeHeight))}"\n  frameborder="0"\n  style="border: none; max-width: 100%;"\n  title="BloomSuite form"\n></iframe>`;
}

export function buildJavaScriptEmbedCode({
  embedKey,
  formName = "BloomSuite Form",
  supabaseUrl = DEFAULT_SUPABASE_URL,
  displayMode = "inline",
  containerSelector = DEFAULT_CONTAINER_SELECTOR,
  buttonText = "Open Form",
}: FormShareCodeOptions): string {
  const scriptUrl = getStaticEmbedScriptUrl(supabaseUrl);

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
  supabaseUrl = DEFAULT_SUPABASE_URL,
  displayMode = "inline",
  buttonText = "Open Form",
}: FormShareCodeOptions): string {
  const scriptUrl = getStaticEmbedScriptUrl(supabaseUrl);

  return `import { useEffect } from "react";\n\nconst EMBED_KEY = "${embedKey}";\nconst SCRIPT_SRC = "${scriptUrl}";\n\nexport function BloomSuiteForm() {\n  useEffect(() => {\n    if (document.querySelector(\`script[src=\"${escapeTemplateLiteral(scriptUrl)}\"]\`)) {\n      return;\n    }\n\n    const script = document.createElement("script");\n    script.src = SCRIPT_SRC;\n    script.defer = true;\n    document.body.appendChild(script);\n\n    return () => {\n      // Keep the shared runtime loaded for later mounts.\n    };\n  }, []);\n\n  return (\n    <div\n      data-bloomsuite-form={EMBED_KEY}\n      data-display-mode="${displayMode}"${
    displayMode === "inline"
      ? ""
      : `\n      data-button-text=\"${escapeAttribute(buttonText)}\"\n      data-form-title=\"${escapeAttribute(formName)}\"`
  }\n    />\n  );\n}`;
}
