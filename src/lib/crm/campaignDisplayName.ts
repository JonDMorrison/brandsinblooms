/**
 * Campaign names are optional. "Untitled Campaign" used to be stored as a
 * real name; now an unnamed draft stores "" and every screen (list, copy
 * picker, Studio title, Review & Send) shows one name: the stored name, then
 * the subject line, then the first content headline, then "Draft, <date>"
 * (Studio says "Untitled draft" instead; see `emptyLabel`). The newsletter
 * header's headline is the store name, so it is never used as a title.
 */
const PLACEHOLDER_NAME = /^(untitled campaign|campaign [0-9a-f]{8})$/i;

export function isUnsetCampaignName(name: string | null | undefined) {
  const trimmed = (name ?? "").trim();
  return trimmed.length === 0 || PLACEHOLDER_NAME.test(trimmed);
}

type BlockLike = { type?: string; headline?: unknown; visible?: boolean };

function plainText(value: unknown) {
  return typeof value === "string"
    ? value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()
    : "";
}

const draftDateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** The first headline a reader sees (not the header's store name). */
export function firstContentHeadline(blocks: ReadonlyArray<BlockLike> | null | undefined) {
  for (const block of blocks ?? []) {
    if (
      block.visible === false ||
      block.type === "footer" ||
      block.type === "newsletter-header"
    ) {
      continue;
    }
    const headline = plainText(block.headline);
    if (headline) return headline;
  }
  return "";
}

export function deriveCampaignDisplayName(input: {
  name?: string | null;
  subjectLine?: string | null;
  blocks?: ReadonlyArray<BlockLike> | null;
  /** Precomputed firstContentHeadline, for lists that do not hold blocks. */
  firstHeadline?: string | null;
  date?: string | Date | null;
  /** Shown instead of "Draft, <date>" when nothing else is set. */
  emptyLabel?: string;
}): string {
  if (!isUnsetCampaignName(input.name)) return (input.name ?? "").trim();

  const subject = plainText(input.subjectLine);
  if (subject) return subject;

  const headline = plainText(input.firstHeadline) || firstContentHeadline(input.blocks);
  if (headline) return headline;

  if (input.emptyLabel) return input.emptyLabel;

  const date =
    input.date instanceof Date
      ? input.date
      : input.date
        ? new Date(input.date)
        : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `Draft, ${draftDateFormat.format(safeDate)}`;
}
