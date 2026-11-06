/**
 * Bloom Support public tracking page (/support/track/:token) — the contract
 * shared by the bloom-support-api Edge Function and the page.
 *
 * Pure TypeScript: no Deno or browser globals, no path aliases, so the Edge
 * Function can import it directly and vitest can test it.
 *
 * Server side, `sanitizeTrackView` is the last gate before the response leaves
 * the Edge Function: it rebuilds the payload field by field from an allow-list,
 * so a database change that adds a field (an internal note, a staff name, an
 * internal status) cannot reach the public page without a change here too.
 */
import { clientSystemText } from "./clientWording.ts";

export type TrackStatus = "received" | "in_progress" | "waiting_on_you" | "resolved";
export type TrackKind = "fix" | "help" | "idea";
export type TrackAuthor = "customer" | "team" | "system";
export type TrackPurpose = "acknowledgement" | "progress" | "reply" | "clarification" | "resolution" | "notification";

export interface TrackAttachment {
  id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export interface TrackMessage {
  id: string;
  author: TrackAuthor;
  name: string;
  automatic: boolean;
  purpose: TrackPurpose | null;
  body: string;
  created_at: string;
  attachments: TrackAttachment[];
}

export interface TrackSupportHours {
  days: number[];
  start: string;
  end: string;
  timezone: string;
}

export interface TrackCompany {
  name: string;
  /** Chosen by clientLogoUrl on the server; https only. */
  logo_url: string | null;
  /** Chosen by clientWebsite on the server; https only. */
  website: string | null;
}

export interface TrackView {
  state: "ok";
  number: number;
  subject: string;
  product: string;
  kind: TrackKind;
  status: TrackStatus;
  step: 1 | 2 | 3 | 4;
  progress: string;
  created_at: string;
  last_activity_at: string;
  resolved_at: string | null;
  resolution_summary: string | null;
  confirmed: boolean;
  merged_into_number: number | null;
  requester_name: string | null;
  company: TrackCompany | null;
  can_reply: boolean;
  can_confirm: boolean;
  can_reopen: boolean;
  reply_expected_by: string | null;
  support_hours: TrackSupportHours | null;
  link_expires_at: string | null;
  attachments: TrackAttachment[];
  messages: TrackMessage[];
}

export interface TrackExpired {
  state: "expired";
}

export type TrackResponse = TrackView | TrackExpired;

/** Tracking tokens are 24 random bytes, base64url (32 characters). Older formats stay accepted. */
export const TRACK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,80}$/;
export const TRACK_REPLY_MIN = 2;
export const TRACK_REPLY_MAX = 5000;
export const TRACK_MAX_FILES = 3;
export const TRACK_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const TRACK_MAX_TOTAL_BYTES = 12 * 1024 * 1024;
/** Base64 of 12 MiB plus the JSON envelope. */
export const TRACK_MAX_REQUEST_BYTES = 17 * 1024 * 1024;

export const isTrackToken = (token: unknown): token is string => typeof token === "string" && TRACK_TOKEN_PATTERN.test(token);

const STATUSES: readonly TrackStatus[] = ["received", "in_progress", "waiting_on_you", "resolved"];
const KINDS: readonly TrackKind[] = ["fix", "help", "idea"];
const AUTHORS: readonly TrackAuthor[] = ["customer", "team", "system"];
const PURPOSES: readonly TrackPurpose[] = ["acknowledgement", "progress", "reply", "clarification", "resolution", "notification"];
const PRODUCTS = new Set(["cms", "crm", "pos", "platform", "unknown"]);

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown, max: number): string | null => (typeof v === "string" ? v.slice(0, max) : null);
const isoDate = (v: unknown): string | null => {
  if (typeof v !== "string" || v.length > 40) return null;
  return Number.isNaN(Date.parse(v)) ? null : v;
};
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  (allowed as readonly unknown[]).includes(v) ? (v as T) : fallback;
const bool = (v: unknown): boolean => v === true;
const uuid = (v: unknown): string | null =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v.toLowerCase() : null;

