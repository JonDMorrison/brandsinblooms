import * as React from "react"
import { cn } from "@/lib/utils"

export interface BotanicalModalProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const BotanicalModal = React.forwardRef<HTMLDivElement, BotanicalModalProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "glass grad-border p-6 shadow-elev-2 animate-fadeScaleIn",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
BotanicalModal.displayName = "BotanicalModal"

export { BotanicalModal }