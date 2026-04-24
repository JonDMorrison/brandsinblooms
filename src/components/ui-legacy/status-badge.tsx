
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium transition-all duration-150",
  {
    variants: {
      variant: {
        preview: "bg-sky-50 text-sky-600 border border-sky-200",
        structured: "bg-blue-50 text-blue-600 border border-blue-200",
        draft: "bg-gray-50 text-gray-600 border border-gray-200",
        generated: "bg-green-50 text-green-600 border border-green-200",
        approved: "bg-emerald-50 text-emerald-600 border border-emerald-200",
        scheduled: "bg-amber-50 text-amber-600 border border-amber-200",
        posted: "bg-violet-50 text-violet-600 border border-violet-200",
        success: "bg-green-50 text-green-600 border border-green-200",
      },
    },
    defaultVariants: {
      variant: "draft",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {}

function StatusBadge({ className, variant, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ variant }), className)} {...props} />
  )
}

export { StatusBadge, statusBadgeVariants }
