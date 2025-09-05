
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] micro-bounce",
  {
    variants: {
      variant: {
        default: "bg-brand-teal text-white hover:brightness-95 shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-95 shadow-sm",
        outline:
          "border border-brand-teal bg-background text-brand-teal hover:bg-brand-teal hover:text-white",
        secondary:
          "bg-gray-100 text-brand-navy hover:bg-gray-200",
        ghost: "text-brand-navy hover:bg-gray-100",
        link: "text-brand-teal underline-offset-4 hover:underline",
        success: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
        "soft-blue": "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200",
        cta: "bg-cta text-white hover:bg-cta/90 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 font-semibold w-full sm:w-auto border-0",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        pill: "h-9 px-4 py-2",
        cta: "px-8 py-4 text-lg sm:px-12 sm:py-6 sm:text-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

/* Enhanced button animations */
const styles = `
@keyframes pulse-once {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes scale-in {
  0% { transform: scale(0); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.animate-pulse-once {
  animation: pulse-once 0.6s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.3s ease-out;
}
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
