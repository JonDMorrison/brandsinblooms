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
const NON_CONTENT_BLOCKS = [
  "footer",
  "newsletter-header",
  "social-follow",
  "divider",
  "spacer",
];
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
        !NON_CONTENT_BLOCKS.includes(b.type),
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
// A salutation such as "Hi {{first_name}}," or "Good morning," at the start
// of a sentence. Preview text should carry news, never the greeting.
const GREETING_START =
  /^(?:hi|hiya|hello|hey|heya|dear|dearest|greetings|howdy|good\s+(?:morning|afternoon|evening|day))(?=$|[\s,!.:;—–])/i;
// The greeting itself: the greeting word, then up to four words or merge
// tags ("there", "Jane", "{{ first_name }}", "garden friends"), ending in
// punctuation. Whatever follows the punctuation is kept.
const SALUTATION =
  /^(?:hi|hiya|hello|hey|heya|dear|dearest|greetings|howdy|good\s+(?:morning|afternoon|evening|day))(?:\s+(?:\{\{[^}]*\}\}|[\p{L}\p{N}'’.-]+)){0,4}\s*[,!:;—–]+\s*/iu;

/** True when the text opens with a greeting ("Hi", "Hello", "Dear"...). */
export function startsWithGreeting(text: string) {
  return GREETING_START.test(text.replace(/^[\s"'“‘(]+/, ""));
}

/**
 * Removes greeting lines and greeting sentences from the start of the copy,
 * so the preview text opens with the next meaningful text. A salutation in
 * front of real news ("Hi Jane, our roses are in") keeps the news. Returns
 * "" when nothing but greetings is left.
 */
export function skipGreetingText(text: string): string {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  while (sentences.length > 0 && startsWithGreeting(sentences[0])) {
    const first = sentences[0].replace(/^[\s"'“‘(]+/, "");
    const rest = first.replace(SALUTATION, "");
    // "Good morning, gardeners!" is still only a greeting: a remainder of
    // two words or fewer is the person being addressed, not news.
    const isNews = rest.trim().split(/\s+/).length > 2;
    if (rest !== first && isNews && !startsWithGreeting(rest)) {
      sentences[0] = rest.charAt(0).toUpperCase() + rest.slice(1);
      break;
    }
    sentences.shift();
  }
  return sentences.join(" ");
}

// Body copy, in the order a block's text is read. Headlines are left to the
// subject line.
const BODY_TEXT_KEYS = ["body", "text", "content", "description"] as const;

/** The lines of body copy in the first block that has any, as plain text. */
function firstTextBlockLines(blocks: StudioBlock[]): string[] {
  for (const block of blocks) {
    if (block.visible === false || NON_CONTENT_BLOCKS.includes(block.type)) continue;
    const record = block as unknown as Record<string, unknown>;
    for (const key of BODY_TEXT_KEYS) {
      const value = record[key];
      if (typeof value !== "string") continue;
      // Paragraph and line breaks end a line of copy.
      const lines = value
        .replace(/<\/(p|div|h[1-6]|li)>|<br\s*\/?>/gi, "\n")
        .split("\n")
        .map(clean)
        .filter(Boolean);
      if (lines.length && !placeholder.test(lines.join(" "))) return lines;
    }
  }
  return [];
}

/**
 * Drafts preview text from the design: the first sentence of the first text
 * block, after any leading greeting ("Hi {{ first_name }},", "Good
 * morning,") is removed. Returns "" when nothing is left, so the field stays
 * empty rather than showing a greeting.
 */
export function draftPreviewText(blocks: StudioBlock[]): string {
  for (const line of firstTextBlockLines(blocks)) {
    const copy = skipGreetingText(line);
    if (!copy) continue;
    const firstSentence = copy.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
    return shorten(firstSentence, 150);
  }
  return "";
}

export function draftInboxSuggestion(lines: string[]) {
  // Greeting lines ("Hi {{first_name}},") are dropped and greeting sentences
  // are trimmed before anything is copied into the preview text.
  const previewLines = (candidates: string[]) =>
    candidates.map(skipGreetingText).filter(Boolean);
  const body = previewLines(lines.slice(1));
  // The first line doubles as the preview only when it is the only text.
  const fallback = lines.length === 1 ? previewLines(lines) : [];
  return {
    subject: shorten(lines[0] ?? "", 60),
    preview: shorten(body.join(" ") || fallback[0] || "", 150),
  };
}
/** Subject length guidance: 40 to 60 characters reads well on most phones. */
export function subjectLengthHint(length: number): {
  message: string;
  tone: "warning" | "success";
} {
  if (length < 40) return { message: "A little short. Aim for 40 to 60", tone: "warning" };
  if (length <= 60) return { message: "Good length", tone: "success" };
  return { message: "May be cut off on phones", tone: "warning" };
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
