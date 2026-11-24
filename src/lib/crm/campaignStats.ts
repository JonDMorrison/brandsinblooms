/**
 * One rollup for a sent email campaign's recipients, deliveries, opens and
 * clicks. Every surface (campaign list, report header, dashboard cards,
 * Reports > Overview and Bloom) reads it from the same database function,
 * get_email_campaign_reporting_snapshot, and maps it with this helper so the
 * numbers and rates always agree.
 *
 * The snapshot counts from the send ledger (email_messages) and tracking
 * events. Only when neither holds anything for a sent campaign does it fall
 * back to the stored crm_campaigns rollup; then `estimated` is true and the
 * UI must label the numbers "Estimated".
 *
 * Dependency-free so the Bloom edge function can import it too.
 */
export interface CampaignStats {
  recipients: number;
  delivered: number;
  opens: number;
  clicks: number;
  /** Percent (0-100) of delivered recipients who opened (reported opens). */
  openRate: number;
  /** Percent (0-100) of delivered recipients who clicked. */
  clickRate: number;
  /** True when the numbers come from the stored rollup, not send records. */
  estimated: boolean;
}

export const ESTIMATED_STATS_LABEL = "Estimated";
export const ESTIMATED_STATS_EXPLANATION =
  "No send records exist for this campaign, so these totals are the stored estimate.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Accepts either the RPC result ({ metrics: {...} }) or its `metrics` object
 * (as normalized by normalizeDerivedMetrics). Returns null when the value is
 * not a reporting snapshot.
 */
export function resolveCampaignStats(value: unknown): CampaignStats | null {
  if (!isRecord(value)) return null;
  const metrics = isRecord(value.metrics) ? value.metrics : value;
  const totals = metrics.totals;
  if (!isRecord(totals)) return null;
  const rates = isRecord(metrics.rates) ? metrics.rates : {};
  const diagnostics = isRecord(metrics.diagnostics) ? metrics.diagnostics : {};

  return {
    recipients: toNumber(totals.recipients),
    delivered: toNumber(totals.delivered),
    opens: toNumber(totals.opens),
    clicks: toNumber(totals.clicks),
    openRate: toNumber(rates.open_reported),
    clickRate: toNumber(rates.click),
    estimated: metrics.estimated === true || diagnostics.estimated === true,
  };
}
