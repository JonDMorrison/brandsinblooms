import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cn } from '@/lib/utils';

interface TimelineDataPoint {
  date: string;
  orders?: number;
  revenue?: number;
  engagement?: number;
}

interface TimelineChartProps {
  data: TimelineDataPoint[];
  className?: string;
  height?: number;
  showOrders?: boolean;
  showRevenue?: boolean;
  showEngagement?: boolean;
}

export const TimelineChart: React.FC<TimelineChartProps> = ({
  data,
  className,
  height = 200,
  showOrders = true,
  showRevenue = true,
  showEngagement = false,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No timeline data available
      </div>
    );
  }

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          {showRevenue && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `$${value}`}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => {
              if (name === 'revenue') return [`$${value.toLocaleString()}`, 'Revenue'];
              if (name === 'orders') return [value, 'Orders'];
              if (name === 'engagement') return [`${value}%`, 'Engagement'];
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px' }}
            iconType="circle"
          />
          {showOrders && (
            <Bar
              yAxisId="left"
              dataKey="orders"
              fill="hsl(174 63% 57%)"
              radius={[4, 4, 0, 0]}
              name="Orders"
            />
          )}
          {showRevenue && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="hsl(210 24% 27%)"
              strokeWidth={2}
              dot={{ fill: 'hsl(210 24% 27%)', r: 3 }}
              name="Revenue"
            />
          )}
          {showEngagement && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="engagement"
              stroke="hsl(220 70% 50%)"
              strokeWidth={2}
              dot={false}
              name="Engagement"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TimelineChart;
