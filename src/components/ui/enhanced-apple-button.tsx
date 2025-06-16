
import * as React from "react"
import { cn } from "@/lib/utils"
import { AppleButton, AppleButtonProps } from "./apple-button"
import { Loader2 } from "lucide-react"

export interface EnhancedAppleButtonProps extends AppleButtonProps {
  loading?: boolean;
  iconAnimation?: 'bounce' | 'rotate' | 'none';
  pulseOnHover?: boolean;
}

const EnhancedAppleButton = React.forwardRef<HTMLButtonElement, EnhancedAppleButtonProps>(
  ({ 
    className, 
    children, 
    loading = false,
    iconAnimation = 'none',
    pulseOnHover = false,
    disabled,
    ...props 
  }, ref) => {
    const iconClasses = {
      bounce: 'apple-icon-bounce',
      rotate: 'apple-icon-rotate',
      none: ''
    };

    return (
      <AppleButton
        ref={ref}
        className={cn(
          'apple-button-press',
          'apple-focus-ring',
          pulseOnHover && 'hover:animate-[gentle-pulse_1s_ease-in-out_infinite]',
          iconClasses[iconAnimation],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        )}
        {children}
      </AppleButton>
    )
  }
)
EnhancedAppleButton.displayName = "EnhancedAppleButton"

export { EnhancedAppleButton }
