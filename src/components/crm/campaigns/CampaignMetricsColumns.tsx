import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, MousePointerClick, Send } from 'lucide-react';

interface CampaignMetricsProps {
  totalSent: number;
  totalOpens: number;
  totalClicks: number;
  openRate: number;
  clickRate: number;
  status: string;
}

export const CampaignMetricsInline: React.FC<CampaignMetricsProps> = ({
  totalSent,
  totalOpens,
  totalClicks,
  openRate,
  clickRate,
  status,
}) => {
  if (status !== 'sent') {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  const getOpenRateBadgeClass = (hasImpossibleState: boolean, rate: number): string => {
    if (hasImpossibleState) return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200';
    if (rate >= 25) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (rate >= 15) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-muted text-muted-foreground';
  };

  const getClickRateColor = (rate: number) => {
    if (rate >= 5) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (rate >= 2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-muted text-muted-foreground';
  };

  // Detect impossible state: clicks exist but opens = 0
  const hasImpossibleState = totalClicks > 0 && totalOpens === 0;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1 text-sm">
              <Send className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{totalSent.toLocaleString()}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total emails sent</p>
          </TooltipContent>
        </Tooltip>

        {/* Click rate — primary metric, shown first */}
        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className={`text-xs ${getClickRateColor(clickRate)}`}>
              <MousePointerClick className="h-3 w-3 mr-1" />
              {clickRate.toFixed(1)}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{totalClicks.toLocaleString()} clicks ({clickRate.toFixed(1)}% click rate)</p>
          </TooltipContent>
        </Tooltip>

        {/* Open rate — secondary, with MPP disclaimer */}
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant="secondary"
              className={`text-xs ${getOpenRateBadgeClass(hasImpossibleState, openRate)}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              {hasImpossibleState ? '—' : `${openRate.toFixed(1)}%`}
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            {hasImpossibleState ? (
              <p>Open tracking is incomplete — clicks exist but 0 opens recorded. Click rate is more reliable.</p>
            ) : (
              <p>{totalOpens.toLocaleString()} opens ({openRate.toFixed(1)}% open rate). Note: open tracking may be understated due to Apple Mail Privacy Protection.</p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

// Compact version for table cells
export const CampaignMetricsBadges: React.FC<Omit<CampaignMetricsProps, 'totalSent' | 'totalOpens' | 'totalClicks'>> = ({
  openRate,
  clickRate,
  status,
}) => {
  if (status !== 'sent') {
    return null;
  }

  return (
    <div className="flex items-center gap-1">
      <Badge variant="outline" className="text-xs">
        <MousePointerClick className="h-3 w-3 mr-1" />
        {clickRate.toFixed(0)}%
      </Badge>
      <Badge variant="outline" className="text-xs text-muted-foreground">
        <Eye className="h-3 w-3 mr-1" />
        {openRate.toFixed(0)}%
      </Badge>
    </div>
  );
};
