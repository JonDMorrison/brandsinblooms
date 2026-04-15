import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui-legacy/alert';
import { Button } from '@/components/ui-legacy/button';
import { useOverdueCampaigns } from '@/hooks/crm/useOverdueCampaigns';
import { formatDistanceToNow } from 'date-fns';

interface OverdueCampaignsBannerProps {
  className?: string;
}

export const OverdueCampaignsBanner: React.FC<OverdueCampaignsBannerProps> = ({ className }) => {
  const { data, loading, refetch } = useOverdueCampaigns(60000); // Poll every minute

  // Don't render if no overdue campaigns or still loading initial data
  if (loading || !data || data.overdueCount === 0) {
    return null;
  }

  const oldestAgo = data.oldestScheduledAt 
    ? formatDistanceToNow(new Date(data.oldestScheduledAt), { addSuffix: true })
    : null;

  return (
    <Alert variant="destructive" className={`border-destructive/50 bg-destructive/10 ${className}`}>
      <AlertTriangle className="h-5 w-5 text-destructive" />
      <div className="flex-1">
        <AlertTitle className="text-destructive flex items-center gap-2">
          <span>{data.overdueCount} Scheduled Campaign{data.overdueCount > 1 ? 's' : ''} Overdue</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-destructive hover:text-destructive/80"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </AlertTitle>
        <AlertDescription className="text-destructive/80 mt-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {data.overdueCount === 1 
                  ? `"${data.campaigns[0]?.name}" was scheduled ${oldestAgo}`
                  : `Oldest campaign was scheduled ${oldestAgo}`
                }
              </span>
            </div>
            <Link to="/crm/campaigns?status=scheduled">
              <Button 
                variant="outline" 
                size="sm" 
                className="border-destructive/50 text-destructive hover:bg-destructive/10"
              >
                View Campaigns
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
          
          {data.overdueCount > 1 && data.campaigns.length > 0 && (
            <ul className="mt-2 text-sm space-y-1">
              {data.campaigns.slice(0, 3).map(campaign => (
                <li key={campaign.id} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                  <span className="truncate max-w-[300px]">{campaign.name}</span>
                  <span className="text-destructive/60 text-xs">
                    ({formatDistanceToNow(new Date(campaign.scheduled_at), { addSuffix: true })})
                  </span>
                </li>
              ))}
              {data.overdueCount > 3 && (
                <li className="text-destructive/60 text-xs pl-3.5">
                  +{data.overdueCount - 3} more...
                </li>
              )}
            </ul>
          )}
        </AlertDescription>
      </div>
    </Alert>
  );
};
