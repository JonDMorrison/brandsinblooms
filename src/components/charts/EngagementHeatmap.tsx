import React from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HeatmapData {
  day: string;
  hour: number;
  value: number;
}

interface EngagementHeatmapProps {
  data: HeatmapData[];
  className?: string;
  variant?: 'clicks' | 'opens' | 'engagement';
}

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hours = [6, 9, 12, 15, 18, 21];

const variantColors = {
  clicks: { low: 'hsl(220 70% 95%)', high: 'hsl(220 70% 50%)' },
  opens: { low: 'hsl(142 76% 95%)', high: 'hsl(142 76% 36%)' },
  engagement: { low: 'hsl(174 63% 95%)', high: 'hsl(174 63% 45%)' },
};

const getIntensityColor = (value: number, maxValue: number, variant: string) => {
  const colors = variantColors[variant as keyof typeof variantColors] || variantColors.engagement;
  const intensity = maxValue > 0 ? value / maxValue : 0;
  
  if (intensity === 0) return 'hsl(var(--muted) / 0.3)';
  if (intensity < 0.25) return colors.low;
  if (intensity < 0.5) return `color-mix(in srgb, ${colors.low} 50%, ${colors.high} 50%)`;
  if (intensity < 0.75) return `color-mix(in srgb, ${colors.low} 25%, ${colors.high} 75%)`;
  return colors.high;
};

export const EngagementHeatmap: React.FC<EngagementHeatmapProps> = ({
  data,
  className,
  variant = 'engagement',
}) => {
  // Create a lookup map for quick access
  const dataMap = new Map<string, number>();
  data.forEach(d => {
    dataMap.set(`${d.day}-${d.hour}`, d.value);
  });

  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className={cn('space-y-1', className)}>
      {/* Hour labels */}
      <div className="flex ml-10 gap-1">
        {hours.map(hour => (
          <div key={hour} className="flex-1 text-[10px] text-muted-foreground text-center">
            {hour}:00
          </div>
        ))}
      </div>
      
      {/* Grid */}
      <TooltipProvider>
        {days.map(day => (
          <div key={day} className="flex items-center gap-1">
            <div className="w-8 text-[10px] text-muted-foreground">{day}</div>
            <div className="flex flex-1 gap-1">
              {hours.map(hour => {
                const value = dataMap.get(`${day}-${hour}`) || 0;
                const bgColor = getIntensityColor(value, maxValue, variant);
                
                return (
                  <Tooltip key={`${day}-${hour}`}>
                    <TooltipTrigger asChild>
                      <div
                        className="flex-1 h-6 rounded cursor-pointer transition-transform hover:scale-110"
                        style={{ backgroundColor: bgColor }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">
                        {day} {hour}:00 - {value} interactions
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        ))}
      </TooltipProvider>
      
      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-2">
        <span className="text-[10px] text-muted-foreground">Less</span>
        <div className="flex gap-0.5">
          {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-sm"
              style={{
                backgroundColor: getIntensityColor(intensity * maxValue, maxValue, variant),
              }}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">More</span>
      </div>
    </div>
  );
};

export default EngagementHeatmap;
