import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

const fieldTriggerVariants = cva(
  "inline-flex items-center justify-between w-full whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
  {
    variants: {
      size: {
        sm: "h-9 px-3",
        default: "h-10 px-3",
        lg: "h-11 px-4",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export interface FieldTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof fieldTriggerVariants> {
  placeholder?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  showChevron?: boolean
}

const FieldTrigger = React.forwardRef<HTMLButtonElement, FieldTriggerProps>(
  ({ 
    className, 
    size, 
    placeholder = "Select...", 
    leadingIcon, 
    trailingIcon, 
    showChevron = true,
    children,
    ...props 
  }, ref) => {
    return (
      <button
        type="button"
        className={cn(fieldTriggerVariants({ size, className }))}
        ref={ref}
        {...props}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {leadingIcon}
          <span className={cn(
            "truncate text-left",
            !children && "text-muted-foreground"
          )}>
            {children || placeholder}
          </span>
        </div>
        {trailingIcon || (showChevron && (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ))}
      </button>
    )
  }
)
FieldTrigger.displayName = "FieldTrigger"

export { FieldTrigger, fieldTriggerVariants }