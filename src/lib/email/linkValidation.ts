// The one check for a link typed into an email block (button, image, text
// link). The block settings panel, the editor's send checks and the email
// renderer all use it, so a link the panel accepts is a link the email sends.
//
// No app-alias imports and no dependencies: the email renderer imports this
// file, and edge functions load the renderer directly.

/** Shown under a link field whose value is not a usable link. */
export const LINK_FIELD_ERROR = "Enter a full link, like https://yourstore.com";

/** Shown when the value is a link that runs code (javascript:, data:, vbscript:). */
export const UNSAFE_LINK_ERROR =
  "This kind of link can't be used in an email. Enter a full link, like https://yourstore.com";

/**
 * Merge tags that stand for a whole link and that the send-time merge engine
 * fills in for each recipient (src/lib/mergeTagDefinitions.ts, and the legacy
 * names in mergeTagEngine's LEGACY_MAPPINGS). A link field may hold exactly
 * one of these. Other merge tags are not links.
 */
export const LINK_MERGE_TAGS: ReadonlySet<string> = new Set([
  "company.website",
  "system.unsubscribe_url",
  "system.preferences_url",
  "unsubscribe_url",
  "unsubscribeUrl",
]);

export type LinkKind = "web" | "email" | "phone" | "merge-tag";

export type LinkProblem = "empty" | "unsafe" | "invalid";

export type LinkValidation =
  | { status: "valid"; kind: LinkKind; href: string }
  | { status: LinkProblem; message: string };

const MERGE_TAG_VALUE = /^\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)*)\s*\}\}$/;
const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;
// A bare public domain ("shop.example.com", "www.shop.com/sale"). The same
// shape the email renderer already turns into an https:// link.
const BARE_DOMAIN =
  /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,}(?::\d{2,5})?(?:[/?#][^\s]*)?$/i;
// A host name with a real top-level part ("shop.com", "xn--bcher-kva.ch").
const WEB_HOST = /^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+(?:[a-z]{2,63}|xn--[a-z\d-]{1,59})$/i;
// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARACTERS = /[\u0000-\u0020\u007f-\u009f<>"`\\]/;
// Characters browsers skip or treat as nothing when they read a scheme.
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u0020\u007f-\u00a0\u00ad\u1680\u180e\u2000-\u200f\u2028-\u202f\u205f-\u2064\u3000\ufeff]/g;
const DANGEROUS_SCHEME = /^(?:javascript|data|vbscript):/;
const EMAIL_ADDRESS = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const PHONE_NUMBER = /^\+?[\d().-]+$/;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  colon: ":",
  tab: "\t",
  newline: "\n",
  nbsp: " ",
  sol: "/",
  lpar: "(",
  rpar: ")",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const point =
        code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point < 0x110000
        ? String.fromCodePoint(point)
        : "";
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/**
 * The scheme a browser would see: entities and percent-escapes decoded (a few
 * rounds, for double encoding), invisible characters and whitespace removed,
 * lower-cased. Only for spotting a scheme; never sent anywhere.
 */
function revealScheme(raw: string): string {
  let value = raw;
  for (let round = 0; round < 4; round += 1) {
    let next = decodeEntities(value);
    try {
      next = decodeURIComponent(next);
    } catch {
      // A lone "%" is not an escape; keep what decoded so far.
    }
    if (next === value) break;
    value = next;
  }
  return value.replace(INVISIBLE, "").toLowerCase();
}

/** True for javascript:, data: and vbscript: links, however they are disguised. */
export function hasDangerousLinkScheme(raw: string | null | undefined): boolean {
  if (typeof raw !== "string" || !raw) return false;
  return DANGEROUS_SCHEME.test(revealScheme(raw));
}

/** True when the value is exactly one supported link merge tag. */
export function isLinkMergeTag(raw: string | null | undefined): boolean {
  if (typeof raw !== "string") return false;
  const match = MERGE_TAG_VALUE.exec(raw.trim());
  return Boolean(match && LINK_MERGE_TAGS.has(match[1]));
}

/**
 * What a link field keeps when the person leaves it: trimmed, and a bare
 * domain ("shop.example.com") becomes an https:// link. Anything else is kept
 * as typed so the person can see and fix it.
 */
export function normalizeLinkUrl(raw: string | null | undefined): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value || hasDangerousLinkScheme(value) || MERGE_TAG_VALUE.test(value)) return value;
  if (!HAS_SCHEME.test(value) && BARE_DOMAIN.test(value)) return `https://${value}`;
  return value;
}

function invalid(): LinkValidation {
  return { status: "invalid", message: LINK_FIELD_ERROR };
}

/**
 * Checks one link. Accepts https:// and http:// links with a real host,
 * mailto: with an address, tel: with a number, a bare domain (read as
 * https://), and the link merge tags above. Everything else is refused, and
 * javascript:, data: and vbscript: always are.
 */
export function validateLinkUrl(raw: string | null | undefined): LinkValidation {
  const entered = typeof raw === "string" ? raw.trim() : "";
  if (!entered) return { status: "empty", message: LINK_FIELD_ERROR };
  if (hasDangerousLinkScheme(entered)) {
    return { status: "unsafe", message: UNSAFE_LINK_ERROR };
  }

  const tag = MERGE_TAG_VALUE.exec(entered);
  if (tag) {
    return LINK_MERGE_TAGS.has(tag[1]) ? { status: "valid", kind: "merge-tag", href: entered } : invalid();
  }

  const value = normalizeLinkUrl(entered);
  if (FORBIDDEN_CHARACTERS.test(value)) return invalid();

  if (/^mailto:/i.test(value)) {
    const address = decodeURIComponentSafe(value.slice("mailto:".length).split("?")[0]);
    return EMAIL_ADDRESS.test(address) ? { status: "valid", kind: "email", href: value } : invalid();
  }

  if (/^tel:/i.test(value)) {
    const number = decodeURIComponentSafe(value.slice("tel:".length));
    const digits = number.replace(/\D/g, "");
    return PHONE_NUMBER.test(number) && digits.length >= 3
      ? { status: "valid", kind: "phone", href: value }
      : invalid();
  }

  if (!/^https?:\/\//i.test(value)) return invalid();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return invalid();
  }
  if (url.username || url.password) return invalid();
  if (url.protocol !== "https:" && url.protocol !== "http:") return invalid();
  if (!WEB_HOST.test(url.hostname)) return invalid();
  return { status: "valid", kind: "web", href: url.href };
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
