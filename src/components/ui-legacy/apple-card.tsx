
import * as React from "react"
import { cn } from "@/lib/utils"

export interface AppleCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive';
  surface?: 'primary' | 'secondary' | 'tertiary';
}

const AppleCard = React.forwardRef<HTMLDivElement, AppleCardProps>(
  ({ className, variant = 'default', surface = 'primary', ...props }, ref) => {
    const variantClasses = {
      default: 'shadow-sm hover:shadow-md',
      elevated: 'shadow-lg hover:shadow-xl',
      interactive: 'shadow-sm hover:shadow-md hover:scale-[1.02] cursor-pointer active:scale-[0.99]'
    };

    const surfaceClasses = {
      primary: 'bg-surface-primary',
      secondary: 'bg-surface-secondary', 
      tertiary: 'bg-surface-tertiary'
    };

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border border-gray-200 transition-all duration-300 ease-apple",
          variantClasses[variant],
          surfaceClasses[surface],
          className
        )}
        {...props}
      />
    )
  }
)
AppleCard.displayName = "AppleCard"

const AppleCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6 pb-4", className)}
    {...props}
  />
))
AppleCardHeader.displayName = "AppleCardHeader"

const AppleCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold leading-tight text-text-primary",
      className
    )}
    {...props}
  />
))
AppleCardTitle.displayName = "AppleCardTitle"

const AppleCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-text-secondary leading-relaxed", className)}
    {...props}
  />
))
AppleCardDescription.displayName = "AppleCardDescription"

const AppleCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
AppleCardContent.displayName = "AppleCardContent"

const AppleCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between p-6 pt-0", className)}
    {...props}
  />
))
AppleCardFooter.displayName = "AppleCardFooter"

export { 
  AppleCard, 
  AppleCardHeader, 
  AppleCardFooter, 
  AppleCardTitle, 
  AppleCardDescription, 
  AppleCardContent 
}
