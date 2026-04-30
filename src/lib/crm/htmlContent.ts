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
// TODO(security): the draft and send-time renderers currently trust whatever
// HTML the rich-text editor (or a paste source) emits. Run rich-text bodies
// through DOMPurify or equivalent before embedding to defend against pasted
// <script>/<iframe>. Tracked separately from the double-escape fix.

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
// pass through if the value already contains HTML tags, otherwise escape +
// newline-convert. The tag-detection regex requires an actual tag name + word
// boundary so plain text like "<3 days" or "a < b" stays in the escape branch.
//
// Mirrors supabase/functions/_shared/htmlContent.ts#toHtmlText so the draft
// preview HTML in crm_campaigns.content matches what the send pipeline would
// render from metadata.contentBlocks.
export function formatDraftRichText(value: string | null | undefined): string {
  const str = String(value ?? "");
  if (!str) return "";
  if (/<\/?[a-z][a-z0-9]*\b/i.test(str)) return str;
  return escapeHtml(str).replace(/\n/g, "<br />");
}
