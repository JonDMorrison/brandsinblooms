import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Loader2,
  Trash2,
} from "lucide-react";
import { BouncedEmailsList } from "@/components/crm/BouncedEmailsList";
import { useCampaignBounces } from "@/hooks/useCampaignBounces";
import { CampaignGovernanceMetricsCard } from "@/components/crm/CampaignGovernanceMetricsCard";
import {
  normalizeDerivedMetrics,
  type DerivedMetrics,
} from "@/hooks/analytics/useCampaignDerivedMetrics";

interface CampaignMetrics {
  sent: number;
  delivered: number;
  successfulReach: number;
  uniqueEngaged: number;
  opened: number;
  clicked: number;
  bounced: number;
  hardBounces: number;
  unsubscribed: number;
  reachScore: number;
  interactionScore: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
}

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalizes campaign.metrics which exists in two shapes:
 * - legacy flat: { sent, delivered, opened, clicked, bounced, unsubscribed }
 * - derived (current): { totals: {...}, scores: {...}, rates: {...} }
 */
function normalizeCampaignMetrics(campaign: any): CampaignMetrics {
  const derived = normalizeDerivedMetrics(campaign?.metrics);

  if (derived) {
    return {
      sent: derived.totals.sent,
      delivered: derived.totals.delivered,
      successfulReach: derived.totals.successful_reach,
      uniqueEngaged: derived.totals.unique_engaged,
      opened: derived.totals.opens,
      clicked: derived.totals.clicks,
      bounced: derived.totals.bounces,
      hardBounces: derived.totals.hard_bounces,
      unsubscribed: derived.totals.unsubscribes,
      reachScore: derived.scores.reach,
      interactionScore: derived.scores.interaction,
      deliveryRate: derived.rates.delivery,
      openRate: derived.rates.open_reported,
      clickRate: derived.rates.click,
      clickToOpenRate: derived.rates.click_to_open,
    };
  }

  const flat =
    campaign?.metrics && typeof campaign.metrics === "object"
      ? (campaign.metrics as any)
      : {};
  const sent = toNumber(flat.sent ?? campaign?.total_sent, 0);
  const delivered = toNumber(flat.delivered, 0);
  const opened = toNumber(
    flat.opened || flat.opens || 0 || campaign?.total_opens,
    0,
  );
  const clicked = toNumber(
    flat.clicked || flat.clicks || 0 || campaign?.total_clicks,
    0,
  );
  const hardBounces = toNumber(
    flat.hard_bounces ?? flat.bounces ?? flat.bounced,
    0,
  );
  const successfulReach = Math.max(delivered - hardBounces, 0);
  const uniqueEngaged = Math.max(opened, clicked);

  return {
    sent,
    delivered,
    successfulReach,
    uniqueEngaged,
    opened,
    clicked,
    bounced: toNumber(flat.bounced ?? flat.bounces, 0),
    hardBounces,
    unsubscribed: toNumber(flat.unsubscribed ?? flat.unsubscribes, 0),
    reachScore: sent > 0 ? (successfulReach / sent) * 100 : 0,
    interactionScore:
      successfulReach > 0 ? (uniqueEngaged / successfulReach) * 100 : 0,
    deliveryRate: sent > 0 ? (delivered / sent) * 100 : 0,
    openRate: successfulReach > 0 ? (opened / successfulReach) * 100 : 0,
    clickRate: successfulReach > 0 ? (clicked / successfulReach) * 100 : 0,
    clickToOpenRate: opened > 0 ? (clicked / opened) * 100 : 0,
  };
}

function campaignMetricsFromDerived(derived: DerivedMetrics): CampaignMetrics {
  return {
    sent: derived.totals.sent,
    delivered: derived.totals.delivered,
    successfulReach: derived.totals.successful_reach,
    uniqueEngaged: derived.totals.unique_engaged,
    opened: derived.totals.opens,
    clicked: derived.totals.clicks,
    bounced: derived.totals.bounces,
    hardBounces: derived.totals.hard_bounces,
    unsubscribed: derived.totals.unsubscribes,
    reachScore: derived.scores.reach,
    interactionScore: derived.scores.interaction,
    deliveryRate: derived.rates.delivery,
    openRate: derived.rates.open_reported,
    clickRate: derived.rates.click,
    clickToOpenRate: derived.rates.click_to_open,
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

  const { data: liveDerivedMetrics } = useQuery({
    queryKey: ["campaign-report-derived-metrics", campaignId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_campaign_derived_metrics" as any,
        {
          p_campaign_id: campaignId,
        },
      );

      if (error) throw error;
      return normalizeDerivedMetrics(data);
    },
    enabled: !!campaignId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const loading = campaignLoading;

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

  const metrics = liveDerivedMetrics
    ? campaignMetricsFromDerived(liveDerivedMetrics)
    : normalizeCampaignMetrics(campaign);
  const canViewRecipients = ["sent", "sending", "sent_with_errors"].includes(
    campaign.status,
  );

  const bounceRate =
    metrics.sent > 0 ? (metrics.hardBounces / metrics.sent) * 100 : 0;

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
            {canViewRecipients && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(`/dashboard/campaigns/${campaignId}/recipients`)
                }
              >
                <Users className="mr-2 h-4 w-4" />
                View Recipients
              </Button>
            )}
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

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Opened
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.opened.toLocaleString()}
                  </p>
                </div>
                <Eye className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Clicked
                  </p>
                  <p className="text-2xl font-bold">
                    {metrics.clicked.toLocaleString()}
                  </p>
                </div>
                <MousePointer className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>

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

        <Card>
          <CardHeader>
            <CardTitle>Supporting Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">
                  {metrics.delivered.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Delivered</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.deliveryRate.toFixed(1)}% delivery
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">
                  {metrics.uniqueEngaged.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Unique Engaged</p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">
                  {metrics.opened.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Opens</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.openRate.toFixed(1)}% open rate
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">
                  {metrics.clicked.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Clicks</p>
                <p className="text-xs text-muted-foreground">
                  {metrics.clickRate.toFixed(1)}% click rate
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold">
                  {metrics.hardBounces.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground">Hard Bounces</p>
                <p className="text-xs text-muted-foreground">
                  {bounceRate.toFixed(1)}% bounce rate
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
                {metrics.reachScore > 70 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm">
                      Reach is strong. Most intended recipients were reached
                      successfully.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Reach is below target. Review delivery coverage and
                      hard-bounce causes before optimizing engagement.
                    </span>
                  </div>
                )}

                {metrics.interactionScore > 35 ? (
                  <div className="flex items-center gap-2 text-green-600">
                    <MousePointer className="h-4 w-4" />
                    <span className="text-sm">
                      Interaction is strong. The campaign content generated
                      engagement after delivery.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-yellow-600">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm">
                      Interaction is trailing reach. Review content, calls to
                      action, and audience targeting.
                    </span>
                  </div>
                )}

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
