
import * as React from "react";
import { cn } from "@/lib/utils";
import { PremiumIcon } from "./premium-icons";

interface EnhancedProgressProps {
  value: number;
  max: number;
  className?: string;
  showIcon?: boolean;
  animated?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const EnhancedProgress = ({
  value,
  max,
  className,
  showIcon = true,
  animated = true,
  size = 'md'
}: EnhancedProgressProps) => {
  const percentage = Math.min((value / max) * 100, 100);
  
  const sizeClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {showIcon && (
        <div className="sprout-animation">
          <PremiumIcon 
            icon="leaf" 
            size="sm" 
            variant="gradient"
            className="garden-breathing"
          />
        </div>
      )}
      
      <div className="flex-1">
        <div className={cn(
          'apple-progress-container',
          sizeClasses[size]
        )}>
          <div 
            className="apple-progress-bar"
            style={{ 
              width: `${percentage}%`,
              transition: animated ? 'width 0.7s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'
            }}
          />
        </div>
      </div>
      
      <span className="apple-caption-enhanced font-medium">
        {value}/{max}
      </span>
    </div>
  );
};
