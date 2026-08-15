/**
 * Pre-send placeholder / scaffold detection.
 *
 * Born from the Flowerhouse incident (tenant 19c15e83…, campaign
 * 5727e21b…): a weekly newsletter was duplicated from the previous week and
 * sent to 244 real customers still containing scaffold headings ("Focus
 * Headline", "Voting Headline") and editorial notes ("(edit) …"). The
 * preview matched the send — nothing was broken in rendering; the gap was
 * that nothing warned the sender the content looked unfinished.
 *
 * These strings ship in no code template — they came from the tenant's own
 * duplicated-campaign lineage. So detection is pattern-based, not a lookup
 * against template defaults:
 *
 *  - Known scaffold headings (exact, case-insensitive)
 *  - Editorial-note markers: "(edit)", TODO, TBD, TK, "lorem ipsum",
 *    "placeholder", bracketed notes like "[add photo]"
 *
 * Deliberately conservative: better to miss an exotic marker than to nag on
 * every send. Findings produce a warning that requires explicit
 * acknowledgment in the send confirmation modal — never a hard block,
 * because false positives are possible ("TK" is a real florist abbreviation
 * somewhere, guaranteed).
 */

export interface PlaceholderFinding {
  /** The detected phrase, as found (trimmed, ≤80 chars). */
  phrase: string;
  /** Human label of the block it was found in ("Newsletter Header", …). */
  blockLabel: string;
}

/**
 * Loose structural view of a Studio content block — only the text-bearing
 * fields the scanner reads. Kept intentionally minimal so the scanner works
 * on both editor-context StudioBlocks and raw metadata.contentBlocks JSON.
 */
export interface ScannableBlock {
  label?: string | null;
  title?: string | null;
  headline?: string | null;
  subtitle?: string | null;
  subheading?: string | null;
  tagline?: string | null;
  body?: string | null;
  content?: string | null;
  ctaText?: string | null;
  buttonText?: string | null;
  visible?: boolean | null;
}

/**
 * Scaffold headings observed in the wild. Exact match after trim +
 * case-fold, so a real headline that merely CONTAINS one of these words
 * ("Our Focus This Month") never trips it.
 */
const SCAFFOLD_HEADINGS = [
  "focus headline",
  "voting headline",
  "section headline",
  "your headline here",
  "headline goes here",
  "add a headline",
  "add headline",
  "headline",
  "subheadline",
  "untitled section",
];

/**
 * Editorial-note markers. Matched against every text field, HTML stripped
 * first. Case-sensitivity chosen per marker: TODO/TK/TBD only in caps
 * (lowercase "tk"/"tbd" appear inside ordinary words), the others
 * case-insensitive.
 */
const NOTE_PATTERNS: Array<{ re: RegExp; describe: (match: string) => string }> = [
  { re: /\(edit\)[^.!?\n]{0,60}/gi, describe: (m) => m },
  { re: /\bTODO\b[^.!?\n]{0,60}/g, describe: (m) => m },
  { re: /\bTBD\b[^.!?\n]{0,40}/g, describe: (m) => m },
  { re: /\bTK\b[^.!?\n]{0,40}/g, describe: (m) => m },
  { re: /lorem ipsum[^.!?\n]{0,40}/gi, describe: (m) => m },
  { re: /\bplaceholder\b[^.!?\n]{0,40}/gi, describe: (m) => m },
  {
    re: /\[(?:edit|todo|tbd|add|insert|fill|placeholder|image|photo|link)[^\]]{0,60}\]/gi,
    describe: (m) => m,
  },
];

const MAX_FINDINGS = 8;
const MAX_PHRASE_LENGTH = 80;

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPhrase(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > MAX_PHRASE_LENGTH
    ? `${trimmed.slice(0, MAX_PHRASE_LENGTH - 1)}…`
    : trimmed;
}

/**
 * Scans a campaign's content blocks for likely-unfinished markers.
 * Returns up to MAX_FINDINGS findings, deduplicated by phrase.
 * Hidden blocks (`visible === false`) are skipped — they don't send.
 */
export function scanBlocksForPlaceholders(
  blocks: ReadonlyArray<ScannableBlock | null | undefined>,
): PlaceholderFinding[] {
  const findings: PlaceholderFinding[] = [];
  const seenPhrases = new Set<string>();

  const push = (phrase: string, blockLabel: string) => {
    const key = phrase.toLowerCase();
    if (seenPhrases.has(key) || findings.length >= MAX_FINDINGS) {
      return;
    }
    seenPhrases.add(key);
    findings.push({ phrase: clampPhrase(phrase), blockLabel });
  };

  for (const block of blocks) {
    if (!block || block.visible === false) {
      continue;
    }

    const blockLabel =
      (typeof block.label === "string" && block.label.trim()) || "Content block";

    // 1. Heading-type fields → exact scaffold-heading match.
    const headingFields = [
      block.title,
      block.headline,
      block.subtitle,
      block.subheading,
    ];
    for (const raw of headingFields) {
      if (typeof raw !== "string") continue;
      const normalized = stripHtml(raw).toLowerCase();
      if (normalized && SCAFFOLD_HEADINGS.includes(normalized)) {
        push(stripHtml(raw), blockLabel);
      }
    }

    // 2. All text fields → editorial-note patterns.
    const textFields = [
      block.title,
      block.headline,
      block.subtitle,
      block.subheading,
      block.tagline,
      block.body,
      block.content,
      block.ctaText,
      block.buttonText,
    ];
    for (const raw of textFields) {
      if (typeof raw !== "string" || !raw) continue;
      const text = stripHtml(raw);
      if (!text) continue;

      for (const { re, describe } of NOTE_PATTERNS) {
        re.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
          push(describe(match[0]), blockLabel);
          if (findings.length >= MAX_FINDINGS) {
            return findings;
          }
        }
      }
    }
  }

  return findings;
}

