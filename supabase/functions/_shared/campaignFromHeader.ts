// Single source of truth for the From-header display name and full
// "Display Name <email>" address used by the campaign live send path
// (send-email-campaign / process-email-send-queue), the test-send path
// (send-test-email-v2) and, through senderResolver, every automation and
// transactional email. Keeping this in one place prevents the paths from
// drifting on placeholder fallbacks (e.g. one rendering
// "Your Business <mail@...>" while the other renders the operator's
// actual sender_name) — the original Mother's Day test-send bug was
// exactly that kind of drift.
//
// Placeholder business names ("Your Business", "Your Company", ...) are
// never real, so every source below treats them as unset
// (src/lib/studio/businessPlaceholders.ts, shared with the app).

import { realBusinessName } from "../../../src/lib/studio/businessPlaceholders.ts";

export interface CampaignFromHeaderInputs {
  // Per-campaign override the operator typed into the campaign UI.
  // Wins over every other source when non-empty.
  campaignSenderName?: string | null;

  // Domain-level default_from_name from email_domains.default_from_name
  // (live path) or senderConfig.fromName (test path).
  domainFromName?: string | null;

  // company_profiles.company_name of the tenant's business profile.
  companyProfileName?: string | null;

  // tenants.name, then tenants.fallback_from_name, when the business
  // profile has no real name.
  tenantName?: string | null;
  tenantFallbackFromName?: string | null;

  // Last-resort literal when nothing else is available. Pass "" to get ""
  // back (the caller then sends with a bare address, no display name).
  finalFallback?: string;
}

export function resolveCampaignSenderDisplayName(
  inputs: CampaignFromHeaderInputs,
): string {
  return (
    realBusinessName(inputs.campaignSenderName) ||
    realBusinessName(inputs.domainFromName) ||
    realBusinessName(inputs.companyProfileName) ||
    realBusinessName(inputs.tenantName) ||
    realBusinessName(inputs.tenantFallbackFromName) ||
    (inputs.finalFallback ?? "BloomSuite")
  );
}

export function buildCampaignFromAddress(
  inputs: CampaignFromHeaderInputs & { senderEmail: string },
): string {
  const displayName = resolveCampaignSenderDisplayName(inputs);
  return displayName
    ? `${displayName} <${inputs.senderEmail}>`
    : inputs.senderEmail;
}
