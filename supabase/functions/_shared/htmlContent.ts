// HTML content helpers shared by the send-time email renderer (this file's
// consumers in supabase/functions/**) and the draft preview renderer
// (src/lib/crm/campaignDraftPersistence.ts via src/lib/crm/htmlContent.ts).
//
// MUST stay in sync with src/lib/crm/htmlContent.ts. The src/ tree (Vite +
// browser bundle) and the supabase/functions/ tree (Deno edge functions) use
// different tsconfigs and module resolution, so we can't share a single
// source file. Any change here must be mirrored in src/lib/crm/htmlContent.ts
// so the draft preview written into crm_campaigns.content matches the HTML
// the send pipeline emits from metadata.contentBlocks.
//
// Bug context: prior to the introduction of toHtmlText / formatDraftRichText,
// the draft renderer ran rich-text bodies through a blanket escapeHtml, which
// turned TipTap output like `<p>Hi</p>` into `&lt;p&gt;Hi&lt;/p&gt;` in
// crm_campaigns.content. Email clients showed the literal tag text. See the
// "fix: stop double-escaping rich-text HTML" commit for full background.
//
// Security: rich-text bodies are now run through sanitize-html with a strict
// allowlist before being embedded in the rendered email. The allowlist is
// scoped to what TipTap's StarterKit + TextAlign + Underline extensions can
// emit (plus a few defensive aliases). Anything outside the allowlist
// (e.g., <script>, <iframe>, <img onerror=...>, javascript: URLs in href,
// inline event handlers) is stripped. The same configuration is mirrored
// in src/lib/crm/htmlContent.ts.

import sanitizeHtml from "npm:sanitize-html@2.17.3";

import { RICH_TEXT_SANITIZE_OPTIONS } from "./htmlContentSanitizeConfig.ts";

const RICH_TEXT_ENTITY_PATTERN =
  /&(nbsp|amp|lt|gt|quot|#0*39|#x27);/i;

function decodeHtmlEntities(value: string): string {
  let decoded = value;

  for (let index = 0; index < 2; index += 1) {
    const nextValue = decoded
      .replace(/&nbsp;/gi, " ")
      .replace(/&#0*39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");

    if (nextValue === decoded) {
      break;
    }

    decoded = nextValue;
  }

  return decoded;
}

function normalizeRichTextInput(value: string): string {
  if (/<\/?[a-z][a-z0-9]*\b/i.test(value) || !RICH_TEXT_ENTITY_PATTERN.test(value)) {
    return value;
  }

  const decoded = decodeHtmlEntities(value);
  return /<\/?[a-z][a-z0-9]*\b/i.test(decoded) ? decoded : value;
}

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeHtmlAttribute(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Render a possibly-rich-text value into HTML. If the value already contains
// an HTML tag (rich-text editor output), sanitize via sanitize-html and pass
// through. Otherwise escape special characters and convert newlines to
// <br />. The tag-detection regex requires an actual tag name + word
// boundary so plain text like "<3 days" or "a < b" stays in the escape
// branch.
export function toHtmlText(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (!str) return "";
  const normalized = normalizeRichTextInput(str);
  if (/<\/?[a-z][a-z0-9]*\b/i.test(normalized)) {
    return sanitizeHtml(normalized, RICH_TEXT_SANITIZE_OPTIONS);
  }
  return escapeHtml(str).replace(/\n/g, "<br />");
}
