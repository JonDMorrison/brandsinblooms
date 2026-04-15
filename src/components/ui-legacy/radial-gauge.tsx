import React from 'react';
import { cn } from '@/lib/utils';

interface RadialGaugeProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  sublabel?: string;
  thresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  variant?: 'default' | 'risk' | 'health' | 'intent';
  showValue?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { width: 64, stroke: 6, fontSize: 'text-sm', labelSize: 'text-xs' },
  md: { width: 96, stroke: 8, fontSize: 'text-lg', labelSize: 'text-xs' },
  lg: { width: 128, stroke: 10, fontSize: 'text-2xl', labelSize: 'text-sm' },
};

const defaultThresholds = { low: 40, medium: 70, high: 100 };

const getColorByValue = (value: number, thresholds: typeof defaultThresholds, variant: string) => {
  if (variant === 'risk') {
    // Risk: higher is worse
    if (value >= 80) return 'hsl(0 84% 60%)'; // Red - Critical
    if (value >= 60) return 'hsl(25 95% 53%)'; // Orange - High
    if (value >= 40) return 'hsl(45 93% 47%)'; // Yellow - Moderate
    if (value >= 20) return 'hsl(142 76% 36%)'; // Light green - Low
    return 'hsl(142 76% 36%)'; // Green - Minimal
  }
  
  // Health/Intent/Default: higher is better
  if (value >= thresholds.medium) return 'hsl(142 76% 36%)'; // Green
  if (value >= thresholds.low) return 'hsl(45 93% 47%)'; // Yellow
  return 'hsl(0 84% 60%)'; // Red
};

const getTrendIcon = (value: number, previousValue?: number) => {
  if (previousValue === undefined) return null;
  const diff = value - previousValue;
  if (diff > 5) return '↑';
  if (diff < -5) return '↓';
  return '→';
};

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  value,
  max = 100,
  size = 'md',
  label,
  sublabel,
  thresholds = defaultThresholds,
  variant = 'default',
  showValue = true,
  className,
}) => {
  const config = sizeConfig[size];
  const radius = (config.width - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const normalizedValue = Math.min(Math.max(value, 0), max);
  const percentage = (normalizedValue / max) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  const color = getColorByValue(normalizedValue, thresholds, variant);

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg
          className="transform -rotate-90"
          width={config.width}
          height={config.width}
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={config.stroke}
            className="opacity-30"
          />
          {/* Progress arc */}
          <circle
            cx={config.width / 2}
            cy={config.width / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={config.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-semibold text-foreground', config.fontSize)}>
              {Math.round(normalizedValue)}
            </span>
          </div>
        )}
      </div>
      {(label || sublabel) && (
        <div className="mt-2 text-center">
          {label && (
            <p className={cn('font-medium text-foreground', config.labelSize)}>
              {label}
            </p>
          )}
          {sublabel && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {sublabel}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default RadialGauge;
