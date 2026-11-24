/**
 * Campaign names are optional. "Untitled Campaign" used to be stored as a
 * real name; now an unnamed draft stores "" and every screen (list, copy
 * picker, Studio title, Review & Send) shows one name: the stored name, then
 * the subject line, then the first content headline, then "Draft, <date>"
 * (Studio says "Untitled draft" instead; see `emptyLabel`). The newsletter
 * header's headline is the store name, so it is never used as a title.
 *
 * "Draft, <date>" is only for drafts. A campaign that was sent, scheduled or
 * is sending falls back to "Campaign, <sent or scheduled date>". Merge tags
 * never show in a name (see stripMergeTags).
 */
const PLACEHOLDER_NAME = /^(untitled campaign|campaign [0-9a-f]{8})$/i;

export function isUnsetCampaignName(name: string | null | undefined) {
  const trimmed = (name ?? "").trim();
  return trimmed.length === 0 || PLACEHOLDER_NAME.test(trimmed);
}

type BlockLike = { type?: string; headline?: unknown; visible?: boolean };

function plainText(value: unknown) {
  return typeof value === "string"
    ? stripMergeTags(value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " "))
    : "";
}

const MERGE_TAG = /\{\{\s*([^}|]*?)\s*(?:\|\s*([^}]*?)\s*)?\}\}|\*\|\s*([A-Z0-9_]+)\s*\|\*/gi;
const FIRST_NAME_TAGS = new Set(["firstname", "fname", "customerfirstname"]);
const GREETING_BEFORE = /\b(hi|hello|hey|dear|welcome|thanks|thank you)[\s,]*$/i;

/**
 * Removes merge tags ({{ tag }}, {{ tag | fallback }}, *|TAG|*) from a
 * display string. A first-name tag after a greeting reads "there"
 * ("Hi {{ first_name }}!" becomes "Hi there!"); otherwise it is removed
 * ("Spring has arrived, {{ first_name }}" becomes "Spring has arrived").
 */
export function stripMergeTags(value: string) {
  return value
    .replace(MERGE_TAG, (match: string, tag: string | undefined, fallback: string | undefined, mailchimp: string | undefined, offset: number, whole: string) => {
      const key = (tag ?? mailchimp ?? "").toLowerCase().replace(/[^a-z]/g, "");
      if (FIRST_NAME_TAGS.has(key) && GREETING_BEFORE.test(whole.slice(0, offset))) {
        return fallback?.trim() || "there";
      }
      return "";
    })
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/[,;:](?=[,.!?;:])/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-\u2013\u2014]+/, "")
    .replace(/[\s,;:\-\u2013\u2014]+$/, "")
    .trim();
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
  /**
   * The campaign status. Only a draft (or a caller that does not know the
   * status) falls back to "Draft, <date>"; any other status uses
   * "Campaign, <sentAt or scheduledAt or date>".
   */
  status?: string | null;
  sentAt?: string | Date | null;
  scheduledAt?: string | Date | null;
  /** Shown instead of "Draft, <date>" when nothing else is set. */
  emptyLabel?: string;
}): string {
  if (!isUnsetCampaignName(input.name)) {
    const name = plainText(input.name);
    if (name) return name;
  }

  const subject = plainText(input.subjectLine);
  if (subject) return subject;

  const headline = plainText(input.firstHeadline) || firstContentHeadline(input.blocks);
  if (headline) return headline;

  const isDraft = !input.status || input.status === "draft";
  if (isDraft && input.emptyLabel) return input.emptyLabel;

  const rawDate = isDraft
    ? input.date
    : (input.sentAt ?? input.scheduledAt ?? input.date);
  const date =
    rawDate instanceof Date
      ? rawDate
      : rawDate
        ? new Date(rawDate)
        : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `${isDraft ? "Draft" : "Campaign"}, ${draftDateFormat.format(safeDate)}`;
}
