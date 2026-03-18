import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CampaignDeliveryStatusCard } from "@/components/crm/CampaignDeliveryStatusCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import {
  Mail,
  Eye,
  MousePointer,
  TrendingUp,
  Users,
  AlertTriangle,
  Info,
  Loader2,
  Trash2,
} from "lucide-react";
import { BouncedEmailsList } from "@/components/crm/BouncedEmailsList";
import { useCampaignBounces } from "@/hooks/useCampaignBounces";
import { CampaignGovernanceMetricsCard } from "@/components/crm/CampaignGovernanceMetricsCard";

interface CampaignMetrics {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  revenue: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalizes campaign.metrics which exists in two shapes:
 * - legacy flat: { sent, delivered, opened, clicked, bounced, unsubscribed, revenue }
 * - derived (current): { totals: { sent, delivered, opens, clicks, bounces, unsubscribes }, rates: {...} }
 */
function normalizeCampaignMetrics(campaign: any): CampaignMetrics {
  const m = campaign?.metrics;

  // Prefer the derived metrics shape
  const totals = m && typeof m === "object" ? (m as any).totals : null;
  if (totals && typeof totals === "object") {
    return {
      sent: toNumber(totals.sent ?? campaign?.total_sent, 0),
      delivered: toNumber(totals.delivered, 0),
      opened: toNumber(
        totals.opens ?? totals.opened ?? campaign?.total_opens,
        0,
      ),
      clicked: toNumber(
        totals.clicks ?? totals.clicked ?? campaign?.total_clicks,
        0,
      ),
      bounced: toNumber(totals.bounces ?? totals.bounced, 0),
      unsubscribed: toNumber(totals.unsubscribes ?? totals.unsubscribed, 0),
      revenue: toNumber((totals as any).revenue ?? (m as any)?.revenue, 0),
    };
  }

  // Fallback to legacy flat shape + campaign columns
  // Use campaign-level columns as override when flat metrics show 0 but columns have real values
  const flat = m && typeof m === "object" ? (m as any) : {};
  return {
    sent: toNumber(flat.sent ?? campaign?.total_sent, 0),
    delivered: toNumber(flat.delivered, 0),
    opened: toNumber(
      (flat.opened || flat.opens || 0) || campaign?.total_opens,
      0,
    ),
    clicked: toNumber(
      (flat.clicked || flat.clicks || 0) || campaign?.total_clicks,
      0,
    ),
    bounced: toNumber(flat.bounced ?? flat.bounces, 0),
    unsubscribed: toNumber(flat.unsubscribed ?? flat.unsubscribes, 0),
    revenue: toNumber(flat.revenue, 0),
  };
}

interface Campaign {
  id: string;
  name: string;
  subject_line: string;
  status: string;
  sent_at: string;
  metrics: any; // Using any since it comes from JSON
  send_reasoning: string;
  auto_send_enabled: boolean;
  predicted_segment_ids: string[];
}

const CRMCampaignReport: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  const { unsuppressedCount, suppressAll, isSuppressing } = useCampaignBounces(
    campaignId || "",
  );

