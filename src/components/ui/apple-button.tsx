
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const appleButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary: "bg-garden-green text-white hover:bg-garden-green-dark shadow-sm",
        secondary: "bg-transparent border border-gray-300 text-text-primary hover:bg-gray-50",
        tertiary: "bg-transparent text-garden-green hover:bg-garden-green/10",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
        success: "bg-garden-green text-white hover:bg-garden-green-dark shadow-sm",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        default: "h-11 px-6 text-base",
        lg: "h-12 px-8 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface AppleButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof appleButtonVariants> {
  asChild?: boolean
}

const AppleButton = React.forwardRef<HTMLButtonElement, AppleButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(appleButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
AppleButton.displayName = "AppleButton"

export { AppleButton, appleButtonVariants }
