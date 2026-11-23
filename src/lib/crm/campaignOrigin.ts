/**
 * crm_campaigns.origin: how a newsletter was started. Written once when the
 * row is inserted (the database keeps it immutable afterwards).
 *
 * Format: `<kind>` or `<kind>:<reference>`, enforced by
 * crm_campaigns_origin_format_check (migration 20261123164736).
 */
export const CAMPAIGN_ORIGIN_KINDS = [
  "blank",
  "weekly_theme",
  "saved_template",
  "starter_template",
  "holiday",
  "persona",
  "duplicate",
  "review",
  "website_import",
  "ai",
  "calendar",
  "automation",
] as const;

export type CampaignOriginKind = (typeof CAMPAIGN_ORIGIN_KINDS)[number];

const ORIGIN_PATTERN = new RegExp(
  `^(${CAMPAIGN_ORIGIN_KINDS.join("|")})(:[A-Za-z0-9_.:-]{1,200})?$`,
);

/** Keeps only characters the database check allows in a reference. */
function sanitizeReference(reference: string) {
  return reference.replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 200);
}

export function buildCampaignOrigin(
  kind: CampaignOriginKind,
  reference?: string | number | null,
): string {
  const ref =
    reference === null || reference === undefined
      ? ""
      : sanitizeReference(String(reference).trim());
  return ref ? `${kind}:${ref}` : kind;
}

export function isValidCampaignOrigin(value: unknown): value is string {
  return typeof value === "string" && ORIGIN_PATTERN.test(value);
}

export function getCampaignOriginKind(
  origin: string | null | undefined,
): CampaignOriginKind | null {
  if (!isValidCampaignOrigin(origin)) return null;
  return origin.split(":")[0] as CampaignOriginKind;
}

/** Returns the origin only when it is well-formed, so a bad value never
 *  turns into a failed insert. */
export function normalizeCampaignOrigin(value: unknown): string | null {
  return isValidCampaignOrigin(value) ? value : null;
}
