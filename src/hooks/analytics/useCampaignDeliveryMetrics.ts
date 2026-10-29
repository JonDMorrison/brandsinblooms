import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { normalizeEmailCampaignReportingSnapshot } from "./useCampaignDerivedMetrics";

export interface DeliveryMetrics {
  campaignId: string;
  campaignName: string;
  sentAt: string | null;

  // Cached values from crm_campaigns
  cachedTotalSent: number;
  cachedOpenRate: number;
  cachedClickRate: number;

  // Computed values from email_send_jobs
  computedDelivered: number;
  computedFailed: number;
  computedEnqueued: number;
  batchCount: number;

  // Skip breakdown from email_send_skips
  skipsTotal: number;
  skipsByReason: {
    opt_out: number;
    suppressed: number;
    invalid_email: number;
    other: number;
  };

  // Engagement (from tracking events or cached)
  totalOpens: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;

  // Flags
  isStale: boolean; // computed != cached
  metricsDiscrepancy: number; // percentage difference
}

interface UseCampaignDeliveryMetricsResult {
  campaigns: DeliveryMetrics[];
  loading: boolean;
  error: string | null;
  summary: {
    totalCampaigns: number;
    totalDelivered: number;
    totalSkipped: number;
    totalFailed: number;
    avgOpenRate: number;
    avgClickRate: number;
  };
  recomputeAll: () => Promise<void>;
  recomputeCampaign: (campaignId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCampaignDeliveryMetrics = (
  dateRange: number = 30,
  options?: { enabled?: boolean },
): UseCampaignDeliveryMetricsResult => {
  const { tenant } = useTenant();
  const [campaigns, setCampaigns] = useState<DeliveryMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!tenant?.id || options?.enabled === false) {
      setCampaigns([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the effective tenant, including a master admin's selected business.
      const tenantId = tenant.id;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - dateRange);

      // Fetch sent campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("crm_campaigns")
        .select(
          "id, name, sent_at, total_sent, total_opens, total_clicks, open_rate, click_rate",
        )
        .eq("tenant_id", tenantId)
        .in("status", ["sent", "sent_with_errors"])
        .gte("sent_at", startDate.toISOString())
        .order("sent_at", { ascending: false })
        .limit(10);

      if (campaignsError) throw campaignsError;

      if (!campaignsData || campaignsData.length === 0) {
        setCampaigns([]);
        setLoading(false);
        return;
      }

      const campaignIds = campaignsData.map((c) => c.id);

      // Use the exact same recipient/engagement source as the campaign report.
      // Reporting errors must surface instead of turning successful sends into zero.
      const snapshots = new Map(await Promise.all(campaignIds.map(async (campaignId) => {
        const { data, error: snapshotError } = await supabase.rpc(
          "get_email_campaign_reporting_snapshot", { p_campaign_id: campaignId },
        );
        if (snapshotError) throw snapshotError;
        const snapshot = normalizeEmailCampaignReportingSnapshot(data);
        if (!snapshot) throw new Error("Campaign reporting snapshot is invalid");
        return [campaignId, snapshot.metrics] as const;
      })));

      // Fetch send job aggregates for all campaigns
      const { data: jobsData } = await supabase
        .from("email_send_jobs")
        .select("campaign_id, id")
        .in("campaign_id", campaignIds)
        .eq("status", "completed");

      // Fetch skip aggregates for all campaigns
      const { data: skipsData } = await supabase
        .from("email_send_skips")
        .select("campaign_id, reason")
        .in("campaign_id", campaignIds);

      // Aggregate jobs by campaign
      const jobsAgg: Record<
        string,
        { enqueued: number; sent: number; failed: number; batches: number }
      > = {};
      (jobsData || []).forEach((job) => {
        if (!jobsAgg[job.campaign_id]) {
          jobsAgg[job.campaign_id] = {
            enqueued: 0,
            sent: 0,
            failed: 0,
            batches: 0,
          };
        }
        jobsAgg[job.campaign_id].batches += 1;
      });

      // Aggregate skips by campaign and reason
      const skipsAgg: Record<
        string,
        {
          opt_out: number;
          suppressed: number;
          invalid_email: number;
          other: number;
          total: number;
        }
      > = {};
      (skipsData || []).forEach((skip) => {
        if (!skipsAgg[skip.campaign_id]) {
          skipsAgg[skip.campaign_id] = {
            opt_out: 0,
            suppressed: 0,
            invalid_email: 0,
            other: 0,
            total: 0,
          };
        }
        const reason = skip.reason || "other";
        if (reason === "opt_out") skipsAgg[skip.campaign_id].opt_out += 1;
        else if (reason === "suppressed")
          skipsAgg[skip.campaign_id].suppressed += 1;
        else if (reason === "invalid_email")
          skipsAgg[skip.campaign_id].invalid_email += 1;
        else skipsAgg[skip.campaign_id].other += 1;
        skipsAgg[skip.campaign_id].total += 1;
      });

      // Build metrics for each campaign
      const metrics: DeliveryMetrics[] = campaignsData.map((c) => {
        const jobs = jobsAgg[c.id] || {
          enqueued: 0,
          sent: 0,
          failed: 0,
          batches: 0,
        };
        const report = snapshots.get(c.id)!;
        const computedEnqueued = report.totals.recipients;
        const computedSent = report.totals.sent;
        const computedFailed = report.totals.failed;
        const skips = skipsAgg[c.id] || {
          opt_out: 0,
          suppressed: 0,
          invalid_email: 0,
          other: 0,
          total: 0,
        };

        const cachedSent = c.total_sent || 0;
        const discrepancy =
          cachedSent > 0
            ? Math.abs(((computedSent - cachedSent) / cachedSent) * 100)
            : computedSent > 0
              ? 100
              : 0;

        return {
          campaignId: c.id,
          campaignName: c.name,
          sentAt: c.sent_at,
          cachedTotalSent: cachedSent,
          cachedOpenRate: c.open_rate || 0,
          cachedClickRate: c.click_rate || 0,
          computedDelivered: report.totals.delivered,
          computedFailed: computedFailed,
          computedEnqueued: computedEnqueued,
          batchCount: jobs.batches,
          skipsTotal: report.totals.skipped,
          skipsByReason: {
            opt_out: report.totals.skipped > 0 ? skips.opt_out : 0,
            suppressed: report.totals.skipped > 0 ? skips.suppressed : 0,
            invalid_email: report.totals.skipped > 0 ? skips.invalid_email : 0,
            other: report.totals.skipped > 0 ? skips.other : 0,
          },
          totalOpens: report.totals.opens,
          totalClicks: report.totals.clicks,
          openRate: report.rates.open_reported,
          clickRate: report.rates.click,
          isStale: discrepancy > 5, // More than 5% difference
          metricsDiscrepancy: discrepancy,
        };
      });

      setCampaigns(metrics);
    } catch (err: any) {
      console.error("Error fetching campaign delivery metrics:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, dateRange, options?.enabled]);

  const recomputeCampaign = useCallback(
    async (campaignId: string) => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "recompute_campaign_metrics",
          {
            p_campaign_id: campaignId,
          },
        );

        if (rpcError) throw rpcError;

        toast.success("Campaign metrics recalculated");
        await fetchMetrics();
      } catch (err: any) {
        console.error("Error recomputing campaign metrics:", err);
        toast.error("Failed to recalculate metrics");
      }
    },
    [fetchMetrics],
  );

  const recomputeAll = useCallback(async () => {
    if (!tenant?.id) return;

    try {
      toast.info("Recalculating all campaign metrics...");

      const { error } = await supabase.functions.invoke(
        "recompute-campaign-metrics",
        {
          body: { tenant_id: tenant.id },
        },
      );

      if (error) throw error;

      toast.success("All campaign metrics recalculated");
      await fetchMetrics();
    } catch (err: any) {
      console.error("Error recomputing all metrics:", err);
      toast.error("Failed to recalculate metrics");
    }
  }, [tenant?.id, fetchMetrics]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // Calculate summary
  const summary = campaigns.reduce(
    (acc, c) => {
      acc.totalCampaigns += 1;
      acc.totalDelivered += c.computedDelivered;
      acc.totalSkipped += c.skipsTotal;
      acc.totalFailed += c.computedFailed;
      return acc;
    },
    {
      totalCampaigns: 0,
      totalDelivered: 0,
      totalSkipped: 0,
      totalFailed: 0,
      avgOpenRate: 0,
      avgClickRate: 0,
    },
  );

  // Calculate weighted average rates
  if (summary.totalDelivered > 0) {
    summary.avgOpenRate =
      campaigns.reduce((sum, c) => sum + c.openRate * c.computedDelivered, 0) /
      summary.totalDelivered;
    summary.avgClickRate =
      campaigns.reduce((sum, c) => sum + c.clickRate * c.computedDelivered, 0) /
      summary.totalDelivered;
  }

  return {
    campaigns,
    loading,
    error,
    summary,
    recomputeAll,
    recomputeCampaign,
    refresh: fetchMetrics,
  };
};
