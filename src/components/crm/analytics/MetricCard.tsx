import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'flat';
  variant?: 'default' | 'secondary';
}

export const MetricCard = ({
  title,
  value,
  icon,
  description,
  trend,
  variant = 'default'
}: MetricCardProps) => {
  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-3 h-3 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-3 h-3 text-red-600" />;
      case 'flat':
        return <Minus className="w-3 h-3 text-yellow-600" />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md",
      variant === 'secondary' && "bg-muted/30"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
              {getTrendIcon()}
            </div>
            <div className="text-2xl font-bold mb-1">{value}</div>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="text-primary opacity-60">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};