import type { StudioBlock } from "../../../types/studioBlocks.ts";

/**
 * Click-to-edit for plain text on the Design Studio canvas.
 *
 * The canvas shows the same HTML the email will use. An element is editable
 * when its text is exactly the value of one plain-text field of its block.
 * That keeps one source of truth: the block. Nothing new is stored, and the
 * properties panel edits the same field.
 *
 * Left alone on purpose:
 * - rich text (paragraph bodies), which keeps its editor in the panel;
 * - text holding personalisation such as {{ first_name }}, shown as a chip
 *   on the canvas, so a tag cannot be broken by typing over it;
 * - computed text such as prices and formatted dates.
 */

export type InlineTextField =
  | "headline"
  | "subheading"
  | "tagLabel"
  | "tagline"
  | "buttonText"
  | "productName"
  | "productSubtitle"
  | "authorName"
  | "authorTitle"
  | "eventLocation"
  | "caption"
  | "dateLabel"
  | "secondaryLinkText"
  | "couponSizing";

/** Order matters when two fields hold the same words: the first one wins. */
export const INLINE_TEXT_FIELDS: ReadonlyArray<{ field: InlineTextField; label: string }> = [
  { field: "headline", label: "headline" },
  { field: "productName", label: "product name" },
  { field: "subheading", label: "subheading" },
  { field: "productSubtitle", label: "second line" },
  { field: "tagline", label: "tagline" },
  { field: "tagLabel", label: "small label" },
  { field: "buttonText", label: "button words" },
  { field: "secondaryLinkText", label: "link words" },
  { field: "authorName", label: "author name" },
  { field: "authorTitle", label: "author title" },
  { field: "eventLocation", label: "location" },
  { field: "dateLabel", label: "date" },
  { field: "caption", label: "caption" },
  { field: "couponSizing", label: "size or type" },
];

export const normalizeInlineText = (value: string) => value.replace(/\s+/g, " ").trim();

/** Fields of this block that can be edited on the canvas, keyed by their shown text. */
export function inlineEditableValues(block: StudioBlock): Map<string, { field: InlineTextField; label: string }> {
  const values = new Map<string, { field: InlineTextField; label: string }>();
  // The footer holds legal sender details and is edited in its panel only.
  if (block.type === "footer") return values;
  for (const entry of INLINE_TEXT_FIELDS) {
    const raw = block[entry.field];
    if (typeof raw !== "string") continue;
    // Multi-line values and personalisation are edited in the panel.
    if (raw.includes("\n") || /\{\{[^}]*\}\}/.test(raw)) continue;
    const key = normalizeInlineText(raw);
    if (key && !values.has(key)) values.set(key, entry);
  }
  return values;
}

/**
 * Marks the elements under `root` that show an editable field, and returns
 * how many were marked. Idempotent: safe to run after every render.
 */
export function markInlineEditableText(root: HTMLElement, block: StudioBlock): number {
  const values = inlineEditableValues(block);
  root.querySelectorAll<HTMLElement>("[data-nl-edit]").forEach((element) => {
    // An element being typed in keeps its mark until it is committed.
    if (element.isContentEditable) return;
    element.removeAttribute("data-nl-edit");
    element.removeAttribute("data-nl-edit-label");
    element.removeAttribute("tabindex");
    element.removeAttribute("role");
    element.removeAttribute("aria-label");
  });
  if (values.size === 0) return 0;
  const taken = new Set<InlineTextField>();
  let marked = 0;
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const candidates: HTMLElement[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) candidates.push(node as HTMLElement);
  for (const element of candidates) {
    if (element.closest("[data-newsletter-readonly]") || element.tagName === "IMG") continue;
    const entry = values.get(normalizeInlineText(element.textContent ?? ""));
    if (!entry || taken.has(entry.field)) continue;
    // Take the innermost element that holds exactly this text.
    const inner = Array.from(element.children).some(
      (child) => normalizeInlineText(child.textContent ?? "") === normalizeInlineText(element.textContent ?? ""),
    );
    if (inner) continue;
    // Text with markup inside it (bold, a link) is not a plain field.
    if (element.children.length > 0) continue;
    taken.add(entry.field);
    element.setAttribute("data-nl-edit", entry.field);
    element.setAttribute("data-nl-edit-label", entry.label);
    element.setAttribute("tabindex", "0");
    element.setAttribute("role", "textbox");
    element.setAttribute("aria-label", `Edit ${entry.label}`);
    marked += 1;
  }
  return marked;
}

/** Text typed on the canvas, as it will be saved: one line, no markup. */
export function inlineTextFromElement(element: HTMLElement): string {
  return (element.textContent ?? "").replace(/[\r\n]+/g, " ").replace(/ /g, " ").trim();
}
