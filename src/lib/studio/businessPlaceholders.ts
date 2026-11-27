// Placeholder business details that older code wrote into company info and
// footer blocks ("Your Company", "123 Business St, Suite 100, City, State
// 12345"). They are never real, so they are treated as missing everywhere:
// a footer never shows them, and the sender checks count them as empty.
//
// No imports: this module is shared with Supabase Edge Functions.

const PLACEHOLDER_BUSINESS_NAMES = new Set([
  "your company",
  "your company name",
  "your business",
  "your business name",
  "your store",
  "your shop",
  "your garden centre",
  "your garden center",
  "company name",
  "business name",
  "my business",
  "my company",
]);

const PLACEHOLDER_ADDRESSES = new Set([
  "123 business st suite 100 city state 12345",
  "123 main st city state",
  "123 main st city province",
  "123 main street city state",
]);

function normalizeName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[.,!]+$/g, "")
    .replace(/\s+/g, " ");
}

function normalizeAddress(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s,.]+/g, " ")
    .trim();
}

/** True for a known placeholder business name ("Your Company", "Your Business"). */
export function isPlaceholderBusinessName(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return PLACEHOLDER_BUSINESS_NAMES.has(normalizeName(value));
}

/** The trimmed name, or "" when it is empty or a placeholder. */
export function realBusinessName(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && !isPlaceholderBusinessName(trimmed) ? trimmed : "";
}

/** True for a known placeholder postal address ("123 Business St, ..."). */
export function isPlaceholderAddress(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return PLACEHOLDER_ADDRESSES.has(normalizeAddress(value));
}

/** The trimmed address, or "" when it is empty or a placeholder. */
export function realPostalAddress(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed && !isPlaceholderAddress(trimmed) ? trimmed : "";
}

/** True when a copyright line was built from a placeholder name. */
export function hasPlaceholderCopyright(value: string | null | undefined): boolean {
  return typeof value === "string" && /\b(your company|your business)\b/i.test(value);
}

/**
 * The postal address a footer shows: the footer's own address, else the
 * business profile's. "" means the email has no postal address, which blocks
 * sending (CASL and CAN-SPAM require one).
 */
export function resolveFooterPostalAddress(
  footerAddress: string | null | undefined,
  profileAddress: string | null | undefined,
): string {
  return realPostalAddress(footerAddress) || realPostalAddress(profileAddress);
}

/** Readiness item and worker message for a missing postal address. */
export const MISSING_POSTAL_ADDRESS_MESSAGE =
  "Add your business address. Marketing email must include a postal address.";
