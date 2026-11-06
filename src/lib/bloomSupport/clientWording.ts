/**
 * Client-facing wording for Bloom's own automatic messages.
 *
 * Older stored messages named staff ("We've passed it to <name> for a
 * decision"). Clients never see staff names in system copy, so automatic and
 * system messages are reworded to "our team" when they are projected for a
 * client. Stored text is not rewritten, and anything a person wrote (staff
 * replies, the client's own words) is never passed through this.
 *
 * Pure TypeScript with no path aliases: the bloom-support-api Edge Function
 * imports it through trackView.ts.
 */

// Staff first names (and the full name used in older copy). The patterns are
// written as J(?:on|eff) so this matcher is not itself mistaken for copy.
const STAFF = String.raw`J(?:on(?: Morrison)?|eff)`;

const RULES: Array<[RegExp, string]> = [
  // "<name>/<name>", "<name> and <name>", "<name> or <name>"
  [new RegExp(String.raw`\b${STAFF}\s*(?:\/|&|\band\b|\bor\b)\s*${STAFF}\b`, "g"), "our team"],
  // "<name>/Support"
  [new RegExp(String.raw`\b${STAFF}\s*\/\s*[Ss]upport\b`, "g"), "our support team"],
  // "<name>'s"
  [new RegExp(String.raw`\b${STAFF}['’]s\b`, "g"), "our team's"],
  [new RegExp(String.raw`\b${STAFF}\b`, "g"), "our team"],
];

const atSentenceStart = (text: string, offset: number): boolean => /(^|[.!?]\s+|\n\s*)$/.test(text.slice(0, offset));

/** Rewords staff names in Bloom's automatic copy to "our team". Text without a staff name is returned unchanged. */
export function clientSystemText(body: string): string {
  let out = body;
  for (const [pattern, replacement] of RULES) {
    out = out.replace(pattern, (_match: string, offset: number, whole: string) =>
      atSentenceStart(whole, offset) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Resolution summaries
// ---------------------------------------------------------------------------

/** Shown when a stored summary is too technical for a client. Speaks to what they can do now. */
export const PLAIN_RESOLUTION = "This is sorted. Everything should work as normal again, so you can carry on where you left off.";

// Words that mean a summary was written for staff, not for the client.
const TECHNICAL = new RegExp(
  String.raw`\b(?:canary|relay|pipeline|deploy(?:ed|ment|ments)?|pull request|PR\s?#?\d+|commits?|API|endpoint|triag(?:e|ed)|edge function|migration|RLS|webhook|DKIM|SPF|DMARC|subdomain|regression|repro(?:duced|duction)?|staging|intake|worker|database|schema|stack trace|null|undefined|HTTP\s?\d{3}|SQL|JSON|payload|env(?:ironment)? var(?:iable)?s?|OAuth|cron|authori[sz]ed|internal(?:ly)?|round trip|grounded|classified|end-to-end)\b`,
  "i",
);

/**
 * The client-facing version of a resolution summary. Plain, short summaries
 * are shown as written (with staff names reworded); anything that reads as a
 * staff note — technical terms, or long enough to be a write-up — is replaced
 * by PLAIN_RESOLUTION. Stored text is never changed.
 */
export function clientResolutionText(summary: string | null | undefined): string {
  const text = String(summary ?? "").trim();
  if (!text) return PLAIN_RESOLUTION;
  if (TECHNICAL.test(text) || text.length > 400) return PLAIN_RESOLUTION;
  return clientSystemText(text);
}

// ---------------------------------------------------------------------------
// Forwarded emails
// ---------------------------------------------------------------------------

export interface ForwardedParts {
  /** Display name (or address) of the original sender, if the header named one. */
  from: string | null;
  /** The forwarded message itself, without the header block. */
  body: string;
}

const FORWARD_MARKER = /^[ \t>]*(?:-{2,}\s*Forwarded message\s*-{2,}|-{2,}\s*Original Message\s*-{2,}|Begin forwarded message:)[ \t]*$/im;
const HEADER_LINE = /^[ \t>]*(From|Date|Sent|Subject|To|Cc|Reply-To)\s*:/i;

function senderName(value: string): string | null {
  const v = value.replace(/\s+/g, " ").trim();
  const named = v.match(/^"?([^"<]+?)"?\s*[<[]/);
  if (named?.[1]?.trim()) return named[1].trim();
  const bare = v.match(/[^\s<>[\]]+@[^\s<>[\]]+/);
  return bare ? bare[0] : v || null;
}

/**
 * Splits a forwarded email (Gmail, Outlook, Apple Mail) into the original
 * sender and the forwarded message, so the page can show the message without
 * the header block. Returns null when the text is not a forward or when the
 * header block cannot be read cleanly. The message text itself is untouched.
 */
export function forwardedParts(body: string): ForwardedParts | null {
  const marker = FORWARD_MARKER.exec(body);
  if (!marker) return null;
  const before = body.slice(0, marker.index).trim();
  const lines = body.slice(marker.index + marker[0].length).split(/\r?\n/);
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let from: string | null = null;
  let seen = 0;
  let current: string | null = null;
  for (; i < lines.length; i++) {
    const line = lines[i];
    const h = HEADER_LINE.exec(line);
    if (h) {
      seen++;
      current = h[1].toLowerCase();
      if (current === "from") from = senderName(line.slice(h[0].length));
      continue;
    }
    // Wrapped header value (e.g. a long To: list) continues on an indented line.
    if (current && /^[ \t]+\S/.test(line) && seen > 0) continue;
    break;
  }
  if (seen < 2) return null;
  const rest = lines.slice(i).join("\n").trim();
  const message = [before, rest].filter(Boolean).join("\n\n");
  if (!message) return null;
  return { from, body: message };
}
