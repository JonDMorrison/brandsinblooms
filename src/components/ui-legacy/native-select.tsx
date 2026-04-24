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
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    return (
      <div className="space-y-1">
        {label && (
          <label
            className="text-[13px] font-medium leading-[1.4] text-slate-600"
            htmlFor={selectId}
          >
            {label}
          </label>
        )}
        <select
          className={cn(
            "flex h-9 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal leading-6 text-slate-800 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-normal transition-colors duration-200 hover:border-slate-400 focus:border-teal-400 focus:outline-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100",
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
