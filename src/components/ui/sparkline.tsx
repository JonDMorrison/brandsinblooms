import React from 'react';
import { cn } from '@/lib/utils';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showTrend?: boolean;
  className?: string;
}

const calculateTrend = (data: number[]): 'up' | 'down' | 'stable' => {
  if (data.length < 2) return 'stable';
  const recent = data.slice(-3);
  const earlier = data.slice(0, 3);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
  const diff = recentAvg - earlierAvg;
  if (diff > 5) return 'up';
  if (diff < -5) return 'down';
  return 'stable';
};

const trendColors = {
  up: 'hsl(142 76% 36%)',
  down: 'hsl(0 84% 60%)',
  stable: 'hsl(var(--muted-foreground))',
};

const trendIcons = {
  up: '↑',
  down: '↓',
  stable: '→',
};

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 80,
  height = 24,
  color,
  showTrend = true,
  className,
}) => {
  if (!data || data.length < 2) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        <span className="text-xs text-muted-foreground">No data</span>
      </div>
    );
  }

  const trend = calculateTrend(data);
  const strokeColor = color || trendColors[trend];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const padding = 2;
  const effectiveWidth = width - padding * 2;
  const effectiveHeight = height - padding * 2;
  
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * effectiveWidth;
    const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
    return `${x},${y}`;
  }).join(' ');

  const areaPoints = [
    `${padding},${height - padding}`,
    ...data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * effectiveWidth;
      const y = padding + effectiveHeight - ((value - min) / range) * effectiveHeight;
      return `${x},${y}`;
    }),
    `${width - padding},${height - padding}`,
  ].join(' ');

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Area fill */}
        <polygon
          points={areaPoints}
          fill={strokeColor}
          fillOpacity={0.1}
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        <circle
          cx={width - padding}
          cy={padding + effectiveHeight - ((data[data.length - 1] - min) / range) * effectiveHeight}
          r={2}
          fill={strokeColor}
        />
      </svg>
      {showTrend && (
        <span
          className="text-xs font-medium"
          style={{ color: strokeColor }}
        >
          {trendIcons[trend]}
        </span>
      )}
    </div>
  );
};

export default Sparkline;