  const { data: campaign, isLoading: campaignLoading } = useQuery({
    queryKey: ["campaign-report", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!campaignId,
    staleTime: 0, // Always refetch on mount
    refetchOnMount: "always",
  });

  const { data: segments = [] } = useQuery({
    queryKey: ["campaign-report-segments", campaignId],
    queryFn: async () => {
      // First try the campaign_segments join table
      const { data, error } = await supabase
        .from("campaign_segments")
        .select(
          `
          *,
          crm_segments(*)
        `,
        )
        .eq("campaign_id", campaignId);
      if (error) throw error;
      if (data && data.length > 0) return data;

      // Fallback: check direct segment_id on crm_campaigns
      const { data: campaignData } = await supabase
        .from("crm_campaigns")
        .select("segment_id")
        .eq("id", campaignId!)
        .maybeSingle();

      if (campaignData?.segment_id) {
        const { data: segmentData } = await supabase
          .from("crm_segments")
          .select("*")
          .eq("id", campaignData.segment_id)
          .maybeSingle();

        if (segmentData) {
          return [
            {
              id: campaignData.segment_id,
              campaign_id: campaignId,
              segment_id: campaignData.segment_id,
              crm_segments: segmentData,
            },
          ];
        }
      }

      return [];
    },
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const loading = campaignLoading;

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return (numerator / denominator) * 100;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">
                Loading campaign report...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Campaign not found</h3>
            <p className="text-muted-foreground">
              The campaign you're looking for doesn't exist or you don't have
              access to it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const metrics = normalizeCampaignMetrics(campaign);

  const openRate = calculateRate(metrics.opened, metrics.delivered);
  // Click rate is clicks / delivered (standard CTR). Avoid using opens as denominator
  // since open tracking is unreliable (Apple MPP, pixel blocking, etc.).
  const clickRate = calculateRate(metrics.clicked, metrics.delivered || metrics.sent);
  const deliveryRate = calculateRate(metrics.delivered, metrics.sent);
  const bounceRate = calculateRate(metrics.bounced, metrics.sent);

  // Sanity check: a campaign cannot have clicks without opens.
  // When this is detected, open tracking is likely incomplete.
  const hasImpossibleState = metrics.clicked > 0 && metrics.opened === 0;
  const clicksExceedOpens = metrics.clicked > metrics.opened && metrics.opened > 0;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Campaign Report
            </h1>
            <p className="text-muted-foreground">{campaign.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={campaign.status === "sent" ? "secondary" : "default"}
            >
              {campaign.status}
            </Badge>
            {campaign.auto_send_enabled && (
              <Badge variant="outline" className="border-primary text-primary">
                Auto-Send
              </Badge>
            )}
          </div>
        </div>

        <CampaignDeliveryStatusCard campaignId={campaignId} />

        {/* Open tracking reliability notice */}
        {(hasImpossibleState || clicksExceedOpens) && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Open tracking appears incomplete</p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                {hasImpossibleState
                  ? `This campaign recorded ${metrics.clicked.toLocaleString()} click${metrics.clicked !== 1 ? "s" : ""} but 0 opens — a mathematically impossible result. Open events may not be ingesting correctly.`
                  : `This campaign shows more clicks (${metrics.clicked.toLocaleString()}) than opens (${metrics.opened.toLocaleString()}), which suggests incomplete open tracking.`}{" "}
                Click rate is a more reliable engagement signal. Consider{" "}
                <strong>recomputing metrics</strong> from raw events if numbers look stale.
              </p>
            </div>
          </div>
        )}

        {/* Campaign Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Subject Line
                </label>
                <p className="font-medium">{campaign.subject_line}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Sent Date
                </label>
                <p className="font-medium">
                  {campaign.sent_at ? formatDate(campaign.sent_at) : "Not sent"}
                </p>
              </div>
            </div>

            {campaign.send_reasoning && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Smart Timing Reasoning
                </label>
                <p className="text-sm">{campaign.send_reasoning}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Sent
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.sent.toLocaleString()}
                  </p>
                </div>
                <Mail className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Delivered
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.delivered.toLocaleString()}
                  </p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Click rate — primary engagement metric */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Click Rate
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {clickRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics.clicked.toLocaleString()} clicks
                  </p>
                </div>
                <MousePointer className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Open rate — secondary, with reliability caveat */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Card className="cursor-default">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          Open Rate
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </p>
                        <p className={`text-2xl font-bold ${hasImpossibleState ? "text-amber-500" : ""}`}>
                          {hasImpossibleState ? "—" : `${openRate.toFixed(1)}%`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metrics.opened.toLocaleString()} opens
                        </p>
                      </div>
                      <Eye className={`h-8 w-8 ${hasImpossibleState ? "text-amber-400" : "text-muted-foreground"}`} />
                    </div>
                  </CardContent>
                </Card>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>
                  Open tracking is unreliable due to Apple Mail Privacy Protection (MPP) and
                  other pixel-blocking technologies. Use click rate as your primary engagement signal.
                  {hasImpossibleState && " Open data for this campaign appears incomplete."}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Card>
            <CardHeader>
              <CardTitle>Audience Segments</CardTitle>
            </CardHeader>
            <CardContent>
              {segments.length > 0 ? (
                <div className="space-y-3">
                  {segments.map((segmentLink) => (
                    <div
                      key={segmentLink.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {segmentLink.crm_segments?.name || "Unknown Segment"}
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {segmentLink.crm_segments?.customer_count?.toLocaleString() ||
                          0}{" "}
                        customers
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2" />
                  <p>No segments selected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <CampaignGovernanceMetricsCard campaignId={campaignId} />

        {/* Performance Insights */}
        {campaign.status === "sent" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Performance Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Click rate is the primary signal */}
                {clickRate > 5 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-sm">
                      Excellent click rate ({clickRate.toFixed(1)}%)! Your content is engaging
                      your audience effectively.
                    </span>
                  </div>
                ) : clickRate > 2 ? (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-sm">
                      Solid click rate ({clickRate.toFixed(1)}%). Try adding clearer
                      call-to-action buttons to increase engagement.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Low click rate ({clickRate.toFixed(1)}%). Consider reviewing your
                      content and call-to-action placement.
                    </span>
                  </div>
                )}

                {/* Open rate insight — only shown if data looks reliable */}
                {!hasImpossibleState && !clicksExceedOpens && openRate > 25 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">
                      Strong open rate ({openRate.toFixed(1)}%). Note: open tracking may be
                      understated due to Apple Mail Privacy Protection.
                    </span>
                  </div>
                ) : (hasImpossibleState || clicksExceedOpens) ? (
                  <div className="flex items-center gap-2 text-amber-600">
                    <Info className="h-4 w-4" />
                    <span className="text-sm">
                      Open rate data appears unreliable for this campaign. Use click rate as
                      your primary engagement signal — it is not affected by pixel-blocking.
                    </span>
                  </div>
                ) : null}

                {bounceRate > 2 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="text-sm">
                        High bounce rate detected ({bounceRate.toFixed(1)}%).
                        Consider cleaning your email list.
                      </span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate("/settings/email/suppression")}
                      >
                        View Suppression List
                      </Button>
                      {unsuppressedCount > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowCleanupDialog(true)}
                        >
                          Clean Bounces
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cleanup Dialog */}
      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Clean Bounced Emails
            </DialogTitle>
            <DialogDescription>
              Review bounced emails from this campaign. Suppressing them will
              prevent future sends to these addresses.
            </DialogDescription>
          </DialogHeader>

          {campaignId && <BouncedEmailsList campaignId={campaignId} />}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCleanupDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                suppressAll();
                setShowCleanupDialog(false);
              }}
              disabled={isSuppressing || unsuppressedCount === 0}
            >
              {isSuppressing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Suppressing...
                </>
              ) : (
                `Suppress ${unsuppressedCount} Email${unsuppressedCount !== 1 ? "s" : ""}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CRMCampaignReport;
