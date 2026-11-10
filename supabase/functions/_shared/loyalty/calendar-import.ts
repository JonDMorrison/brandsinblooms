import { assertDate } from "../customer-intelligence/purchase-exploration.ts";

export type CalendarChannel = "email" | "newsletter" | "sms" | "blog";
export interface CalendarMapping {
  title: string;
  date: string;
  channel: string | null;
  notes: string | null;
  theme: string | null;
}
export interface CalendarImportOptions {
  name: string;
  timezone: string;
  dateFormat: "iso" | "day_first" | "month_first" | "excel_1900" | "excel_1904";
  defaultChannel: CalendarChannel;
  headerRow?: number;
  sourceFilename?: string;
}
export interface CalendarItem {
  title: string;
  date: string;
  channel: CalendarChannel;
  notes: string;
  theme: string;
}
export interface CalendarPreviewRow {
  rowNumber: number;
  state: "accepted" | "duplicate" | "rejected";
  item: CalendarItem | null;
  fingerprint: string | null;
  errors: string[];
  original: Record<string, unknown>;
}
export interface CalendarImportPreview {
  version: 1;
  kind: "calendar_import";
  name: string;
  timezone: string;
  mapping: CalendarMapping;
  options: CalendarImportOptions;
  rows: CalendarPreviewRow[];
  counts: {
    source: number;
    accepted: number;
    duplicate: number;
    rejected: number;
  };
  digest: string;
  note: string;
}
const allowedChannels = ["email", "newsletter", "sms", "blog"] as const;
export const sha256 = async (value: string): Promise<string> =>
  [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export function strictRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${label} must be an object.`);
  return value as Record<string, unknown>;
}
function shortText(
  value: unknown,
  label: string,
  limit: number,
  required = false,
): string {
  if (typeof value !== "string") {
    if (value === null || value === undefined) value = "";
    else throw new Error(`${label} must contain text.`);
  }
  const text = (value as string).trim();
  if (text.length > limit || (required && !text))
    throw new Error(
      `${label} ${required ? "is required and " : ""}must be at most ${limit} characters.`,
    );
  return text;
}
export function parseCalendarOptions(value: unknown): CalendarImportOptions {
  const p = strictRecord(value, "Calendar options");
  if (
    Object.keys(p).some(
      (k) =>
        ![
          "name",
          "timezone",
          "dateFormat",
          "defaultChannel",
          "headerRow",
          "sourceFilename",
        ].includes(k),
    )
  )
    throw new Error("Unsupported calendar option.");
  const name = shortText(p.name, "Plan name", 120, true),
    timezone = shortText(p.timezone, "Timezone", 100, true);
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(0);
  } catch {
    throw new Error("Choose a valid business timezone.");
  }
  if (
    !["iso", "day_first", "month_first", "excel_1900", "excel_1904"].includes(
      String(p.dateFormat),
    )
  )
    throw new Error("Choose an explicit source date format.");
  if (!allowedChannels.includes(p.defaultChannel as CalendarChannel))
    throw new Error("Choose an available default channel.");
  const headerRow = p.headerRow === undefined ? 1 : p.headerRow;
  if (
    !Number.isInteger(headerRow) ||
    Number(headerRow) < 1 ||
    Number(headerRow) > 1000
  )
    throw new Error("Choose a valid source heading row.");
  const sourceFilename = shortText(p.sourceFilename, "Source filename", 240);
  return {
    name,
    timezone,
    dateFormat: p.dateFormat as CalendarImportOptions["dateFormat"],
    defaultChannel: p.defaultChannel as CalendarChannel,
    headerRow: Number(headerRow),
    sourceFilename,
  };
}
export function parseCalendarMapping(
  value: unknown,
  headings: string[],
): CalendarMapping {
  const p = strictRecord(value, "Column mapping");
  if (
    Object.keys(p).some(
      (k) => !["title", "date", "channel", "notes", "theme"].includes(k),
    )
  )
    throw new Error("Unsupported column mapping.");
  const result: CalendarMapping = {
    title: "",
    date: "",
    channel: null,
    notes: null,
    theme: null,
  };
  const used = new Set<string>();
  for (const key of Object.keys(result) as (keyof CalendarMapping)[]) {
    const selected = p[key];
    if (
      (selected === null || selected === "") &&
      !["title", "date"].includes(key)
    ) {
      result[key] = null as never;
      continue;
    }
    if (typeof selected !== "string" || !headings.includes(selected))
      throw new Error(`Choose an existing column for ${key}.`);
    if (used.has(selected))
      throw new Error("Map each source column to only one field.");
    used.add(selected);
    result[key] = selected;
  }
  return result;
}
export function parseCalendarDate(
  value: unknown,
  format: CalendarImportOptions["dateFormat"],
): string {
  let date: string;
  if (format === "excel_1900" || format === "excel_1904") {
    const n =
      typeof value === "number"
        ? value
        : typeof value === "string" && /^\d+(?:\.0+)?$/.test(value.trim())
          ? Number(value)
          : NaN;
    if (
      !Number.isSafeInteger(n) ||
      n < 1 ||
      n > 73415 ||
      (format === "excel_1900" && n === 60)
    )
      throw new Error(
        "Use a whole Excel date serial; time-of-day values and the fictitious 1900 leap day are not accepted.",
      );
    const offset = format === "excel_1904" ? n : n > 60 ? n - 1 : n;
    const epoch = Date.parse(
      format === "excel_1904" ? "1904-01-01T00:00:00Z" : "1899-12-31T00:00:00Z",
    );
    date = new Date(epoch + offset * 86400000).toISOString().slice(0, 10);
  } else {
    if (typeof value !== "string")
      throw new Error("The date must be text in the selected format.");
    const text = value.trim();
    if (format === "iso") date = text;
    else {
      const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
      if (!m)
        throw new Error(
          "The date does not match the selected day/month/year format.",
        );
      const day = format === "day_first" ? m[1] : m[2],
        month = format === "day_first" ? m[2] : m[1];
      date = `${m[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  assertDate(date);
  if (date < "2000-01-01" || date > "2100-12-31")
    throw new Error("Use a planning date between 2000 and 2100.");
  return date;
}
/** No model, HTML rendering, date guessing or send scheduling participates in importing a calendar. */
export async function previewCalendarImport(
  values: unknown,
  mappingValue: unknown,
  optionsValue: unknown,
  existingFingerprints: Set<string> = new Set(),
): Promise<CalendarImportPreview> {
  if (!Array.isArray(values) || values.length < 1 || values.length > 2000)
    throw new Error("Import between 1 and 2,000 rows at a time.");
  if (JSON.stringify(values).length > 2_000_000)
    throw new Error("The calendar data exceeds the 2 MB preview limit.");
  const source = values.map((v) => strictRecord(v, "Source row"));
  const headings = [...new Set(source.flatMap((r) => Object.keys(r)))];
  if (headings.length > 40 || headings.some((h) => h.length > 150))
    throw new Error("Use at most 40 named columns.");
  const options = parseCalendarOptions(optionsValue),
    mapping = parseCalendarMapping(mappingValue, headings);
  const seen = new Set(existingFingerprints),
    rows: CalendarPreviewRow[] = [];
  for (let i = 0; i < source.length; i++) {
    const original = source[i],
      errors: string[] = [];
    let item: CalendarItem | null = null,
      fingerprint: string | null = null;
    try {
      if (
        Object.values(original).some((v) => typeof v === "object" && v !== null)
      )
        throw new Error(
          "Formula or structured cells require review; only literal cell values can be imported.",
        );
      const title = shortText(original[mapping.title], "Title", 200, true);
      const date = parseCalendarDate(
        original[mapping.date],
        options.dateFormat,
      );
      const rawChannel = mapping.channel
        ? shortText(
            original[mapping.channel],
            "Channel",
            40,
            true,
          ).toLowerCase()
        : options.defaultChannel;
      if (!allowedChannels.includes(rawChannel as CalendarChannel))
        throw new Error(
          "Channel must be email, newsletter, SMS or blog. No retired social publishing is imported.",
        );
      const notes = mapping.notes
        ? shortText(original[mapping.notes], "Notes", 4000)
        : "";
      const theme = mapping.theme
        ? shortText(original[mapping.theme], "Theme", 200)
        : "";
      item = {
        title,
        date,
        channel: rawChannel as CalendarChannel,
        notes,
        theme,
      };
      fingerprint = await sha256(
        JSON.stringify([
          date,
          title,
          rawChannel,
          notes,
          theme,
          options.timezone,
        ]),
      );
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Invalid source row.");
    }
    const state = errors.length
      ? "rejected"
      : fingerprint && seen.has(fingerprint)
        ? "duplicate"
        : "accepted";
    if (fingerprint) seen.add(fingerprint);
    rows.push({
      rowNumber: i + (options.headerRow ?? 1) + 1,
      state,
      item,
      fingerprint,
      errors,
      original,
    });
  }
  const counts = {
    source: rows.length,
    accepted: rows.filter((r) => r.state === "accepted").length,
    duplicate: rows.filter((r) => r.state === "duplicate").length,
    rejected: rows.filter((r) => r.state === "rejected").length,
  };
  const digest = await sha256(JSON.stringify({ options, mapping, rows }));
  return {
    version: 1,
    kind: "calendar_import",
    name: options.name,
    timezone: options.timezone,
    mapping,
    options,
    rows,
    counts,
    digest,
    note: "Accepted rows become planned tasks in the existing calendar. This does not schedule messages, publish content or change customer consent.",
  };
}
