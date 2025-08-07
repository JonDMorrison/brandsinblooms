import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80 hover:shadow-sm hover:scale-105",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm hover:scale-105",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 hover:shadow-sm hover:scale-105",
        outline: "text-foreground hover:shadow-sm hover:scale-105",
        
        // Unified status variants using new tokens
        draft: "status-badge status-draft",
        generated: "status-badge status-generated", 
        review: "status-badge status-review",
        approved: "status-badge status-approved",
        scheduled: "status-badge status-scheduled",
        posted: "status-badge status-posted",
        
        // Platform variants
        newsletter: "status-badge platform-newsletter",
        facebook: "status-badge platform-facebook", 
        instagram: "status-badge platform-instagram",
        video: "status-badge platform-video",
        linkedin: "status-badge platform-linkedin",
        email: "status-badge platform-email",
        
        // Semantic variants (keeping existing ones but enhanced)
        warning:
          "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200 hover:shadow-sm hover:scale-105",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200 hover:shadow-sm hover:scale-105",
        info:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-sm hover:scale-105",
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

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        className={cn(badgeVariants({ variant }), className)}
        ref={ref}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
