import * as React from "react"
import { cn } from "@/lib/utils"

export interface BotanicalCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'glass' | 'elevated' | 'interactive';
  hoverEffect?: 'none' | 'lift' | 'glow';
  animated?: boolean;
  staggerDelay?: number;
}

const BotanicalCard = React.forwardRef<HTMLDivElement, BotanicalCardProps>(
  ({ 
    className, 
    variant = 'glass', 
    hoverEffect = 'lift',
    animated = false,
    staggerDelay = 0,
    ...props 
  }, ref) => {
    const variantClasses = {
      glass: 'glass grad-border shadow-elev-2',
      elevated: 'bg-surface-1 shadow-elev-2 backdrop-blur-xs border border-white/12 rounded-2xl',
      interactive: 'glass grad-border shadow-elev-2 cursor-pointer'
    };

    const hoverClasses = {
      none: '',
      lift: 'hover:-translate-y-0.5 hover:shadow-glow',
      glow: 'hover:shadow-glow'
    };

    return (
      <div
        ref={ref}
        className={cn(
          "transition-all duration-base ease-brand",
          variantClasses[variant],
          hoverClasses[hoverEffect],
          animated && "animate-fadeScaleIn",
          className
        )}
        style={animated ? { animationDelay: `${staggerDelay}ms` } : undefined}
        {...props}
      />
    )
  }
)
BotanicalCard.displayName = "BotanicalCard"

export { BotanicalCard }