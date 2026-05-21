import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { useCampaignGovernanceVisibility } from "@/hooks/useCampaignGovernanceVisibility";
import { supabase } from "@/integrations/supabase/client";
import {
  governanceRiskBadgeVariant,
  governanceRiskFromPolicy,
  governanceRiskLabel,
} from "@/lib/email/governanceRisk";

function formatRate(rate: number) {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatSendingMode(impact: string) {
  switch (impact) {
    case "policy_and_throttle":
    case "throttle_only":
      return "Protected Send";
    case "policy_only":
      return "Protected Send";
    default:
      return "Standard Send";
  }
}

function formatThresholdCategory(category: string) {
  const value = (category || "").toLowerCase();
  if (value === "hard_bounce_rate") return "Hard bounce rate needs attention";
  if (value === "soft_bounce_rate") return "Soft bounce rate needs attention";
  if (value === "complaint_rate") return "Complaint rate needs attention";
  if (value === "failed_delivery_rate") return "Failed delivery rate needs attention";
  if (value === "rapid_negative_trend") return "Recent delivery trend needs attention";
  return "Sending health needs attention";
}

function formatTimestamp(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString();
}

function formatRiskLabel(risk: ReturnType<typeof governanceRiskFromPolicy>) {
  const label = governanceRiskLabel(risk);
  if (label.toLowerCase().includes("red")) return "Needs Attention";
  if (label.toLowerCase().includes("yellow")) return "Review Recommended";
  return label;
}

export function CampaignGovernanceMetricsCard({
  campaignId,
}: {
  campaignId: string | null | undefined;
}) {
  const { data: governanceData, isLoading } = useCampaignGovernanceVisibility(campaignId);
  const { data: queueHealth } = useQuery({
    queryKey: ["campaign-queue-health", campaignId],
    enabled: Boolean(campaignId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_campaigns")
        .select(
          "status, stall_count, worker_heartbeat_at, estimated_completion_at, total_recipients, total_batches, messages_sent, messages_failed, messages_skipped, queue_started_at, queue_completed_at",
        )
        .eq("id", campaignId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "sending" || status === "queued" || status === "partially_queued"
        ? 5000
        : 30000;
    },
  });

  if (!campaignId) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Clock3 className="h-4 w-4 mr-2 animate-pulse" />
          Loading sending health...
        </CardContent>
      </Card>
    );
  }

  if (!governanceData) return null;

  const risk = governanceRiskFromPolicy({
    reputationTier: governanceData.reputation_tier,
    reputationAction: governanceData.reputation_action,
    hasHardStopThreshold: governanceData.threshold_exceeded.length > 0,
  });

  const queueProcessedCount = queueHealth
    ? (queueHealth.messages_sent || 0)
      + (queueHealth.messages_failed || 0)
      + (queueHealth.messages_skipped || 0)
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Sending Health</CardTitle>
          <Badge variant={governanceRiskBadgeVariant(risk)}>
            {formatRiskLabel(risk)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Delivery Rate</p>
            <p className="text-base font-semibold">
              {formatRate(governanceData.delivery_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {governanceData.delivered_count.toLocaleString()} /{" "}
              {governanceData.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Hard Bounce Rate</p>
            <p className="text-base font-semibold">
              {formatRate(governanceData.hard_bounce_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {governanceData.hard_bounce_count.toLocaleString()} /{" "}
              {governanceData.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Soft Bounce Rate</p>
            <p className="text-base font-semibold">
              {formatRate(governanceData.soft_bounce_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {governanceData.soft_bounce_count.toLocaleString()} /{" "}
              {governanceData.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Complaint Rate</p>
            <p className="text-base font-semibold">
              {formatRate(governanceData.complaint_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {governanceData.complaint_count.toLocaleString()} /{" "}
              {governanceData.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Unsubscribe Rate</p>
            <p className="text-base font-semibold">
              {formatRate(governanceData.unsubscribe_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {governanceData.unsubscribed_count.toLocaleString()} /{" "}
              {governanceData.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Sending Mode</p>
            <p className="text-base font-semibold">
              {formatSendingMode(governanceData.reputation_impact)}
            </p>
            <p className="text-xs text-muted-foreground">
              {governanceData.reputation_action === "throttle"
                ? "BloomSuite is pacing this campaign more gradually."
                : "Standard delivery pacing is active."}
            </p>
          </div>

          {queueHealth && (
            <div className="rounded-md border p-3 md:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Queue Health</p>
                <p className="text-xs font-medium text-muted-foreground">
                  Stall recoveries: {queueHealth.stall_count || 0}
                </p>
              </div>
              <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <p className="text-base font-semibold">
                    {queueProcessedCount.toLocaleString()} / {Number(queueHealth.total_recipients || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Processed recipients</p>
                </div>
                <div>
                  <p className="text-base font-semibold">
                    {formatTimestamp(queueHealth.worker_heartbeat_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">Latest worker heartbeat</p>
                </div>
                <div>
                  <p className="text-base font-semibold">
                    {formatTimestamp(queueHealth.estimated_completion_at)}
                  </p>
                  <p className="text-xs text-muted-foreground">Estimated completion</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {governanceData.threshold_exceeded.length > 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium flex items-center gap-2 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-700" />
              Sending health needs attention
            </p>
            <p className="text-sm text-amber-900 mt-1">
              {governanceData.threshold_exceeded
                .map((reason) => formatThresholdCategory(reason))
                .join(" • ")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            No sending-health thresholds exceeded in the last 24h.
          </div>
        )}

        {governanceData.is_throttled && governanceData.throttle_reasons.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Protected Send active:{" "}
            {governanceData.throttle_reasons
              .map((reason) => formatThresholdCategory(reason))
              .join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}