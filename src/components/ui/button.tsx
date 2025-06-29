
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-garden-green focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-garden-green text-white hover:bg-garden-green-dark",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-garden-green bg-background text-garden-green hover:bg-garden-green hover:text-white",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-garden-green underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
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

/* Add custom animations for approve button */
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

/* CRITICAL: Force garden green for all outline buttons globally */
button[data-variant="outline"],
.outline {
  border-color: rgb(76 175 80) !important;
  color: rgb(76 175 80) !important;
  background-color: transparent !important;
}

button[data-variant="outline"]:hover,
.outline:hover {
  background-color: rgb(76 175 80) !important;
  color: white !important;
  border-color: rgb(76 175 80) !important;
}

button[data-variant="outline"]:focus,
.outline:focus {
  border-color: rgb(76 175 80) !important;
  box-shadow: 0 0 0 2px rgb(76 175 80 / 0.2) !important;
}
`;

// Inject styles into document head
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
