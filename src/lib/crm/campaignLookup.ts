/**
 * Shared by the campaign loaders and the campaign editor. Kept apart from
 * campaignEditor.ts so tests that replace the loaders still get the real
 * checks.
 */

// crm_campaigns.id is a Postgres uuid. Anything else in the address cannot
// name a campaign, so it is rejected before any request.
const CAMPAIGN_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isCampaignIdShaped(value: string | null | undefined): value is string {
  return typeof value === "string" && CAMPAIGN_ID_PATTERN.test(value);
}

/** No campaign with this id exists in the business being looked in. */
export class CampaignNotFoundError extends Error {
  readonly campaignId: string;

  constructor(campaignId: string) {
    super("Campaign not found");
    this.name = "CampaignNotFoundError";
    this.campaignId = campaignId;
  }
}
