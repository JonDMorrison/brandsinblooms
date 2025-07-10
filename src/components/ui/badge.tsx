import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        // Core variants using simplified palette
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
        secondary:
          "border-gray-300 bg-white text-secondary hover:bg-gray-50",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: 
          "border-gray-300 text-gray-700 hover:bg-gray-50",
        
        // Simplified status variants
        draft: "border-transparent bg-gray-100 text-gray-700",
        generated: "border-transparent bg-gray-100 text-gray-700", 
        review: "border-transparent bg-gray-100 text-gray-700",
        approved: "border-transparent bg-primary text-white",
        scheduled: "border-transparent bg-gray-100 text-gray-700",
        posted: "border-transparent bg-primary text-white",
        
        // Simplified semantic variants
        success: "border-transparent bg-primary text-white",
        warning: "border-transparent bg-gray-100 text-gray-700",
        info: "border-transparent bg-gray-100 text-gray-700"
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
