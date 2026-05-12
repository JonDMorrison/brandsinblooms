import type { CampaignSegmentSummary } from "@/lib/crm/campaignEditor";

export const ALL_CONTACTS_SEGMENT_ID = "__ALL_CONTACTS__";

export const ALL_CONTACTS_SEGMENT_OPTION: CampaignSegmentSummary = {
  id: ALL_CONTACTS_SEGMENT_ID,
  name: "All Contacts",
  description: "Send to every customer in this tenant",
  customer_count: 0,
};

export function isAllContactsSegmentOption(
  option: CampaignSegmentSummary | null | undefined,
) {
  return Boolean(option && option.id === ALL_CONTACTS_SEGMENT_ID);
}
