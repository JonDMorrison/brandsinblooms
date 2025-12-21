import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { cn } from '@/lib/utils';

interface RadarDataPoint {
  channel: string;
  value: number;
  fullMark?: number;
}

interface EngagementRadarChartProps {
  data: RadarDataPoint[];
  className?: string;
  height?: number;
}

export const EngagementRadarChart: React.FC<EngagementRadarChartProps> = ({
  data,
  className,
  height = 200,
}) => {
  const chartData = data.map(d => ({
    ...d,
    fullMark: d.fullMark || 100,
  }));

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="channel"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            tickCount={4}
          />
          <Radar
            name="Engagement"
            dataKey="value"
            stroke="hsl(174 63% 57%)"
            fill="hsl(174 63% 57%)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value}%`, 'Engagement']}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EngagementRadarChart;
