/**
 * Campaign names are optional. "Untitled Campaign" used to be stored as a
 * real name; now an unnamed draft stores "" and every screen shows a name
 * derived from the subject line, then the first headline, then
 * "Draft, <date>".
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

export function deriveCampaignDisplayName(input: {
  name?: string | null;
  subjectLine?: string | null;
  blocks?: ReadonlyArray<BlockLike> | null;
  date?: string | Date | null;
}): string {
  if (!isUnsetCampaignName(input.name)) return (input.name ?? "").trim();

  const subject = plainText(input.subjectLine);
  if (subject) return subject;

  for (const block of input.blocks ?? []) {
    if (block.visible === false || block.type === "footer") continue;
    const headline = plainText(block.headline);
    if (headline) return headline;
  }

  const date =
    input.date instanceof Date
      ? input.date
      : input.date
        ? new Date(input.date)
        : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return `Draft, ${draftDateFormat.format(safeDate)}`;
}
