import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface HealthSparklineProps {
  type: 'bounce' | 'complaint';
  height?: number;
}

export const HealthSparkline: React.FC<HealthSparklineProps> = ({ 
  type, 
  height = 40 
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['health-sparkline', type],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get daily counts for the event type
      const { data: events, error } = await supabase
        .from('email_tracking_events')
        .select('created_at, event_type')
        .in('event_type', type === 'bounce' ? ['bounce', 'bounced'] : ['complaint', 'complained'])
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by day
      const dailyCounts: Record<string, number> = {};
      const today = new Date();
      
      // Initialize all 30 days with 0
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        dailyCounts[key] = 0;
      }

      // Count events per day
      (events || []).forEach(event => {
        const key = event.created_at.split('T')[0];
        if (dailyCounts[key] !== undefined) {
          dailyCounts[key]++;
        }
      });

      // Convert to array
      return Object.entries(dailyCounts).map(([date, count]) => ({
        date,
        count,
      }));
    },
    staleTime: 60000,
  });

  if (isLoading) {
    return <Skeleton className="w-full" style={{ height }} />;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const color = type === 'bounce' ? 'hsl(var(--chart-3))' : 'hsl(var(--destructive))';

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '6px',
            fontSize: '12px',
          }}
          labelFormatter={(label) => `Date: ${label}`}
          formatter={(value: number) => [value, type === 'bounce' ? 'Bounces' : 'Complaints']}
        />
        <Line
          type="monotone"
          dataKey="count"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default HealthSparkline;
