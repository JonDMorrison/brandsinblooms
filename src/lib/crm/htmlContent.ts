// HTML content helpers used by the campaign draft preview renderer
// (src/lib/crm/campaignDraftPersistence.ts).
//
// MUST stay in sync with supabase/functions/_shared/htmlContent.ts. The src/
// tree (Vite + browser bundle) and the supabase/functions/ tree (Deno edge
// functions) use different tsconfigs and module resolution, so we can't share
// a single source file. Any change here must be mirrored in
// supabase/functions/_shared/htmlContent.ts so the draft preview written into
// crm_campaigns.content matches the HTML the send pipeline emits from
// metadata.contentBlocks.
//
// Bug context: prior to the introduction of formatDraftRichText, the draft
// renderer ran rich-text bodies through a blanket escapeHtml, which turned
// TipTap output like `<p>Hi</p>` into `&lt;p&gt;Hi&lt;/p&gt;` in
// crm_campaigns.content. Email clients showed the literal tag text. See the
// "fix: stop double-escaping rich-text HTML" commit for full background.
//
// Security: rich-text bodies are sanitized against the same strict allowlist
// used by the edge-function renderer before being embedded in the draft
// preview. The browser bundle cannot import sanitize-html directly because it
// pulls Node-only parsing dependencies into Vite, so this file mirrors the
// same policy with a DOM-based sanitizer.

import { RICH_TEXT_SANITIZE_OPTIONS } from "./htmlContentSanitizeConfig";

const ALLOWED_TAGS = new Set(RICH_TEXT_SANITIZE_OPTIONS.allowedTags ?? []);
const ALLOWED_ATTRIBUTES = (RICH_TEXT_SANITIZE_OPTIONS.allowedAttributes ??
  {}) as Record<string, string[]>;
const GLOBAL_ALLOWED_ATTRIBUTES = new Set(ALLOWED_ATTRIBUTES["*"] ?? []);
const ALLOWED_STYLE_RULES =
  ((RICH_TEXT_SANITIZE_OPTIONS.allowedStyles ?? {})["*"] as
    | Record<string, RegExp[]>
    | undefined) ?? {};
const ALLOWED_SCHEMES = new Set(
  RICH_TEXT_SANITIZE_OPTIONS.allowedSchemes ?? [],
);
const ALLOWED_SCHEMES_BY_TAG =
  (RICH_TEXT_SANITIZE_OPTIONS.allowedSchemesByTag ?? {}) as Record<
    string,
    string[]
  >;
const URL_SCHEME_ATTRIBUTES = new Set(
  RICH_TEXT_SANITIZE_OPTIONS.allowedSchemesAppliedToAttributes ?? [],
);
const DISCARD_CONTENT_TAGS = new Set([
  ...(RICH_TEXT_SANITIZE_OPTIONS.nonTextTags ?? []),
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "select",
  "button",
  "img",
]);

function sanitizeStyleAttribute(styleValue: string): string {
  const safeDeclarations: string[] = [];

  for (const declaration of styleValue.split(";")) {
    const separatorIndex = declaration.indexOf(":");

    if (separatorIndex < 0) {
      continue;
    }

    const property = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const value = declaration
      .slice(separatorIndex + 1)
      .trim()
      .replace(/\s+/g, " ");
    const allowedPatterns = ALLOWED_STYLE_RULES[property];

    if (!property || !value || !allowedPatterns) {
      continue;
    }

    if (allowedPatterns.some((pattern) => pattern.test(value))) {
      safeDeclarations.push(`${property}:${value}`);
    }
  }

  return safeDeclarations.join(";");
}

function isAllowedUrl(
  tagName: string,
  attributeName: string,
  value: string,
): boolean {
  if (!URL_SCHEME_ATTRIBUTES.has(attributeName)) {
    return true;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith("//")) {
    return false;
  }

  const schemeMatch = trimmed.match(/^([a-z][a-z0-9+.-]*):/i);

  if (!schemeMatch) {
    return true;
  }

  const allowedForTag = new Set(ALLOWED_SCHEMES_BY_TAG[tagName] ?? []);
  const allowedSchemes =
    allowedForTag.size > 0 ? allowedForTag : ALLOWED_SCHEMES;

  return allowedSchemes.has(schemeMatch[1].toLowerCase());
}

function enforceBlankTargetRel(element: Element) {
  if (element.tagName.toLowerCase() !== "a") {
    return;
  }

  if (element.getAttribute("target")?.toLowerCase() !== "_blank") {
    return;
  }

  const relTokens = new Set(
    (element.getAttribute("rel") ?? "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean),
  );

  relTokens.add("noopener");
  relTokens.add("noreferrer");
  element.setAttribute("rel", Array.from(relTokens).join(" "));
}

function sanitizeAttributes(element: Element, tagName: string) {
  const allowedAttributes = new Set([
    ...GLOBAL_ALLOWED_ATTRIBUTES,
    ...(ALLOWED_ATTRIBUTES[tagName] ?? []),
  ]);

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();

    if (name.startsWith("on") || !allowedAttributes.has(name)) {
      element.removeAttribute(attribute.name);
      continue;
    }

    if (name === "style") {
      const safeStyle = sanitizeStyleAttribute(attribute.value);

      if (safeStyle) {
        element.setAttribute("style", safeStyle);
      } else {
        element.removeAttribute(attribute.name);
      }

      continue;
    }

    if (!isAllowedUrl(tagName, name, attribute.value)) {
      element.removeAttribute(attribute.name);
    }
  }

  enforceBlankTargetRel(element);
}

function unwrapElement(element: Element) {
  const fragment = document.createDocumentFragment();

  while (element.firstChild) {
    fragment.appendChild(element.firstChild);
  }

  element.replaceWith(fragment);
}

function sanitizeChildren(node: ParentNode) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) {
      child.remove();
      continue;
    }

    if (child.nodeType !== 1) {
      continue;
    }

    const element = child as Element;
    const tagName = element.tagName.toLowerCase();

    if (!ALLOWED_TAGS.has(tagName)) {
      if (DISCARD_CONTENT_TAGS.has(tagName)) {
        element.remove();
        continue;
      }

      sanitizeChildren(element);
      unwrapElement(element);
      continue;
    }

    sanitizeAttributes(element, tagName);
    sanitizeChildren(element);
  }
}

function sanitizeRichTextHtml(value: string): string {
  if (typeof document === "undefined") {
    return escapeHtml(value);
  }

  const container = document.createElement("div");
  container.innerHTML = value;
  sanitizeChildren(container);
  return container.innerHTML;
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Plain-text fields (titles, captions, button labels, alt text, prices,
// author lines): always escape, then convert newlines to <br />. Use this for
// values that should never contain HTML markup.
export function formatDraftText(value: string | null | undefined): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

// Rich-text fields (block.body / block.content from the TipTap editor):
// sanitize and pass through if the value already contains HTML tags;
// otherwise escape + newline-convert. The tag-detection regex requires an
// actual tag name + word boundary so plain text like "<3 days" or "a < b"
// stays in the escape branch.
//
// Mirrors supabase/functions/_shared/htmlContent.ts#toHtmlText. Same input
// should stay semantically aligned in both trees, with the shared allowlist
// data living in htmlContentSanitizeConfig.ts and the edge-function copy.
export function formatDraftRichText(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (!str) return "";
  if (/<\/?[a-z][a-z0-9]*\b/i.test(str)) {
    return sanitizeRichTextHtml(str);
  }
  return escapeHtml(str).replace(/\n/g, "<br />");
}
