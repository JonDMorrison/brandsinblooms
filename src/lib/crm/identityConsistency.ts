import { isPlaceholderBusinessName } from "@/lib/studio/businessPlaceholders";

/**
 * Pre-send identity check (warning only, never blocks a send): the sender
 * name, the sender email's domain, the footer business name and the name of
 * the website that inserted products should all point at the same business.
 */
const GENERIC_WORDS = new Set([
  "the", "and", "of", "garden", "gardens", "centre", "center", "centres",
  "centers", "nursery", "nurseries", "greenhouse", "greenhouses", "farm",
  "farms", "store", "shop", "co", "company", "inc", "ltd", "llc", "limited",
  "team", "from", "at", "your", "www", "com", "ca", "net", "org", "mail",
  "email", "info", "hello", "home",
]);

function coreTokens(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !GENERIC_WORDS.has(token));
}

function domainStem(value: string) {
  const host = value.includes("@") ? value.split("@").pop() ?? "" : value;
  let hostname = host;
  try {
    hostname = new URL(host.includes("://") ? host : `https://${host}`).hostname;
  } catch {
    hostname = host;
  }
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  return (parts.length > 1 ? parts.slice(0, -1).join("") : parts[0]).replace(/[^a-z0-9]/g, "");
}

const FREE_MAIL = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|aol|proton|protonmail|shaw|telus|rogers|sympatico)$/;

export interface IdentityInputs {
  senderName?: string | null;
  senderEmail?: string | null;
  /**
   * The footer block's business name. undefined/null when there is no
   * footer; an empty string or a placeholder ("Your Company") is a mismatch.
   */
  footerBusinessName?: string | null;
  websiteName?: string | null;
  websiteUrl?: string | null;
}

interface Identity {
  label: IdentityField;
  value: string;
  tokens: string[];
  stem?: string;
}

function agrees(a: Identity, b: Identity) {
  if (a.tokens.some((token) => b.tokens.includes(token))) return true;
  const stems = [a.stem, b.stem].filter(Boolean) as string[];
  const tokens = [...a.tokens, ...b.tokens];
  if (a.stem && b.stem) return a.stem === b.stem || a.stem.includes(b.stem) || b.stem.includes(a.stem);
  return stems.some((stem) => tokens.some((token) => stem.includes(token)));
}

/** Which identity a mismatch names. */
export type IdentityField =
  | "sender name"
  | "sender email domain"
  | "footer business name"
  | "website products source";

export interface IdentityMismatch {
  /** The two identities that disagree, in the order the message names them. */
  fields: [IdentityField, IdentityField];
  message: string;
}

/** Plain-language warnings for each pair of identities that disagree. */
export function findIdentityMismatches(inputs: IdentityInputs): string[] {
  return findIdentityMismatchDetails(inputs).map((mismatch) => mismatch.message);
}

/** The same warnings as findIdentityMismatches, with the fields each one names. */
export function findIdentityMismatchDetails(inputs: IdentityInputs): IdentityMismatch[] {
  const warnings: IdentityMismatch[] = [];
  // An empty or placeholder footer name never identifies the business, so it
  // never "agrees" with the sender: always warn (with the same fix button).
  if (typeof inputs.footerBusinessName === "string") {
    const footerName = inputs.footerBusinessName.trim();
    if (!footerName) {
      warnings.push({
        fields: ["sender name", "footer business name"],
        message: "The footer business name is empty. Customers may not recognise who this is from.",
      });
    } else if (isPlaceholderBusinessName(footerName)) {
      warnings.push({
        fields: ["sender name", "footer business name"],
        message: `The footer business name (“${footerName}”) is a placeholder, not your business name. Customers may not recognise who this is from.`,
      });
    }
  }

  const identities: Identity[] = [];
  const add = (label: IdentityField, value: string | null | undefined, stemSource?: string | null) => {
    const trimmed = (value ?? "").trim();
    const stem = stemSource ? domainStem(stemSource) : undefined;
    const tokens = coreTokens(trimmed);
    if (tokens.length === 0 && !stem) return;
    identities.push({ label, value: trimmed || stemSource || "", tokens, stem });
  };

  add("sender name", inputs.senderName);
  const senderDomain = (inputs.senderEmail ?? "").split("@")[1] ?? "";
  if (senderDomain && !FREE_MAIL.test(domainStem(senderDomain))) {
    add("sender email domain", "", senderDomain);
  }
  if (!isPlaceholderBusinessName(inputs.footerBusinessName)) {
    add("footer business name", inputs.footerBusinessName);
  }
  if (inputs.websiteName || inputs.websiteUrl) {
    add("website products source", inputs.websiteName ?? "", inputs.websiteUrl ?? null);
  }

  for (let i = 0; i < identities.length; i += 1) {
    for (let j = i + 1; j < identities.length; j += 1) {
      const a = identities[i];
      const b = identities[j];
      if (!agrees(a, b)) {
        warnings.push({
          fields: [a.label, b.label],
          message: `The ${a.label} (“${a.value}”) doesn’t match the ${b.label} (“${b.value}”). Customers may not recognise who this is from.`,
        });
      }
    }
  }
  return warnings;
}