function sanitizeAttachments(v: unknown): TrackAttachment[] {
  if (!Array.isArray(v)) return [];
  const out: TrackAttachment[] = [];
  for (const a of v) {
    if (!isObject(a)) continue;
    const id = uuid(a.id);
    const name = text(a.file_name, 200);
    if (!id || !name) continue;
    out.push({
      id,
      file_name: name,
      content_type: text(a.content_type, 100) ?? "application/octet-stream",
      size_bytes: typeof a.size_bytes === "number" && Number.isFinite(a.size_bytes) ? Math.max(0, Math.round(a.size_bytes)) : 0,
    });
  }
  return out;
}

function sanitizeMessage(m: unknown): TrackMessage | null {
  if (!isObject(m)) return null;
  // An unknown author is dropped rather than guessed: only the three public roles render.
  if (!(AUTHORS as readonly unknown[]).includes(m.author)) return null;
  const id = uuid(m.id);
  const body = text(m.body, 50_000);
  const createdAt = isoDate(m.created_at);
  if (!id || body === null || !createdAt) return null;
  const author = m.author as TrackAuthor;
  const automatic = author !== "customer" && bool(m.automatic);
  return {
    id,
    author,
    // Team members are always "Bloom Support" on this page, whatever the source says.
    name: author === "team" ? "Bloom Support" : author === "system" ? "Bloom" : (text(m.name, 80)?.trim() || "You"),
    automatic,
    purpose: author === "customer" ? null : (PURPOSES as readonly unknown[]).includes(m.purpose) ? (m.purpose as TrackPurpose) : null,
    // Bloom's own automatic copy never names staff; anything a person wrote is shown as written.
    body: automatic || author === "system" ? clientSystemText(body) : body,
    created_at: createdAt,
    attachments: sanitizeAttachments(m.attachments),
  };
}

/**
 * Last-gate check only: the Edge Function has already chosen the website and
 * logo with clientWebsite / clientLogoUrl (supabase/functions/_shared/bloom-support/botanical-email.ts).
 * Here anything that is not an absolute https URL without credentials is dropped.
 */
export function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 2048) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}

/** "https://www.example.com/" → "example.com" */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function sanitizeCompany(v: unknown): TrackCompany | null {
  if (!isObject(v)) return null;
  const name = text(v.name, 200)?.trim();
  if (!name) return null;
  return { name, logo_url: safeHttpsUrl(v.logo_url), website: safeHttpsUrl(v.website) };
}

function sanitizeHours(v: unknown): TrackSupportHours | null {
  if (!isObject(v)) return null;
  const days = Array.isArray(v.days) ? v.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 7) : [];
  const start = text(v.start, 5);
  const end = text(v.end, 5);
  const timezone = text(v.timezone, 64);
  if (!days.length || !start || !end || !timezone || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  return { days, start, end, timezone };
}

/**
 * Rebuild the tracking payload from an allow-list. Returns null for anything
 * that is not a recognisable ticket view (the caller answers 404).
 */
export function sanitizeTrackView(raw: unknown): TrackResponse | null {
  if (!isObject(raw)) return null;
  if (raw.state === "expired") return { state: "expired" };
  const number = typeof raw.number === "number" && Number.isInteger(raw.number) ? raw.number : null;
  const subject = text(raw.subject, 300);
  const createdAt = isoDate(raw.created_at);
  if (number === null || subject === null || !createdAt) return null;
  const status = pick(raw.status, STATUSES, "in_progress");
  const stepRaw = typeof raw.step === "number" ? Math.round(raw.step) : 2;
  const step = (status === "resolved" ? 4 : Math.min(3, Math.max(1, stepRaw))) as TrackView["step"];
  const messages = Array.isArray(raw.messages) ? raw.messages.map(sanitizeMessage).filter((m): m is TrackMessage => m !== null) : [];
  const resolved = status === "resolved";
  return {
    state: "ok",
    number,
    subject,
    product: typeof raw.product === "string" && PRODUCTS.has(raw.product) ? raw.product : "unknown",
    kind: pick(raw.kind, KINDS, "help"),
    status,
    step,
    progress: text(raw.progress, 300) ?? "",
    created_at: createdAt,
    last_activity_at: isoDate(raw.last_activity_at) ?? createdAt,
    resolved_at: resolved ? isoDate(raw.resolved_at) : null,
    resolution_summary: resolved ? text(raw.resolution_summary, 5000) : null,
    confirmed: resolved && bool(raw.confirmed),
    merged_into_number: typeof raw.merged_into_number === "number" && Number.isInteger(raw.merged_into_number) ? raw.merged_into_number : null,
    requester_name: text(raw.requester_name, 80)?.trim() || null,
    company: sanitizeCompany(raw.company),
    can_reply: !resolved && bool(raw.can_reply),
    can_confirm: resolved && bool(raw.can_confirm),
    can_reopen: resolved && bool(raw.can_reopen),
    reply_expected_by: resolved ? null : isoDate(raw.reply_expected_by),
    support_hours: sanitizeHours(raw.support_hours),
    link_expires_at: isoDate(raw.link_expires_at),
    attachments: sanitizeAttachments(raw.attachments),
    messages,
  };
}

