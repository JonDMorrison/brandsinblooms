/**
 * Which segments an email campaign targets.
 *
 * The campaign editor reads a campaign's segments as crm_campaigns.segment_id
 * plus every campaign_segments row (src/lib/crm/campaignEditor.ts,
 * fetchCampaignEditorRecord) and saves segment_id as the first selected
 * segment, with campaign_segments rows for all of them when there are
 * several. The audience is the union of those segments, so the send worker
 * reads both sources and never stops at segment_id.
 *
 * private.email_campaign_audience_contacts applies the same union to the
 * editor's p_segment_ids (docs/email-eligibility.md).
 */

export interface CampaignSegmentLinkRow {
  segment_id: string | null;
}

/** segment_id first (legacy rows carry only that), then each link, deduplicated. */
export function mergeCampaignSegmentIds(
  legacySegmentId: string | null | undefined,
  links: ReadonlyArray<CampaignSegmentLinkRow> | null | undefined,
): string[] {
  const ids = new Set<string>();
  if (typeof legacySegmentId === "string" && legacySegmentId) ids.add(legacySegmentId);
  for (const link of links ?? []) {
    if (typeof link?.segment_id === "string" && link.segment_id) ids.add(link.segment_id);
  }
  return Array.from(ids);
}

// Structural so npm:, jsr: and esm.sh Supabase clients (typed or untyped)
// are all accepted (same approach as businessProfileUserId.ts). Only `from`
// is declared: matching the full query-builder chain against a generated
// client is too deep for the type checker.
export interface CampaignSegmentLinkReader {
  from(table: string): unknown;
}

interface CampaignSegmentLinkQuery {
  select(columns: string): {
    eq(column: string, value: string): PromiseLike<{
      data: CampaignSegmentLinkRow[] | null;
      error: unknown;
    }>;
  };
}

export async function resolveCampaignSegmentIds(
  supabase: CampaignSegmentLinkReader,
  campaign: { id: string; segment_id?: string | null },
): Promise<{ segmentIds: string[]; error: unknown | null }> {
  const links = supabase.from("campaign_segments") as CampaignSegmentLinkQuery;
  const { data, error } = await links.select("segment_id").eq("campaign_id", campaign.id);
  if (error) return { segmentIds: [], error };
  return { segmentIds: mergeCampaignSegmentIds(campaign.segment_id, data), error: null };
}
