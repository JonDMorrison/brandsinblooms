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