// ---------------------------------------------------------------------------
// Reply validation (page and Edge Function use the same rules)
// ---------------------------------------------------------------------------
export interface TrackReplyFile {
  file_name: string;
  content_type: string;
  data_base64: string;
}
export interface TrackReplyInput {
  body: string;
  idempotency_key: string;
  attachments: TrackReplyFile[];
}
export type TrackReplyValidation = { ok: true; value: TrackReplyInput } | { ok: false; error: string };

/** Decoded size of a base64 string without decoding it. */
export function base64ByteLength(b64: string): number {
  const clean = b64.replace(/^data:[^,]*;base64,/i, "").replace(/\s+/g, "");
  const padding = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function validateTrackReply(input: unknown): TrackReplyValidation {
  if (!isObject(input)) return { ok: false, error: "Send a message." };
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (body.length < TRACK_REPLY_MIN) return { ok: false, error: "Write a little more before sending." };
  if (body.length > TRACK_REPLY_MAX) return { ok: false, error: `Messages can be up to ${TRACK_REPLY_MAX.toLocaleString("en-US")} characters.` };
  const key = typeof input.idempotency_key === "string" ? input.idempotency_key : "";
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) return { ok: false, error: "This message could not be sent. Refresh and try again." };
  const rawFiles = input.attachments === undefined ? [] : input.attachments;
  if (!Array.isArray(rawFiles)) return { ok: false, error: "Attachments were not readable." };
  if (rawFiles.length > TRACK_MAX_FILES) return { ok: false, error: `Attach up to ${TRACK_MAX_FILES} files per message.` };
  const attachments: TrackReplyFile[] = [];
  let total = 0;
  for (const f of rawFiles) {
    if (!isObject(f) || typeof f.file_name !== "string" || typeof f.content_type !== "string" || typeof f.data_base64 !== "string") {
      return { ok: false, error: "Attachments were not readable." };
    }
    const size = base64ByteLength(f.data_base64);
    if (size === 0 || size > TRACK_MAX_FILE_BYTES) return { ok: false, error: "Files must be 8 MB or smaller." };
    total += size;
    if (total > TRACK_MAX_TOTAL_BYTES) return { ok: false, error: "Attachments must total 12 MB or less." };
    attachments.push({ file_name: f.file_name, content_type: f.content_type, data_base64: f.data_base64 });
  }
  return { ok: true, value: { body, idempotency_key: key, attachments } };
}

// ---------------------------------------------------------------------------
// Timeline: collapse Bloom's automatic notes into quiet events
// ---------------------------------------------------------------------------
export type TimelineItem =
  | { type: "message"; message: TrackMessage }
  | { type: "event"; id: string; title: string; details: string[]; at: string; count: number };

const isQuietNote = (m: TrackMessage): boolean =>
  m.author !== "customer" && m.automatic && m.attachments.length === 0 &&
  (m.purpose === "acknowledgement" || m.purpose === "progress" || m.purpose === "notification" || m.author === "system");

