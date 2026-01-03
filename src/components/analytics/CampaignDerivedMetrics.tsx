import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  RefreshCw, 
  Info, 
  Send, 
  Eye, 
  MousePointerClick, 
  AlertTriangle,
  Link as LinkIcon,
  Clock
} from 'lucide-react';
import { useCampaignDerivedMetrics } from '@/hooks/analytics/useCampaignDerivedMetrics';
import { formatDistanceToNow } from 'date-fns';

interface CampaignDerivedMetricsProps {
  campaignId: string;
  showTopLinks?: boolean;
  compact?: boolean;
}

export const CampaignDerivedMetrics: React.FC<CampaignDerivedMetricsProps> = ({
  campaignId,
  showTopLinks = true,
  compact = false,
}) => {
  const { metrics, loading, isStale, lastRefreshed, recompute } = useCampaignDerivedMetrics(campaignId);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No analytics data available yet
        </CardContent>
      </Card>
    );
  }

  const { totals, rates, links } = metrics;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Campaign Performance
            {isStale && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Stale
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(lastRefreshed, { addSuffix: true })}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={recompute} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Recalculate
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Delivery Funnel */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={Send}
            label="Sent"
            value={totals.sent}
            color="text-blue-600"
          />
          <MetricCard
            icon={Eye}
            label="Opens"
            value={totals.opens}
            rate={rates.open_reported}
            rateLabel="Open Rate"
            color="text-green-600"
          />
          <MetricCard
            icon={MousePointerClick}
            label="Clicks"
            value={totals.clicks}
            rate={rates.click}
            rateLabel="Click Rate"
            color="text-purple-600"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Bounces"
            value={totals.bounces}
            rate={rates.bounce}
            rateLabel="Bounce Rate"
            color={totals.bounces > 0 ? 'text-orange-600' : 'text-muted-foreground'}
          />
        </div>

        {/* Open Rate Comparison (MPP Adjustment) */}
        {!compact && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">Open Rate Analysis</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        <strong>Reported:</strong> All detected opens including Apple Mail Privacy Protection.
                      </p>
                      <p className="mt-1">
                        <strong>Adjusted:</strong> Excludes suspected MPP auto-opens for a more accurate engagement picture.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Reported</span>
                  <span className="font-bold">{rates.open_reported}%</span>
                </div>
                <Progress value={Math.min(rates.open_reported, 100)} className="h-2" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Adjusted (non-MPP)</span>
                  <span className="font-bold">{rates.open_adjusted}%</span>
                </div>
                <Progress value={Math.min(rates.open_adjusted, 100)} className="h-2 bg-muted [&>div]:bg-primary/70" />
              </div>
            </div>
          </div>
        )}

        {/* Top Links */}
        {showTopLinks && links && links.length > 0 && (
          <div>
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <LinkIcon className="h-4 w-4" />
              Top Links
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link, idx) => {
                  const ctr = totals.delivered > 0 
                    ? ((link.clicks / totals.delivered) * 100).toFixed(2)
                    : '0.00';
                  return (
                    <TableRow key={link.link_id || idx}>
                      <TableCell className="max-w-[300px] truncate">
                        <a 
                          href={link.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {link.url}
                        </a>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {link.clicks}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{ctr}%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Helper component for metric cards
const MetricCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: number;
  rate?: number;
  rateLabel?: string;
  color?: string;
}> = ({ icon: Icon, label, value, rate, rateLabel, color = 'text-foreground' }) => (
  <div className="p-4 bg-muted/30 rounded-lg text-center">
    <Icon className={`h-5 w-5 mx-auto mb-2 ${color}`} />
    <p className="text-2xl font-bold">{value.toLocaleString()}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
    {rate !== undefined && (
      <Badge variant="outline" className="mt-2 text-xs">
        {rate}% {rateLabel}
      </Badge>
    )}
  </div>
);

export default CampaignDerivedMetrics;