/**
 * One user-facing line per finding, for the send-confirmation warning list.
 */
export function formatPlaceholderFindings(
  findings: PlaceholderFinding[],
): string[] {
  return findings.map(
    (finding) => `“${finding.phrase}” in ${finding.blockLabel}`,
  );
}

// ─── Duplicate-flow date hygiene ─────────────────────────────────────────

/**
 * Block fields that carry a human-readable issue date on newsletter-header
 * blocks. The clone flow copies metadata verbatim, which is how Flowerhouse
 * sent a July 31 campaign with "July 24 2026" in the visible header.
 */
const HEADER_DATE_FIELDS = ["dateLabel", "publishDate"] as const;

export function formatHeaderDate(now: Date): string {
  return now.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Returns a copy of `blocks` (raw metadata JSON shape) with any populated
 * header-date fields refreshed to `now`. Blocks without date fields pass
 * through untouched; empty date fields stay empty (the creator never set
 * one, so we don't invent one).
 */
export function refreshHeaderDates<T extends Record<string, unknown>>(
  blocks: ReadonlyArray<T>,
  now: Date = new Date(),
): T[] {
  const formatted = formatHeaderDate(now);

  return blocks.map((block) => {
    if (!block || typeof block !== "object") {
      return block;
    }

    let changed = false;
    const next: Record<string, unknown> = { ...block };

    for (const field of HEADER_DATE_FIELDS) {
      const value = next[field];
      if (typeof value === "string" && value.trim().length > 0) {
        next[field] = formatted;
        changed = true;
      }
    }

    return changed ? (next as T) : block;
  });
}

// ─── Subject-line merge-token hygiene ────────────────────────────────────

/**
 * Mirror of the send-time merge-tag matcher in
 * `supabase/functions/_shared/mergeTagEngine.ts` (MERGE_TAG_REGEX).
 * Anything the engine matches gets rendered per-recipient at send time —
 * verified against production: campaign b9b89a2b… delivered 1,245
 * personalized subjects ("…ready for John/Mark/…"), zero literal tokens.
 *
 * The residual exposure is a MALFORMED token the engine can't match —
 * "{{ first-name }}" (hyphen), "{{first name}}" (space inside the field),
 * or an unclosed "{{first_name". Those pass through renderMergeTags
 * untouched and reach every recipient literally. That's what this check
 * flags. Well-formed tokens are deliberately NOT flagged — they work.
 */
const WELL_FORMED_MERGE_TAG_RE =
  /\{\{\s*[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*\s*(?:\|\s*default:\s*["'][^"']*["'])?\s*\}\}/g;

/**
 * Returns user-facing warning lines for brace sequences in the subject line
 * that the merge engine will NOT render — i.e. text that would reach every
 * recipient literally. Returns [] for subjects with no braces or with only
 * well-formed tokens.
 */
export function scanSubjectForUnrenderedTokens(
  subject: string | null | undefined,
): string[] {
  if (
    typeof subject !== "string" ||
    (!subject.includes("{") && !subject.includes("}"))
  ) {
    return [];
  }

  // Remove every well-formed token; whatever brace syntax survives is
  // unrenderable and will be delivered literally.
  const leftover = subject.replace(WELL_FORMED_MERGE_TAG_RE, "");
  if (!/\{\{|\}\}/.test(leftover)) {
    return [];
  }

  // Pull the offending snippets for the warning message: any {{...}}-ish
  // run, or a dangling {{ / }} with a bit of context.
  const snippets = new Set<string>();
  const braceRun = /\{\{[^}]{0,50}(?:\}\}|\}|$)|[^{]{0,20}\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = braceRun.exec(leftover)) !== null) {
    const snippet = match[0].trim();
    if (snippet) {
      snippets.add(clampPhrase(snippet));
    }
    if (snippets.size >= 3) break;
  }

  const detail =
    snippets.size > 0 ? ` (${Array.from(snippets).join(", ")})` : "";
  return [
    `The subject line contains a personalization tag that won't render${detail}. Every recipient would see it exactly as typed — check the tag's spelling and braces.`,
  ];
}