/**
 * Consecutive automatic acknowledgements and progress notes become one quiet
 * event ("We received your request"). Replies written for the customer —
 * including Bloom's own answers, clarifying questions and resolutions — stay
 * full messages, as does anything with a file.
 */
export function buildTimeline(messages: TrackMessage[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let group: TrackMessage[] = [];
  const flush = () => {
    if (!group.length) return;
    const hasAck = group.some((m) => m.purpose === "acknowledgement");
    const details = group
      .filter((m) => m.purpose !== "acknowledgement")
      .map((m) => m.body.trim())
      .filter((b, i, all) => b && all.indexOf(b) === i);
    items.push({
      type: "event",
      id: group[0].id,
      title: hasAck ? "We received your request" : "Update from Bloom Support",
      details,
      at: group[group.length - 1].created_at,
      count: group.length,
    });
    group = [];
  };
  for (const m of messages) {
    if (isQuietNote(m)) {
      group.push(m);
      continue;
    }
    flush();
    items.push({ type: "message", message: m });
  }
  flush();
  return items;
}

// ---------------------------------------------------------------------------
// Plain-language status
// ---------------------------------------------------------------------------
export interface StatusPresentation {
  headline: string;
  tone: "neutral" | "progress" | "action" | "success";
  steps: [string, string, string, string];
  next: string;
}

const STEPS: Record<TrackKind, [string, string, string, string]> = {
  fix: ["Received", "Looking into it", "Fixing", "Resolved"],
  help: ["Received", "Looking into it", "Working on it", "Resolved"],
  idea: ["Received", "Reviewing your idea", "Planning", "Decided"],
};

export function presentStatus(view: Pick<TrackView, "status" | "kind" | "confirmed" | "merged_into_number">): StatusPresentation {
  const steps = STEPS[view.kind];
  if (view.merged_into_number !== null) {
    return {
      headline: `This continues in request #${view.merged_into_number}`,
      tone: "neutral",
      steps,
      next: `We joined this with request #${view.merged_into_number} so everything is in one place. Updates will come from that request.`,
    };
  }
  switch (view.status) {
    case "received":
      return {
        headline: "We've got your request",
        tone: "neutral",
        steps,
        next: "Your request is in the queue. We'll read it, work out what it needs, and email you as soon as we know more.",
      };
    case "waiting_on_you":
      return {
        headline: "We need a quick reply from you",
        tone: "action",
        steps,
        next: "We've asked you a question below. As soon as you answer, we'll pick this straight back up.",
      };
    case "resolved":
      return {
        headline: view.kind === "idea" ? "We've made a decision" : "All sorted",
        tone: "success",
        steps,
        next: view.confirmed
          ? "Thanks for confirming. If anything changes, you can still reply here or to any email about this request."
          : "Please check it on your side. If anything still isn't right, tell us and we'll reopen it straight away.",
      };
    default:
      return {
        headline: view.kind === "idea" ? "We're reviewing your idea" : "We're working on it",
        tone: "progress",
        steps,
        next: view.kind === "idea"
          ? "Your idea is with the people who decide what we build next. We'll let you know what we decide."
          : "There's nothing you need to do right now. We'll email you when there's news, and every update also appears here.",
      };
  }
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function clock(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour}:${String(m).padStart(2, "0")}${suffix}` : `${hour}${suffix}`;
}

/** "Monday to Friday, 9am to 5pm (Toronto time)" */
export function formatSupportHours(hours: TrackSupportHours | null): string | null {
  if (!hours) return null;
  const days = [...new Set(hours.days.map((d) => d % 7))].sort((a, b) => a - b);
  const contiguous = days.every((d, i) => i === 0 || d === days[i - 1] + 1);
  const dayText = days.length === 1
    ? DAY_NAMES[days[0]]
    : contiguous
    ? `${DAY_NAMES[days[0]]} to ${DAY_NAMES[days[days.length - 1]]}`
    : days.map((d) => DAY_NAMES[d]).join(", ");
  const city = hours.timezone.split("/").pop()?.replace(/_/g, " ") ?? hours.timezone;
  return `${dayText}, ${clock(hours.start)} to ${clock(hours.end)} (${city} time)`;
}
