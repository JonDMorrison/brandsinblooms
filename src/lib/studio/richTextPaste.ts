import { formatDraftRichText } from "../crm/htmlContent";

/**
 * Normalizes rich HTML before TipTap parses clipboard content.
 *
 * Word, Google Docs, and web pages often put layout CSS, scripts, images, and
 * event handlers on copied content. The campaign editor only supports the
 * portable subset that the send renderer can reproduce reliably: paragraphs,
 * headings, lists, basic emphasis, alignment, and safe links.
 */
export function normalizePastedRichText(html: string): string {
  return formatDraftRichText(html);
}
