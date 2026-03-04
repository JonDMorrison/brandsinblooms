import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock3 } from "lucide-react";
import { useCampaignGovernanceVisibility } from "@/hooks/useCampaignGovernanceVisibility";
import {
  governanceRiskBadgeVariant,
  governanceRiskFromPolicy,
  governanceRiskLabel,
} from "@/lib/email/governanceRisk";

function formatRate(rate: number) {
  return `${(rate * 100).toFixed(2)}%`;
}

function formatImpact(impact: string) {
  switch (impact) {
    case "policy_and_throttle":
      return "Policy + Throttle";
    case "policy_only":
      return "Policy";
    case "throttle_only":
      return "Throttle";
    default:
      return "None";
  }
}

function formatThresholdCategory(category: string) {
  const value = (category || "").toLowerCase();
  if (value === "hard_bounce_rate") return "Hard bounce threshold";
  if (value === "soft_bounce_rate") return "Soft bounce threshold";
  if (value === "complaint_rate") return "Complaint threshold";
  if (value === "failed_delivery_rate") return "Failed delivery threshold";
  if (value === "rapid_negative_trend") return "Rapid negative trend";
  return "Deliverability threshold";
}

export function CampaignGovernanceMetricsCard({
  campaignId,
}: {
  campaignId: string | null | undefined;
}) {
  const { data, isLoading } = useCampaignGovernanceVisibility(campaignId);

  if (!campaignId) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Clock3 className="h-4 w-4 mr-2 animate-pulse" />
          Loading governance metrics...
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const risk = governanceRiskFromPolicy({
    reputationTier: data.reputation_tier,
    reputationAction: data.reputation_action,
    hasHardStopThreshold: data.threshold_exceeded.length > 0,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Governance Risk Metrics</CardTitle>
          <Badge variant={governanceRiskBadgeVariant(risk)}>
            {governanceRiskLabel(risk)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Delivery Rate</p>
            <p className="text-base font-semibold">
              {formatRate(data.delivery_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.delivered_count.toLocaleString()} /{" "}
              {data.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Hard Bounce Rate</p>
            <p className="text-base font-semibold">
              {formatRate(data.hard_bounce_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.hard_bounce_count.toLocaleString()} /{" "}
              {data.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Soft Bounce Rate</p>
            <p className="text-base font-semibold">
              {formatRate(data.soft_bounce_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.soft_bounce_count.toLocaleString()} /{" "}
              {data.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Complaint Rate</p>
            <p className="text-base font-semibold">
              {formatRate(data.complaint_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.complaint_count.toLocaleString()} /{" "}
              {data.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Unsubscribe Rate</p>
            <p className="text-base font-semibold">
              {formatRate(data.unsubscribe_rate)}
            </p>
            <p className="text-xs text-muted-foreground">
              {data.unsubscribed_count.toLocaleString()} /{" "}
              {data.sent_count.toLocaleString()} sent
            </p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Reputation Impact</p>
            <p className="text-base font-semibold">
              {formatImpact(data.reputation_impact)}
            </p>
            <p className="text-xs text-muted-foreground">
              Tier {data.reputation_tier} • Action {data.reputation_action}
            </p>
          </div>
        </div>

        {data.threshold_exceeded.length > 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Threshold exceeded
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {data.threshold_exceeded
                .map((reason) => formatThresholdCategory(reason))
                .join(" • ")}
            </p>
          </div>
        ) : (
          <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            No hard-stop thresholds exceeded in the last 24h.
          </div>
        )}

        {data.is_throttled && data.throttle_reasons.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Throttling active:{" "}
            {data.throttle_reasons
              .map((reason) => formatThresholdCategory(reason))
              .join(", ")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
