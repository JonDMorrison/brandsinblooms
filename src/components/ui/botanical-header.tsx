import * as React from "react"
import { cn } from "@/lib/utils"

export interface BotanicalHeaderProps extends React.HTMLAttributes<HTMLElement> {
  variant?: 'default' | 'sticky';
  children: React.ReactNode;
}

const BotanicalHeader = React.forwardRef<HTMLElement, BotanicalHeaderProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantClasses = {
      default: 'glass grad-border',
      sticky: 'sticky top-0 z-50 glass grad-border'
    };

    return (
      <header
        ref={ref}
        className={cn(
          "px-4 py-3",
          variantClasses[variant],
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          {children}
        </div>
      </header>
    )
  }
)
BotanicalHeader.displayName = "BotanicalHeader"

export { BotanicalHeader }