import React from 'react';
import { cn } from '@/lib/utils';

interface FunnelStep {
  label: string;
  value: number;
  percentage?: number;
}

interface FunnelChartProps {
  steps: FunnelStep[];
  className?: string;
  showPercentages?: boolean;
  variant?: 'email' | 'sms' | 'default';
}

const variantColors = {
  email: {
    primary: 'hsl(220 70% 50%)',
    gradient: 'from-blue-500 to-blue-600',
  },
  sms: {
    primary: 'hsl(142 76% 36%)',
    gradient: 'from-green-500 to-green-600',
  },
  default: {
    primary: 'hsl(174 63% 57%)',
    gradient: 'from-brand-teal-500 to-brand-teal-600',
  },
};

export const FunnelChart: React.FC<FunnelChartProps> = ({
  steps,
  className,
  showPercentages = true,
  variant = 'default',
}) => {
  if (!steps || steps.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        No funnel data available
      </div>
    );
  }

  const maxValue = steps[0]?.value || 1;
  const colors = variantColors[variant];

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, index) => {
        const widthPercent = Math.max((step.value / maxValue) * 100, 15);
        const conversionRate = index > 0 && steps[index - 1].value > 0
          ? ((step.value / steps[index - 1].value) * 100).toFixed(1)
          : null;

        return (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{step.label}</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-semibold">{step.value.toLocaleString()}</span>
                {showPercentages && step.percentage !== undefined && (
                  <span className="text-muted-foreground">({step.percentage}%)</span>
                )}
              </div>
            </div>
            <div className="relative h-8 bg-muted/30 rounded-md overflow-hidden">
              <div
                className={cn(
                  'absolute left-0 top-0 h-full rounded-md transition-all duration-500',
                  `bg-gradient-to-r ${colors.gradient}`
                )}
                style={{ width: `${widthPercent}%` }}
              />
              {conversionRate && (
                <div className="absolute inset-0 flex items-center justify-end pr-2">
                  <span className="text-[10px] font-medium text-muted-foreground">
                    {conversionRate}% conv.
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FunnelChart;
