import * as React from "react"
import { cn } from "@/lib/utils"

interface ActionGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ActionGroup = React.forwardRef<HTMLDivElement, ActionGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex rounded-full bg-gray-100 p-1 gap-1",
          className
        )}
        {...props}
      >
        {React.Children.map(children, (child, index) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              ...child.props,
              size: "pill",
              className: cn(
                "rounded-full font-medium transition-all duration-200",
                child.props.className
              ),
            })
          }
          return child
        })}
      </div>
    )
  }
)
ActionGroup.displayName = "ActionGroup"

export { ActionGroup }