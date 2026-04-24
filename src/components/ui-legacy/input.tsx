import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Check } from "lucide-react";

export interface InputProps extends React.ComponentProps<"input"> {
  variant?: "default" | "success" | "error";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  helperText?: string;
  label?: string;
}

/**
 * @deprecated Use JoyInput or JoySearchInput from src/components/joy instead.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      variant = "default",
      leftIcon,
      rightIcon,
      helperText,
      label,
      id,
      ...props
    },
    ref,
  ) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    const variantClasses = {
      default:
        "border-slate-300 bg-white text-slate-800 hover:border-slate-400 focus:border-teal-400 focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400",
      success:
        "border-green-400 bg-white text-slate-800 hover:border-green-500 focus:border-green-500 focus-visible:border-green-400 focus-visible:ring-0",
      error:
        "border-red-400 bg-red-50/30 text-slate-800 hover:border-red-400 focus:border-red-400 focus-visible:border-red-400 focus-visible:ring-0",
    };

    const getStatusIcon = () => {
      if (variant === "success")
        return <Check className="w-4 h-4 text-green-600" />;
      if (variant === "error")
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      return rightIcon;
    };

    return (
      <div className="w-full space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[13px] font-medium leading-[1.4] text-slate-600 apple-color-transition"
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
              "flex h-9 w-full rounded-lg border px-3 py-2 text-sm font-normal leading-6 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-normal placeholder:text-slate-400 placeholder:opacity-100 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-100 transition-colors duration-200 ease-apple",
              leftIcon && "pl-10",
              (rightIcon || variant !== "default") && "pr-10",
              variantClasses[variant],
              className,
            )}
            ref={ref}
            {...props}
          />

          {(rightIcon || variant !== "default") && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {getStatusIcon()}
            </div>
          )}
        </div>

        {helperText && (
          <p
            className={cn(
              "text-xs font-normal leading-[1.4] transition-colors duration-200 ease-apple",
              variant === "error"
                ? "text-red-600"
                : variant === "success"
                  ? "text-green-600"
                  : "text-slate-500",
            )}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
