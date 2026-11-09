// Bloom Support — plain-English wording for staff-only notes Bloom writes.
// Pure string formatting: no I/O, no Deno globals, so the worker and the CRM
// UI share one source of truth for how triage reads to a person.

export interface TriageNoteInput {
  kind: string;
  priority: string;
  category: string;
  missing: string[];
  duplicateOf?: number | null;
}

const KIND_PHRASE: Record<string, string> = {
  question: "a question",
  bug: "a bug",
  change: "a change request",
  incident: "a possible incident",
  feature: "a feature idea",
  other: "an account or general request",
};

const PRIORITY_PHRASE: Record<string, string> = {
  low: "low priority",
  normal: "normal priority",
  high: "high priority",
  urgent: "urgent",
};

const words = (slug: string) => slug.replace(/[-_]+/g, " ").trim();

/** Ends a phrase with exactly one full stop, whatever punctuation it already had. */
export function asSentence(text: string): string {
  const trimmed = text.trim().replace(/[.\s]+$/, "");
  if (!trimmed) return "";
  return /[!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

/** "Bloom read this as a bug, high priority, about fundraising." plus what is missing and any duplicate. */
export function triageNoteText(c: TriageNoteInput): string {
  const parts = [
    c.kind === "unknown"
      ? "Bloom couldn't tell what kind of request this is yet"
      : `Bloom read this as ${KIND_PHRASE[c.kind] ?? `a ${words(c.kind)} request`}`,
  ];
  parts.push(PRIORITY_PHRASE[c.priority] ?? `${words(c.priority)} priority`);
  const category = words(c.category);
  if (category && category !== "general") parts.push(`about ${category}`);
  const lines = [asSentence(parts.join(", "))];
  const missing = c.missing.map((m) => m.trim()).filter(Boolean);
  if (missing.length) lines.push(asSentence(`Still needs from the client: ${missing.join("; ")}`));
  if (c.duplicateOf) lines.push(`Looks like the same issue as #${c.duplicateOf}.`);
  return lines.join(" ");
}

// Notes written before triageNoteText existed: "Triage (model): bug, high, fundraising; missing: …; likely same issue as #12".
const LEGACY_TRIAGE = /^Triage \((?:rules|model)\): ([a-z_]+), ([a-z_]+), ([a-z0-9_-]+)(?:; missing: (.*?))?(?:; likely same issue as #(\d+))?\s*$/s;

/** Rewrites Bloom's older machine-style notes into the same wording new notes use. Anything else is returned unchanged. */
export function humanizeStaffNote(body: string): string {
  const m = LEGACY_TRIAGE.exec(body);
  if (!m) return body;
  return triageNoteText({
    kind: m[1],
    priority: m[2],
    category: m[3],
    missing: m[4] ? m[4].split("; ") : [],
    duplicateOf: m[5] ? Number(m[5]) : null,
  });
}

/**
 * Staff conversations need a readable opening without rewriting their audit
 * history. Keep the exact original note in an expandable disclosure.
 *
 * Do not use an LLM or make guesses about progress: only the narrow verified
 * release pattern below gets a factual summary. Other long engineering notes
 * use a neutral description, and the original remains one click away.
 */
export function staffNotePresentation(body: string): { preview: string; original: string; collapsed: boolean } {
  const original = humanizeStaffNote(body);
  if (original.length <= 480) return { preview: original, original, collapsed: false };

  const technical = /(?:\bPR\s*#\d+|\bcommit\b|\bdeployment\b|\bRLS\b|\brollback\b|\benv(?:ironment)?\b|\bidempotenc\w*|\bShipStation\b|\bSQL\b|\bAPI\b)/i.test(original);
  if (!technical && original.length < 900) return { preview: original, original, collapsed: false };

  const optInOff = /recipient_opt_in\s*=\s*false|Horsford site opt-in was false/i.test(original);
  const checkoutOff = /shared_checkout_enabled(?:_v1)?\s*=\s*false|shared_checkout_enabled_v1 was false/i.test(original);
  const deployed = /\b(?:READY|production deployment|deployed)\b/i.test(original);
  const preview = optInOff && checkoutOff && deployed
    ? "The checkout update has been deployed, but the multi-recipient option is still switched off. It needs approval and live checkout, shipping and fulfilment checks before use."
    : "Detailed internal engineering update. Open the original note to see the technical evidence and outstanding checks.";

  return { preview, original, collapsed: true };
}

// Routing text written before support copy named roles instead of people
// ("Jon/Jeff: …", "Jon decides on the feature request", "Jeff/Support: …").
// Stored values stay as they are; staff views reword them when they render.
const LEGACY_ROUTING: Array<[RegExp, string]> = [
  [/^Needs Jon\/Jeff\b/, "Needs admin"],
  [/^Jon\/Jeff:\s*/, "Admin: "],
  [/^Jeff\/Support:\s*/, "Admin or Support: "],
  [/^Jon decides on the feature request\b/, "Admin decides on the feature request"],
];

/** Rewords Bloom's older people-named routing text (next actions) to role wording. Anything else is returned unchanged. */
export function humanizeNextAction(text: string): string {
  for (const [pattern, replacement] of LEGACY_ROUTING) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }
  return text;
}
