import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Clock3 } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useTenantEmailHealthDashboard } from "@/hooks/useTenantEmailHealthDashboard";

function formatRate(rate: number) {
  return `${(rate * 100).toFixed(2)}%`;
}

function trendMeta(direction: string) {
  if (direction === "up") {
    return { icon: ArrowUpRight, label: "Up", className: "text-green-700" };
  }
  if (direction === "down") {
    return { icon: ArrowDownRight, label: "Down", className: "text-destructive" };
  }
  return { icon: ArrowRight, label: "Flat", className: "text-muted-foreground" };
}

function scoreVariant(score: number) {
  if (score < 60) return "destructive" as const;
  if (score < 75) return "warning" as const;
  return "success" as const;
}

export function TenantEmailHealthDashboardCard() {
  const { tenant } = useTenant();
  const { data, isLoading } = useTenantEmailHealthDashboard(tenant?.id);

  if (!tenant?.id) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center text-muted-foreground">
          <Clock3 className="h-4 w-4 mr-2 animate-pulse" />
          Loading tenant email health...
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const trend = trendMeta(data.trend_direction);
  const TrendIcon = trend.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Tenant Email Health</CardTitle>
          <Badge variant={scoreVariant(data.reputation_score)}>
            Reputation {data.reputation_score}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Tier</p>
            <p className="text-base font-semibold capitalize">{data.reputation_tier}</p>
            <p className="text-xs text-muted-foreground capitalize">Action: {data.reputation_action}</p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Trend (7d)</p>
            <p className={`text-base font-semibold flex items-center gap-1 ${trend.className}`}>
              <TrendIcon className="h-4 w-4" />
              {trend.label}
            </p>
            <p className="text-xs text-muted-foreground">Δ {data.trend_delta} vs baseline {data.baseline_score_7d}</p>
          </div>

          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Scope</p>
            <p className="text-base font-semibold">24h + 30d</p>
            <p className="text-xs text-muted-foreground">Governance snapshots</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-md border p-3 space-y-1">
            <p className="text-sm font-medium">Last 24h</p>
            <p className="text-xs text-muted-foreground">Sent {data.sent_24h.toLocaleString()} • Delivered {data.delivered_24h.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Bounced {data.bounced_24h.toLocaleString()} • Complained {data.complained_24h.toLocaleString()} • Unsubscribed {data.unsubscribed_24h.toLocaleString()}</p>
            <p className="text-sm">Bounce {formatRate(data.bounce_rate_24h)} • Complaint {formatRate(data.complaint_rate_24h)}</p>
          </div>

          <div className="rounded-md border p-3 space-y-1">
            <p className="text-sm font-medium">Last 30d</p>
            <p className="text-xs text-muted-foreground">Sent {data.sent_30d.toLocaleString()} • Delivered {data.delivered_30d.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Bounced {data.bounced_30d.toLocaleString()} • Complained {data.complained_30d.toLocaleString()} • Unsubscribed {data.unsubscribed_30d.toLocaleString()}</p>
            <p className="text-sm">Bounce {formatRate(data.bounce_rate_30d)} • Complaint {formatRate(data.complaint_rate_30d)}</p>
          </div>
        </div>

        {data.reputation_score < 60 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
            Reputation is in a critical range. Review list hygiene, complaint sources, and bounce handling before your next send.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
