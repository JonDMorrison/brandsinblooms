import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CohortCurvesProps {
  campaignId: string;
  sentAt?: string;
  compact?: boolean;
}

interface CohortBucket {
  bucket: string;
  opens: number;
  clicks: number;
  cumulativeOpens: number;
  cumulativeClicks: number;
}

const COHORT_BUCKETS = [
  { label: '0-1h', maxMinutes: 60 },
  { label: '1-6h', maxMinutes: 360 },
  { label: '6-24h', maxMinutes: 1440 },
  { label: '1-7d', maxMinutes: 10080 },
];

export const CohortCurves: React.FC<CohortCurvesProps> = ({ 
  campaignId, 
  sentAt,
  compact = false 
}) => {
  const { data: events, isLoading } = useQuery({
    queryKey: ['cohort-events', campaignId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_tracking_events')
        .select('event_type, created_at, event_ts_provider')
        .eq('campaign_id', campaignId)
        .in('event_type', ['open', 'click'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!campaignId,
    staleTime: 60000, // 1 minute
  });

  const cohortData = useMemo(() => {
    if (!events || !sentAt) return [];

    const sendTime = new Date(sentAt).getTime();
    const bucketCounts: Record<string, { opens: number; clicks: number }> = {};

    // Initialize buckets
    COHORT_BUCKETS.forEach(b => {
      bucketCounts[b.label] = { opens: 0, clicks: 0 };
    });

    // Categorize events into buckets
    events.forEach(event => {
      const eventTime = new Date(event.event_ts_provider || event.created_at).getTime();
      const minutesSinceSend = (eventTime - sendTime) / (1000 * 60);

      // Find the appropriate bucket
      for (const bucket of COHORT_BUCKETS) {
        if (minutesSinceSend <= bucket.maxMinutes) {
          if (event.event_type === 'open') {
            bucketCounts[bucket.label].opens++;
          } else if (event.event_type === 'click') {
            bucketCounts[bucket.label].clicks++;
          }
          break;
        }
      }
    });

    // Build cumulative data
    let cumulativeOpens = 0;
    let cumulativeClicks = 0;

    return COHORT_BUCKETS.map(bucket => {
      const counts = bucketCounts[bucket.label];
      cumulativeOpens += counts.opens;
      cumulativeClicks += counts.clicks;

      return {
        bucket: bucket.label,
        opens: counts.opens,
        clicks: counts.clicks,
        cumulativeOpens,
        cumulativeClicks,
      };
    });
  }, [events, sentAt]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!events || events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No engagement data yet
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className={compact ? 'pb-2' : ''}>
        <CardTitle className={compact ? 'text-base' : ''}>
          Engagement by Time Since Send
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={compact ? 180 : 280}>
          <LineChart data={cohortData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="bucket" 
              tick={{ fontSize: 12 }} 
              className="text-muted-foreground"
            />
            <YAxis 
              tick={{ fontSize: 12 }} 
              className="text-muted-foreground"
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            {!compact && <Legend />}
            <Line 
              type="monotone" 
              dataKey="cumulativeOpens" 
              name="Cumulative Opens"
              stroke="hsl(var(--primary))" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="cumulativeClicks" 
              name="Cumulative Clicks"
              stroke="hsl(var(--chart-2))" 
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        {compact && (
          <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5 bg-primary"></span> Opens
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-0.5" style={{ backgroundColor: 'hsl(var(--chart-2))' }}></span> Clicks
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CohortCurves;
