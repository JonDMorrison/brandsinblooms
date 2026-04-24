import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Badge } from '@/components/ui-legacy/badge';
import { Skeleton } from '@/components/ui-legacy/skeleton';
import { MousePointerClick, Link2, TrendingUp, ExternalLink } from 'lucide-react';
import { useCampaignClickStats, type ClickStats } from '@/hooks/useClickStats';

interface CampaignClickStatsProps {
  campaignId: string;
  className?: string;
}

export const CampaignClickStats: React.FC<CampaignClickStatsProps> = ({
  campaignId,
  className = ''
}) => {
  const { data: stats, isLoading, error } = useCampaignClickStats(campaignId);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MousePointerClick className="h-4 w-4" />
            Click Analytics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !stats) {
    return null;
  }

  const { totalClicks, uniqueClicks, topLinks } = stats;

  // No clicks yet
  if (totalClicks === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MousePointerClick className="h-4 w-4" />
            Click Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No clicks recorded yet. Stats will appear once recipients click links in your email.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MousePointerClick className="h-4 w-4" />
          Click Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{totalClicks}</div>
            <div className="text-xs text-muted-foreground">Total Clicks</div>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="text-2xl font-bold text-primary">{uniqueClicks}</div>
            <div className="text-xs text-muted-foreground">Unique Clicks</div>
          </div>
        </div>

        {/* Top Links */}
        {topLinks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Top Links
            </h4>
            <div className="space-y-1.5">
              {topLinks.slice(0, 5).map((link, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-muted/30 rounded text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-muted-foreground" title={link.url}>
                      {truncateUrl(link.url)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {link.clicks} {link.clicks === 1 ? 'click' : 'clicks'}
                    </Badge>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function truncateUrl(url: string, maxLength: number = 40): string {
  try {
    const parsed = new URL(url);
    const display = parsed.hostname + parsed.pathname;
    if (display.length > maxLength) {
      return display.substring(0, maxLength - 3) + '...';
    }
    return display;
  } catch {
    if (url.length > maxLength) {
      return url.substring(0, maxLength - 3) + '...';
    }
    return url;
  }
}
