
import * as React from "react"
import { cn } from "@/lib/utils"

export interface EnhancedAppleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive';
  surface?: 'primary' | 'secondary' | 'tertiary';
  hoverEffect?: 'none' | 'subtle' | 'medium' | 'strong';
  animated?: boolean;
  staggerDelay?: number;
}

const EnhancedAppleCard = React.forwardRef<HTMLDivElement, EnhancedAppleCardProps>(
  ({ 
    className, 
    variant = 'default', 
    surface = 'primary', 
    hoverEffect = 'subtle',
    animated = false,
    staggerDelay = 0,
    ...props 
  }, ref) => {
    const variantClasses = {
      default: 'shadow-sm',
      elevated: 'shadow-lg',
      interactive: 'shadow-sm card-interactive cursor-pointer' // Uses new global interactive class
    };

    const surfaceClasses = {
      primary: 'bg-surface-primary',
      secondary: 'bg-surface-secondary', 
      tertiary: 'bg-surface-tertiary'
    };

    const hoverClasses = {
      none: '',
      subtle: 'hover:shadow-md',
      medium: 'hover:shadow-lg hover:scale-[1.01]',
      strong: 'hover:shadow-xl hover:scale-[1.02]'
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-gray-200 transition-all duration-300 ease-apple",
          variantClasses[variant],
          surfaceClasses[surface],
          hoverClasses[hoverEffect],
          animated && "apple-slide-up",
          className
        )}
        style={animated ? { animationDelay: `${staggerDelay}ms` } : undefined}
        {...props}
      />
    )
  }
)
EnhancedAppleCard.displayName = "EnhancedAppleCard"

export { EnhancedAppleCard }
