import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useDashboardInsights } from "@/hooks/useDashboardInsights";

const providerNames: Record<string, string> = {
  vmx: "VMX POS",
  square: "Square",
  lightspeed: "Lightspeed",
  clover: "Clover",
};

export const POSInsightsCard: React.FC = () => {
  const navigate = useNavigate();
  const { hasPOSConnection, primaryPOSProvider, lastSyncAt, insights, loaded } =
    useDashboardInsights();

  if (!loaded || !hasPOSConnection || insights.length < 2) return null;

  const providerLabel = providerNames[primaryPOSProvider || ""] || primaryPOSProvider || "POS";
  const syncLabel = lastSyncAt
    ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })
    : "recently";

  return (
    <Card className="mb-6 border-green-200 bg-gradient-to-br from-green-50/50 to-white">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Insights from your POS data</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on your {providerLabel} integration, synced {syncLabel}
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <ol className="space-y-2.5">
          {insights.map((insight, i) => (
            <li key={insight.id} className="flex items-start gap-2.5">
              <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-700 text-[11px] font-semibold mt-0.5">
                {i + 1}
              </span>
              <p
                className="text-sm text-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: insight.text }}
              />
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
          <Button size="sm" onClick={() => navigate("/crm/segments")}>
            View all segments
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/crm/campaigns/new?type=newsletter")}
          >
            Create a campaign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
