import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

/**
 * @deprecated Use JoyTextarea from src/components/joy instead.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-normal leading-6 text-slate-800 ring-offset-background placeholder:text-slate-400 placeholder:opacity-100 transition-colors duration-200 hover:border-slate-400 focus:border-teal-400 focus:outline-none focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-100",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
