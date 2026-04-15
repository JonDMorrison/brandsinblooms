import React from "react";
import { Card, CardContent } from "@/components/ui-legacy/card";
import { Badge } from "@/components/ui-legacy/badge";
import { useTenant } from "@/hooks/useTenant";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";
import {
  governanceRiskBadgeVariant,
  governanceRiskFromPolicy,
  governanceRiskLabel,
  governanceSendingStatusLabel,
} from "@/lib/email/governanceRisk";

function formatRate(rate: number) {
  return `${(rate * 100).toFixed(2)}%`;
}

export function DomainHealthBanner(props: { compact?: boolean }) {
  const { compact = false } = props;
  const { tenant } = useTenant();
  const { data, isLoading } = useTenantEmailHealthDashboard(tenant?.id);

  if (!tenant?.id) return null;
  if (isLoading) {
    return (
      <Card>
        <CardContent className={compact ? "py-3" : "py-4"}>
          <div className="text-sm text-muted-foreground">
            Loading domain health…
          </div>
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const risk = governanceRiskFromPolicy({
    reputationTier: data.reputation_tier,
    reputationAction: data.reputation_action,
  });

  const riskLabel = governanceRiskLabel(risk);
  const sendingStatus = governanceSendingStatusLabel(risk);

  return (
    <Card>
      <CardContent className={compact ? "py-3" : "py-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              Domain Health: {riskLabel}
            </div>
            <div className="text-sm text-muted-foreground">
              Reputation Score: {data.reputation_score} / 100 • Bounce Rate
              (24h): {formatRate(Number(data.bounce_rate_24h || 0))} • Complaint
              Rate (24h): {formatRate(Number(data.complaint_rate_24h || 0))}
            </div>
            {!compact && (
              <div className="text-sm text-muted-foreground">
                Sending Status: {sendingStatus}
              </div>
            )}
          </div>
          <Badge variant={governanceRiskBadgeVariant(risk)}>{riskLabel}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
