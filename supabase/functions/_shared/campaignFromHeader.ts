// Single source of truth for the From-header display name and full
// "Display Name <email>" address used by both the live send path
// (send-email-campaign / process-email-send-queue) and the test-send
// path (send-test-email-v2). Keeping this in one place prevents the
// two paths from drifting on placeholder fallbacks (e.g. one rendering
// "Your Business <mail@...>" while the other renders the operator's
// actual sender_name) — the original Mother's Day test-send bug was
// exactly that kind of drift.

export interface CampaignFromHeaderInputs {
  // Per-campaign override the operator typed into the campaign UI.
  // Wins over every other source when non-empty.
  campaignSenderName?: string | null;

  // Domain-level default_from_name from email_domains.default_from_name
  // (live path) or senderConfig.fromName (test path). The literal
  // string "Your Business" is treated as not-set because senderResolver
  // falls back to that when the domain row has no default — surfacing
  // the placeholder in a real email is never intended.
  domainFromName?: string | null;

  // company_profiles.company_name as a meaningful tenant fallback.
  companyProfileName?: string | null;

  // Last-resort literal when nothing else is available.
  finalFallback?: string;
}

const PLACEHOLDER_FROM_NAMES = new Set(["Your Business", "Your Company"]);

export function resolveCampaignSenderDisplayName(
  inputs: CampaignFromHeaderInputs,
): string {
  const finalFallback = inputs.finalFallback ?? "BloomSuite";

  const trimmedCampaignName =
    typeof inputs.campaignSenderName === "string"
      ? inputs.campaignSenderName.trim()
      : "";
  if (trimmedCampaignName.length > 0) {
    return trimmedCampaignName;
  }

  const trimmedDomainName =
    typeof inputs.domainFromName === "string"
      ? inputs.domainFromName.trim()
      : "";
  if (
    trimmedDomainName.length > 0 &&
    !PLACEHOLDER_FROM_NAMES.has(trimmedDomainName)
  ) {
    return trimmedDomainName;
  }

  const trimmedProfileName =
    typeof inputs.companyProfileName === "string"
      ? inputs.companyProfileName.trim()
      : "";
  if (
    trimmedProfileName.length > 0 &&
    !PLACEHOLDER_FROM_NAMES.has(trimmedProfileName)
  ) {
    return trimmedProfileName;
  }

  return finalFallback;
}

export function buildCampaignFromAddress(
  inputs: CampaignFromHeaderInputs & { senderEmail: string },
): string {
  const displayName = resolveCampaignSenderDisplayName(inputs);
  return `${displayName} <${inputs.senderEmail}>`;
}
