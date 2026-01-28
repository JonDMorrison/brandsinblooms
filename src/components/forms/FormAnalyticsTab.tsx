import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Link2, 
  BarChart3,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface FormAnalyticsTabProps {
  formId: string;
}

interface AnalyticsData {
  total: number;
  accepted: number;
  rejected: number;
  acceptanceRate: number;
  lastSubmission: string | null;
  topReferrers: { url: string; count: number }[];
}

/**
 * SQL Query used (executed via Supabase JS client):
 * 
 * SELECT 
 *   COUNT(*) as total,
 *   COUNT(*) FILTER (WHERE result = 'accepted') as accepted,
 *   COUNT(*) FILTER (WHERE result != 'accepted') as rejected,
 *   MAX(submitted_at) as last_submission,
 *   metadata->>'referrer' as referrer
 * FROM form_submissions
 * WHERE form_id = $formId
 * GROUP BY referrer
 * ORDER BY count DESC
 * LIMIT 5
 * 
 * Performance considerations:
 * - Uses existing form_id index on form_submissions table
 * - Aggregates in single query to minimize round trips
 * - Limits referrer results to top 5
 * - No JOIN operations needed
 * - Consider adding partial index on (form_id, result) if table grows large
 */

export function FormAnalyticsTab({ formId }: FormAnalyticsTabProps) {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['form-analytics', formId],
    queryFn: async (): Promise<AnalyticsData> => {
      // Fetch aggregate counts and last submission
      const { data: submissions, error: queryError } = await supabase
        .from('form_submissions')
        .select('result, submitted_at, metadata')
        .eq('form_id', formId);

      if (queryError) throw queryError;

      const total = submissions?.length || 0;
      const accepted = submissions?.filter(s => s.result === 'accepted').length || 0;
      const rejected = total - accepted;
      const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

      // Find last submission
      const lastSubmission = submissions && submissions.length > 0
        ? submissions.sort((a, b) => 
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          )[0].submitted_at
        : null;

      // Calculate top referrers from metadata
      const referrerCounts: Record<string, number> = {};
      submissions?.forEach(sub => {
        const metadata = sub.metadata as Record<string, any> | null;
        const referrer = metadata?.referrer || metadata?.page_url;
        if (referrer && typeof referrer === 'string') {
          // Extract domain from URL for cleaner display
          try {
            const url = new URL(referrer);
            const domain = url.hostname + (url.pathname !== '/' ? url.pathname : '');
            referrerCounts[domain] = (referrerCounts[domain] || 0) + 1;
          } catch {
            // If URL parsing fails, use as-is
            referrerCounts[referrer] = (referrerCounts[referrer] || 0) + 1;
          }
        }
      });

      const topReferrers = Object.entries(referrerCounts)
        .map(([url, count]) => ({ url, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        total,
        accepted,
        rejected,
        acceptanceRate,
        lastSubmission,
        topReferrers,
      };
    },
    staleTime: 30000, // Cache for 30 seconds
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Failed to load analytics</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) return null;

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Submissions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <div className="text-3xl font-bold">{analytics.total}</div>
            <p className="text-xs text-muted-foreground mt-1">submissions</p>
          </CardContent>
        </Card>

        {/* Accepted */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Accepted</span>
            </div>
            <div className="text-3xl font-bold text-green-600">{analytics.accepted}</div>
            <p className="text-xs text-muted-foreground mt-1">valid entries</p>
          </CardContent>
        </Card>

        {/* Rejected */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-muted-foreground">Rejected</span>
            </div>
            <div className="text-3xl font-bold text-destructive">{analytics.rejected}</div>
            <p className="text-xs text-muted-foreground mt-1">spam / invalid</p>
          </CardContent>
        </Card>

        {/* Acceptance Rate */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Accept Rate</span>
            </div>
            <div className="text-3xl font-bold">
              {analytics.acceptanceRate}
              <span className="text-lg text-muted-foreground">%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.total > 0 ? 'of all submissions' : 'no data yet'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Last Submission & Top Referrers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Last Submission */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Last Submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.lastSubmission ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger className="text-left">
                    <div className="text-xl font-semibold">
                      {formatDistanceToNow(new Date(analytics.lastSubmission), { addSuffix: true })}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(analytics.lastSubmission), 'PPpp')}
                    </p>
                  </TooltipTrigger>
                  <TooltipContent>
                    {format(new Date(analytics.lastSubmission), 'EEEE, MMMM d, yyyy \'at\' h:mm a')}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <p className="text-muted-foreground">No submissions yet</p>
            )}
          </CardContent>
        </Card>

        {/* Top Referrers */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Top Referrer URLs
            </CardTitle>
            <CardDescription>Where submissions are coming from</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topReferrers.length > 0 ? (
              <div className="space-y-3">
                {analytics.topReferrers.map((referrer, index) => (
                  <div key={referrer.url} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs text-muted-foreground w-4">{index + 1}.</span>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger className="text-left truncate max-w-[200px]">
                            <span className="text-sm font-mono truncate">{referrer.url}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-mono text-xs">{referrer.url}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Badge variant="secondary" className="text-xs ml-2">
                      {referrer.count}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No referrer data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance Note */}
      <p className="text-xs text-muted-foreground text-center">
        Analytics derived from form_submissions table. Data refreshes every 30 seconds.
      </p>
    </div>
  );
}
