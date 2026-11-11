import type { StudioBlock } from "@/types/studioBlocks";

const textKeys = new Set([
  "headline",
  "heading",
  "title",
  "subheading",
  "body",
  "content",
  "text",
  "description",
  "caption",
  "name",
  "buttonText",
  "dateLabel",
]);
const clean = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
const placeholder =
  /^(newsletter title|your (headline|heading|title|text|content)|lorem ipsum|add (your )?(text|content)|click to edit)/i;
export function newsletterInboxText(blocks: StudioBlock[]): string[] {
  const found: string[] = [];
  function walk(value: unknown, key = "", depth = 0) {
    if (depth > 5) return;
    if (typeof value === "string" && textKeys.has(key)) {
      const text = clean(value);
      if (text.length > 4 && !placeholder.test(text) && !found.includes(text))
        found.push(text);
    } else if (Array.isArray(value))
      value.forEach((item) => walk(item, key, depth + 1));
    else if (value && typeof value === "object")
      Object.entries(value).forEach(([k, v]) => walk(v, k, depth + 1));
  }
  blocks
    .filter(
      (b) =>
        b.visible !== false &&
        ![
          "footer",
          "newsletter-header",
          "social-follow",
          "divider",
          "spacer",
        ].includes(b.type),
    )
    .forEach((b) => walk(b));
  return found;
}
const shorten = (value: string, limit: number) =>
  value.length <= limit
    ? value
    : value
        .slice(0, limit - 1)
        .replace(/\s+\S*$/, "")
        .trim() + "…";
export function draftInboxSuggestion(lines: string[]) {
  return {
    subject: shorten(lines[0] ?? "", 60),
    preview: shorten(lines.slice(1).join(" ") || lines[0] || "", 150),
  };
}
export function inboxInsights(subject: string, preview: string) {
  const tips: string[] = [];
  if (subject.length > 60)
    tips.push(
      "The subject may be cut off on mobile. Aim for about 40–60 characters.",
    );
  if (preview.length > 150)
    tips.push(
      "Shorten the preview so its main point appears first in the inbox.",
    );
  if (
    subject.trim() &&
    preview.toLowerCase().startsWith(subject.toLowerCase().trim())
  )
    tips.push(
      "Use the preview to add a new detail rather than repeat the subject.",
    );
  if (/[!]{2,}|\b[A-Z]{5,}\b/.test(subject))
    tips.push(
      "Try sentence case and fewer exclamation marks for a calmer first impression.",
    );
  return tips;
}
