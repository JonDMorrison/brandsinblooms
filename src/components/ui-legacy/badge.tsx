import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

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

        // Unified status variants using inline Tailwind classes.
        draft:
          "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm hover:scale-105",
        generated:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-sm hover:scale-105",
        review:
          "border-transparent bg-violet-100 text-violet-800 hover:bg-violet-200 hover:shadow-sm hover:scale-105",
        approved:
          "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200 hover:shadow-sm hover:scale-105",
        scheduled:
          "border-transparent bg-amber-100 text-amber-800 hover:bg-amber-200 hover:shadow-sm hover:scale-105",
        posted:
          "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-200 hover:shadow-sm hover:scale-105",

        // Platform variants
        newsletter:
          "border-transparent bg-sky-100 text-sky-800 hover:bg-sky-200 hover:shadow-sm hover:scale-105",
        facebook:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-sm hover:scale-105",
        instagram:
          "border-transparent bg-pink-100 text-pink-800 hover:bg-pink-200 hover:shadow-sm hover:scale-105",
        video:
          "border-transparent bg-red-100 text-red-800 hover:bg-red-200 hover:shadow-sm hover:scale-105",
        linkedin:
          "border-transparent bg-indigo-100 text-indigo-800 hover:bg-indigo-200 hover:shadow-sm hover:scale-105",
        email:
          "border-transparent bg-cyan-100 text-cyan-800 hover:bg-cyan-200 hover:shadow-sm hover:scale-105",

        // Semantic variants (keeping existing ones but enhanced)
        warning:
          "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200 hover:shadow-sm hover:scale-105",
        success:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200 hover:shadow-sm hover:scale-105",
        info: "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-sm hover:scale-105",

        // Governance risk variants (4-tier) - names intentionally avoid 'yellow'/'orange'
        govHealthy:
          "border-transparent bg-green-100 text-green-800 hover:bg-green-200 hover:shadow-sm hover:scale-105",
        govElevated:
          "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-200 hover:shadow-sm hover:scale-105",
        govHigh:
          "border-transparent bg-orange-100 text-orange-800 hover:bg-orange-200 hover:shadow-sm hover:scale-105",
        govCritical:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80 hover:shadow-sm hover:scale-105",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * @deprecated Use JoyChip or JoyStatusChip from '@/components/joy/JoyChip' instead.
 */
const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    const allowRiskColors =
      variant === "govHealthy" ||
      variant === "govElevated" ||
      variant === "govHigh" ||
      variant === "govCritical";

    return (
      <div
        className={cn(badgeVariants({ variant }), className)}
        ref={ref}
        data-allow-risk-colors={allowRiskColors ? "true" : undefined}
        {...props}
      />
    );
  },
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
