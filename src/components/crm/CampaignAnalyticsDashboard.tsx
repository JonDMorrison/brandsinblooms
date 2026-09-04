import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Input } from "@/components/ui-legacy/input";
import { NativeSelect } from "@/components/ui-legacy/NativeSelect";
import { CampaignPerformanceCard } from "./CampaignPerformanceCard";
import type { CampaignPerformanceMetrics } from "@/lib/crm/campaignAnalyticsSummary";
import { supabase } from "@/integrations/supabase/client";
import { useCRMAccess } from "@/hooks/useCRMAccess";
import {
  CAMPAIGN_STATUS,
  getCampaignStatusLabel,
  isTerminalCampaignStatus,
} from "@/constants/campaignStatuses";
import {
  Search,
  TrendingUp,
  Mail,
  Eye,
  MousePointer,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { formatAttributedRevenue } from "@/lib/crm/campaignRevenueMetrics";
import {
  aggregateRevenue,
  toPerformanceMetrics,
} from "@/lib/crm/campaignAnalyticsSummary";

interface Campaign {
  id: string;
  name: string;
  sent_at: string | null;
  queued_at: string | null;
  activity_at: string;
  status: string;
  metrics: CampaignPerformanceMetrics | null;
}

const CAMPAIGN_PAGE_SIZE = 500;

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const CampaignAnalyticsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { hasCRMAccess, loading: crmLoading } = useCRMAccess();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"recent" | "performance">("recent");

  useEffect(() => {
    if (hasCRMAccess) {
      loadCampaigns();
    }
  }, [hasCRMAccess]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const rows: Array<Record<string, unknown>> = [];
      for (let from = 0; ; from += CAMPAIGN_PAGE_SIZE) {
        const { data, error } = await supabase
          .from("crm_campaigns")
          .select("id,name,sent_at,queued_at,created_at,status,metrics")
          .order("created_at", { ascending: false })
          .range(from, from + CAMPAIGN_PAGE_SIZE - 1);

        if (error) throw error;
        rows.push(...((data || []) as Array<Record<string, unknown>>));
        if (!data || data.length < CAMPAIGN_PAGE_SIZE) break;
      }

      const processedCampaigns: Campaign[] = rows.map((campaign) => ({
        id: String(campaign.id),
        name: String(campaign.name || "Untitled campaign"),
        sent_at: typeof campaign.sent_at === "string" ? campaign.sent_at : null,
        queued_at:
          typeof campaign.queued_at === "string" ? campaign.queued_at : null,
        activity_at: String(
          campaign.sent_at || campaign.queued_at || campaign.created_at,
        ),
        status: String(campaign.status),
        metrics: toPerformanceMetrics(campaign.metrics),
      }));

      setCampaigns(processedCampaigns);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setLoading(false);
    }
  };

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch =
      !searchQuery ||
      campaign.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || campaign.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const sortedCampaigns = [...filteredCampaigns].sort((a, b) => {
    if (sortBy === "recent") {
      return (
        new Date(b.activity_at).getTime() - new Date(a.activity_at).getTime()
      );
    } else {
      // Sort by the more reliable engagement signal: unique click rate.
      const aClickRate = a.metrics
        ? (a.metrics.clicked / (a.metrics.delivered || a.metrics.sent || 1)) *
          100
        : 0;
      const bClickRate = b.metrics
        ? (b.metrics.clicked / (b.metrics.delivered || b.metrics.sent || 1)) *
          100
        : 0;
      return bClickRate - aClickRate;
    }
  });

  const calculateOverallStats = () => {
    const sentCampaigns = campaigns.filter(
      (c) => c.metrics && isTerminalCampaignStatus(c.status),
    );
    if (sentCampaigns.length === 0) return null;

    const totals = sentCampaigns.reduce(
      (acc, campaign) => {
        const metrics = campaign.metrics!;
        return {
          sent: acc.sent + metrics.sent,
          delivered: acc.delivered + metrics.delivered,
          adjustedOpens: acc.adjustedOpens + metrics.adjustedOpens,
          reportedOpens: acc.reportedOpens + metrics.reportedOpens,
          clicked: acc.clicked + metrics.clicked,
          failed: acc.failed + metrics.failed,
          pending: acc.pending + metrics.pending,
          unconfirmed: acc.unconfirmed + metrics.unconfirmed,
        };
      },
      {
        sent: 0,
        delivered: 0,
        adjustedOpens: 0,
        reportedOpens: 0,
        clicked: 0,
        failed: 0,
        pending: 0,
        unconfirmed: 0,
      },
    );

    const revenueAttribution = aggregateRevenue(
      sentCampaigns.map((campaign) => campaign.metrics!),
    );

    return {
      totalCampaigns: sentCampaigns.length,
      adjustedOpenRate: Math.round(
        (totals.adjustedOpens / (totals.delivered || totals.sent || 1)) * 100,
      ),
      avgClickRate: Math.round(
        (totals.clicked / (totals.delivered || totals.sent || 1)) * 100,
      ),
      revenueAttribution,
      ...totals,
    };
  };

  const overallStats = calculateOverallStats();

  const exportCampaignData = () => {
    if (sortedCampaigns.length === 0) {
      toast.info("No campaign data to export");
      return;
    }

    const csvData = sortedCampaigns.map((campaign) => ({
      name: campaign.name,
      status: campaign.status,
      queued_date: campaign.queued_at || "",
      sent_date: campaign.sent_at || "",
      activity_date: campaign.activity_at,
      sent: campaign.metrics?.sent || 0,
      delivered: campaign.metrics?.delivered || 0,
      adjusted_unique_opens: campaign.metrics?.adjustedOpens || 0,
      reported_unique_opens: campaign.metrics?.reportedOpens || 0,
      unique_clicks: campaign.metrics?.clicked || 0,
      adjusted_open_rate: campaign.metrics
        ? Math.round(
            (campaign.metrics.adjustedOpens /
              (campaign.metrics.delivered || campaign.metrics.sent || 1)) *
              100,
          )
        : 0,
      click_rate: campaign.metrics
        ? Math.round(
            (campaign.metrics.clicked /
              (campaign.metrics.delivered || campaign.metrics.sent || 1)) *
              100,
          )
        : 0,
      bounced: campaign.metrics?.bounced || 0,
      unsubscribed: campaign.metrics?.unsubscribed || 0,
      failed: campaign.metrics?.failed || 0,
      pending: campaign.metrics?.pending || 0,
      unconfirmed: campaign.metrics?.unconfirmed || 0,
      attributed_orders: campaign.metrics?.revenueAttribution.orders || 0,
      attributed_customers: campaign.metrics?.revenueAttribution.customers || 0,
      attributed_revenue: campaign.metrics
        ? formatAttributedRevenue(campaign.metrics.revenueAttribution)
        : "",
      attribution_model: campaign.metrics?.revenueAttribution.model || "",
      attribution_window_days:
        campaign.metrics?.revenueAttribution.windowDays || "",
    }));

    const csv = [
      Object.keys(csvData[0]).map(csvCell).join(","),
      ...csvData.map((row) => Object.values(row).map(csvCell).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (crmLoading) {
    return (
      <div className="flex items-center justify-center h-64">Loading...</div>
    );
  }

  if (!hasCRMAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">CRM Access Required</h2>
          <p className="text-muted-foreground">
            Please upgrade your plan to access campaign analytics.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaign Analytics</h1>
          <p className="text-muted-foreground">
            Track the performance of your email campaigns
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportCampaignData}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Export Data
        </Button>
      </div>

      {/* Overall Stats */}
      {overallStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Total Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallStats.totalCampaigns}
              </div>
              <p className="text-xs text-muted-foreground">
                {
                  campaigns.filter((c) => c.status === CAMPAIGN_STATUS.DRAFT)
                    .length
                }{" "}
                drafts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Adjusted Open Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallStats.adjustedOpenRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                {overallStats.adjustedOpens.toLocaleString()} non-machine opens
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Avg Click Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallStats.avgClickRate}%
              </div>
              <p className="text-xs text-muted-foreground">
                {overallStats.clicked.toLocaleString()} total clicks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Attributed Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overallStats.revenueAttribution.revenue > 0
                  ? formatAttributedRevenue(overallStats.revenueAttribution)
                  : "None yet"}
              </div>
              <p className="text-xs text-muted-foreground">
                Auditable 7-day last-click POS sales
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <NativeSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="Filter by status"
          className="w-48"
          options={[
            { value: "all", label: "All Statuses" },
            {
              value: CAMPAIGN_STATUS.DRAFT,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.DRAFT),
            },
            {
              value: CAMPAIGN_STATUS.SCHEDULED,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.SCHEDULED),
            },
            {
              value: CAMPAIGN_STATUS.QUEUED,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.QUEUED),
            },
            {
              value: CAMPAIGN_STATUS.SENDING,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.SENDING),
            },
            {
              value: CAMPAIGN_STATUS.SENT,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.SENT),
            },
            {
              value: CAMPAIGN_STATUS.SENT_WITH_ERRORS,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.SENT_WITH_ERRORS),
            },
            {
              value: CAMPAIGN_STATUS.FAILED,
              label: getCampaignStatusLabel(CAMPAIGN_STATUS.FAILED),
            },
          ]}
        />

        <NativeSelect
          value={sortBy}
          onChange={(e) =>
            setSortBy(e.target.value as "recent" | "performance")
          }
          placeholder="Sort by"
          className="w-48"
          options={[
            { value: "recent", label: "Most Recent" },
            { value: "performance", label: "Best Click Rate" },
          ]}
        />
      </div>

      {/* Campaign List */}
      <div className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : sortedCampaigns.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Mail className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
              <p className="text-muted-foreground">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Create your first email campaign to see analytics here"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedCampaigns.map((campaign) => (
              <CampaignPerformanceCard
                key={campaign.id}
                campaignName={campaign.name}
                sentDate={campaign.sent_at ?? campaign.activity_at}
                status={campaign.status}
                metrics={campaign.metrics || undefined}
                onViewDetails={() =>
                  navigate(`/crm/campaigns/${campaign.id}/report`)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
