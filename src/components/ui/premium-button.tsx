
import * as React from "react";
import { cn } from "@/lib/utils";
import { EnhancedAppleButton, EnhancedAppleButtonProps } from "./enhanced-apple-button";
import { PremiumIcon } from "./premium-icons";

interface PremiumButtonProps extends EnhancedAppleButtonProps {
  leadingIcon?: 'sparkles' | 'leaf' | 'check' | 'calendar' | 'analytics';
  premium?: boolean;
  celebration?: boolean;
}

export const PremiumButton = React.forwardRef<HTMLButtonElement, PremiumButtonProps>(
  ({ 
    children, 
    className, 
    leadingIcon,
    premium = false,
    celebration = false,
    ...props 
  }, ref) => {
    return (
      <EnhancedAppleButton
        ref={ref}
        className={cn(
          premium && 'apple-button-premium apple-ripple-effect',
          celebration && 'celebration-burst',
          className
        )}
        iconAnimation="bounce"
        rippleEffect={true}
        feedback="both"
        {...props}
      >
        {leadingIcon && (
          <PremiumIcon 
            icon={leadingIcon} 
            size="sm" 
            variant="default"
            className="mr-2"
          />
        )}
        {children}
      </EnhancedAppleButton>
    );
  }
);

PremiumButton.displayName = "PremiumButton";
