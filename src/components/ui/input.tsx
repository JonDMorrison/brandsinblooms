
import * as React from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, Check } from "lucide-react"

export interface InputProps extends React.ComponentProps<"input"> {
  variant?: 'default' | 'success' | 'error';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
  label?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ 
    className, 
    type, 
    variant = 'default',
    leftIcon,
    rightIcon,
    helperText,
    label,
    id,
    ...props 
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    
    const variantClasses = {
      default: 'border-input focus-visible:ring-garden-green',
      success: 'border-green-300 focus-visible:ring-green-500 bg-green-50/50',
      error: 'border-red-300 focus-visible:ring-red-500 bg-red-50/50'
    };

    const getStatusIcon = () => {
      if (variant === 'success') return <Check className="w-4 h-4 text-green-600" />;
      if (variant === 'error') return <AlertCircle className="w-4 h-4 text-red-600" />;
      return rightIcon;
    };

    return (
      <div className="space-y-2">
        {label && (
          <label 
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700 block apple-color-transition"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
              {leftIcon}
            </div>
          )}
          
          <input
            type={type}
            id={inputId}
            className={cn(
              "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200 ease-apple apple-focus-ring",
              leftIcon && "pl-10",
              (rightIcon || variant !== 'default') && "pr-10",
              variantClasses[variant],
              className
            )}
            ref={ref}
            {...props}
          />
          
          {(rightIcon || variant !== 'default') && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {getStatusIcon()}
            </div>
          )}
        </div>
        
        {helperText && (
          <p className={cn(
            "text-xs transition-colors duration-200 ease-apple",
            variant === 'error' ? "text-red-600" : 
            variant === 'success' ? "text-green-600" : 
            "text-gray-500"
          )}>
            {helperText}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
