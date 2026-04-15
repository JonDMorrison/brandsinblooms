import React from 'react';
import { cn } from '@/lib/utils';
import { BarChart3, LineChart, Activity } from 'lucide-react';

interface EmptyChartOverlayProps {
  message?: string;
  icon?: 'bar' | 'line' | 'activity';
  height?: number;
  className?: string;
}

const iconMap = {
  bar: BarChart3,
  line: LineChart,
  activity: Activity,
};

export const EmptyChartOverlay: React.FC<EmptyChartOverlayProps> = ({
  message = 'Not enough data to display chart',
  icon = 'bar',
  height = 180,
  className,
}) => {
  const Icon = iconMap[icon];

  return (
    <div 
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg',
        'bg-muted/30 border border-dashed border-border',
        className
      )}
      style={{ height }}
    >
      <Icon className="h-8 w-8 text-muted-foreground/50 mb-2" />
      <p className="text-sm text-muted-foreground text-center px-4">
        {message}
      </p>
    </div>
  );
};

export default EmptyChartOverlay;
