import React from 'react';
import { Badge } from '@/components/ui-legacy/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui-legacy/tooltip';
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

  const getOpenRateColor = (rate: number) => {
    if (rate >= 25) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (rate >= 15) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-muted text-muted-foreground';
  };

  const getClickRateColor = (rate: number) => {
    if (rate >= 5) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    if (rate >= 2) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    return 'bg-muted text-muted-foreground';
  };

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

        <Tooltip>
          <TooltipTrigger>
            <Badge variant="secondary" className={`text-xs ${getOpenRateColor(openRate)}`}>
              <Eye className="h-3 w-3 mr-1" />
              {openRate.toFixed(1)}%
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>{totalOpens.toLocaleString()} opens ({openRate.toFixed(1)}% open rate)</p>
          </TooltipContent>
        </Tooltip>

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
        <Eye className="h-3 w-3 mr-1" />
        {openRate.toFixed(0)}%
      </Badge>
      <Badge variant="outline" className="text-xs">
        <MousePointerClick className="h-3 w-3 mr-1" />
        {clickRate.toFixed(0)}%
      </Badge>
    </div>
  );
};
