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
// Security: rich-text bodies are now run through sanitize-html with a strict
// allowlist before being embedded in the draft preview. The allowlist is
// scoped to what TipTap's StarterKit + TextAlign + Underline extensions can
// emit (plus a few defensive aliases). Anything outside the allowlist
// (e.g., <script>, <iframe>, <img onerror=...>, javascript: URLs in href,
// inline event handlers) is stripped. The same configuration is mirrored
// in supabase/functions/_shared/htmlContent.ts.

import sanitizeHtml from "sanitize-html";

import { RICH_TEXT_SANITIZE_OPTIONS } from "./htmlContentSanitizeConfig";

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
// must produce identical output in both files — the sanitize-html
// configuration lives in htmlContentSanitizeConfig.ts (and a parallel copy
// in supabase/functions/_shared/htmlContentSanitizeConfig.ts) so any
// allowlist change is centralized per tree.
export function formatDraftRichText(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (!str) return "";
  if (/<\/?[a-z][a-z0-9]*\b/i.test(str)) {
    return sanitizeHtml(str, RICH_TEXT_SANITIZE_OPTIONS);
  }
  return escapeHtml(str).replace(/\n/g, "<br />");
}
