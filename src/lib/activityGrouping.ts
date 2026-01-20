import type { ActivityEvent } from "@/types/activity";

export type ActivityGroupMode = "none" | "campaign";

export function getCampaignId(event: ActivityEvent): string | null {
  const related: any = event.related_entities ?? {};
  const meta: any = event.metadata ?? {};

  return (
    related.campaign_id ??
    related.campaignId ??
    meta.campaign_id ??
    meta.campaignId ??
    null
  );
}

export function getCampaignName(event: ActivityEvent): string | null {
  const related: any = event.related_entities ?? {};
  const meta: any = event.metadata ?? {};

  return (
    related.campaign_name ??
    related.campaignName ??
    meta.campaign_name ??
    meta.campaignName ??
    null
  );
}

export interface CampaignGroup {
  campaignId: string;
  campaignName: string | null;
  events: ActivityEvent[];
}

export function groupEventsByCampaign(events: ActivityEvent[]): CampaignGroup[] {
  const groupsById = new Map<string, CampaignGroup>();
  const ordered: CampaignGroup[] = [];

  for (const ev of events) {
    const campaignId = getCampaignId(ev);
    if (!campaignId) continue;

    let group = groupsById.get(campaignId);
    if (!group) {
      group = {
        campaignId,
        campaignName: getCampaignName(ev),
        events: [],
      };
      groupsById.set(campaignId, group);
      ordered.push(group);
    }

    if (!group.campaignName) group.campaignName = getCampaignName(ev);
    group.events.push(ev);
  }

  return ordered;
}
