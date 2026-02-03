import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, RefreshCw, CheckCircle, XCircle, Mail, Ban, UserX } from 'lucide-react';
import { DeliveryMetrics } from '@/hooks/analytics/useCampaignDeliveryMetrics';

interface CampaignDeliveryBreakdownProps {
  campaign: DeliveryMetrics;
  onRecompute: (campaignId: string) => Promise<void>;
  recomputing?: boolean;
}

const SKIP_COLORS = {
  opt_out: 'hsl(var(--muted-foreground))',
  suppressed: 'hsl(var(--destructive))',
  invalid_email: 'hsl(var(--warning, 45 93% 47%))',
  other: 'hsl(var(--muted))',
};

export const CampaignDeliveryBreakdown: React.FC<CampaignDeliveryBreakdownProps> = ({
  campaign,
  onRecompute,
  recomputing = false,
}) => {
  const totalAttempted = campaign.computedEnqueued + campaign.skipsTotal;
  const deliveryRate = totalAttempted > 0 
    ? ((campaign.computedDelivered / totalAttempted) * 100).toFixed(1)
    : '0';

  // Prepare skip pie data
  const skipData = [
    { name: 'Opted Out', value: campaign.skipsByReason.opt_out, color: SKIP_COLORS.opt_out },
    { name: 'Suppressed', value: campaign.skipsByReason.suppressed, color: SKIP_COLORS.suppressed },
    { name: 'Invalid Email', value: campaign.skipsByReason.invalid_email, color: SKIP_COLORS.invalid_email },
    { name: 'Other', value: campaign.skipsByReason.other, color: SKIP_COLORS.other },
  ].filter(d => d.value > 0);

  return (
    <div className="p-4 bg-muted/30 rounded-lg space-y-4">
      {/* Header with stale warning */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">Delivery Details</h4>
          {campaign.isStale && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600 gap-1">
              <AlertTriangle className="h-3 w-3" />
              Metrics Stale ({campaign.metricsDiscrepancy.toFixed(0)}% drift)
            </Badge>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onRecompute(campaign.campaignId)}
          disabled={recomputing}
          className="gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${recomputing ? 'animate-spin' : ''}`} />
          Recompute
        </Button>
      </div>

      {/* Delivery Funnel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="text-center p-3 bg-background rounded-lg border">
          <Mail className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold">{campaign.computedEnqueued.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Enqueued</p>
        </div>
        <div className="text-center p-3 bg-background rounded-lg border">
          <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-green-600">{campaign.computedDelivered.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Delivered</p>
        </div>
        <div className="text-center p-3 bg-background rounded-lg border">
          <Ban className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-lg font-bold">{campaign.skipsTotal.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Skipped</p>
        </div>
        <div className="text-center p-3 bg-background rounded-lg border">
          <XCircle className="h-4 w-4 text-destructive mx-auto mb-1" />
          <p className="text-lg font-bold text-destructive">{campaign.computedFailed.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Failed</p>
        </div>
      </div>

      {/* Delivery Rate Progress */}
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Delivery Rate</span>
          <span className="font-medium">{deliveryRate}%</span>
        </div>
        <Progress value={parseFloat(deliveryRate)} className="h-2" />
      </div>

      {/* Skip Breakdown */}
      {campaign.skipsTotal > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Skip Reasons List */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Skip Reasons</p>
            <div className="space-y-1">
              {campaign.skipsByReason.opt_out > 0 && (
                <div className="flex items-center justify-between text-sm p-2 bg-background rounded">
                  <span className="flex items-center gap-2">
                    <UserX className="h-3 w-3 text-muted-foreground" />
                    Opted Out
                  </span>
                  <Badge variant="outline">{campaign.skipsByReason.opt_out}</Badge>
                </div>
              )}
              {campaign.skipsByReason.suppressed > 0 && (
                <div className="flex items-center justify-between text-sm p-2 bg-background rounded">
                  <span className="flex items-center gap-2">
                    <Ban className="h-3 w-3 text-destructive" />
                    Suppressed (bounced/complaint)
                  </span>
                  <Badge variant="outline">{campaign.skipsByReason.suppressed}</Badge>
                </div>
              )}
              {campaign.skipsByReason.invalid_email > 0 && (
                <div className="flex items-center justify-between text-sm p-2 bg-background rounded">
                  <span className="flex items-center gap-2">
                    <XCircle className="h-3 w-3 text-yellow-600" />
                    Invalid Email
                  </span>
                  <Badge variant="outline">{campaign.skipsByReason.invalid_email}</Badge>
                </div>
              )}
              {campaign.skipsByReason.other > 0 && (
                <div className="flex items-center justify-between text-sm p-2 bg-background rounded">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                    Other
                  </span>
                  <Badge variant="outline">{campaign.skipsByReason.other}</Badge>
                </div>
              )}
            </div>
          </div>

          {/* Skip Pie Chart */}
          {skipData.length > 0 && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={skipData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={45}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {skipData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), 'Count']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Cached vs Computed comparison (if stale) */}
      {campaign.isStale && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm">
          <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
            Metrics Discrepancy Detected
          </p>
          <div className="grid grid-cols-2 gap-4 text-yellow-700 dark:text-yellow-300">
            <div>
              <p className="text-xs">Cached (displayed)</p>
              <p className="font-mono">{campaign.cachedTotalSent.toLocaleString()} sent</p>
            </div>
            <div>
              <p className="text-xs">Computed (actual)</p>
              <p className="font-mono">{campaign.computedDelivered.toLocaleString()} delivered</p>
            </div>
          </div>
          <p className="text-xs mt-2 text-yellow-600 dark:text-yellow-400">
            Click "Recompute" to update cached metrics with accurate values.
          </p>
        </div>
      )}
    </div>
  );
};

export default CampaignDeliveryBreakdown;
