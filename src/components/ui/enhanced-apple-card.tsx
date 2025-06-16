
import * as React from "react"
import { cn } from "@/lib/utils"
import { AppleCard, AppleCardProps } from "./apple-card"

export interface EnhancedAppleCardProps extends AppleCardProps {
  animated?: boolean;
  hoverEffect?: 'subtle' | 'medium' | 'strong' | 'none';
  staggerDelay?: number;
}

const EnhancedAppleCard = React.forwardRef<HTMLDivElement, EnhancedAppleCardProps>(
  ({ 
    className, 
    variant = 'default', 
    surface = 'primary', 
    animated = true,
    hoverEffect = 'subtle',
    staggerDelay = 0,
    children,
    ...props 
  }, ref) => {
    const hoverClasses = {
      none: '',
      subtle: 'apple-hover-subtle',
      medium: 'apple-hover',
      strong: 'hover:scale-[1.03] hover:shadow-lg active:scale-[0.97]'
    };

    const animationClass = animated ? 'apple-fade-in' : '';
    const staggerClass = staggerDelay > 0 ? `apple-stagger-${Math.min(staggerDelay, 4)}` : '';

    return (
      <AppleCard
        ref={ref}
        variant={variant}
        surface={surface}
        className={cn(
          animationClass,
          staggerClass,
          hoverClasses[hoverEffect],
          'apple-color-transition',
          className
        )}
        style={{ animationDelay: staggerDelay > 4 ? `${staggerDelay * 0.1}s` : undefined }}
        {...props}
      >
        {children}
      </AppleCard>
    )
  }
)
EnhancedAppleCard.displayName = "EnhancedAppleCard"

export { EnhancedAppleCard }
