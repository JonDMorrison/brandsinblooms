import * as React from "react";
import { cn } from "@/lib/utils";

export interface NativeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

/**
 * @deprecated Use JoySelect from @/components/joy/JoySelect instead.
 */

const NativeSelect = React.forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ className, children, label, options, placeholder, id, ...props }, ref) => {
    const selectId =
      id ?? `native-select-${Math.random().toString(36).slice(2, 11)}`;

    return (
      <div className="space-y-1">
        {label && (
          <label
            className="text-sm font-medium text-foreground"
            htmlFor={selectId}
          >
            {label}
          </label>
        )}
        <select
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          ref={ref}
          id={selectId}
          {...props}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options
            ? options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))
            : children}
        </select>
      </div>
    );
  },
);
NativeSelect.displayName = "NativeSelect";

export { NativeSelect };
