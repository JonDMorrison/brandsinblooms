/**
 * @deprecated Use JoyButton from @/components/joy/JoyButton for all new admin UI.
 * This shadcn button remains only for non-admin legacy surfaces.
 */
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-transparent text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-brand-teal text-white shadow-sm hover:brightness-95",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:brightness-95",
        outline:
          "border-slate-200 bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200 hover:text-slate-900",
        secondary:
          "border-slate-200 bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200 hover:text-slate-900",
        ghost:
          "bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900",
        link: "h-auto border-0 bg-transparent px-0 text-brand-teal shadow-none underline-offset-4 hover:bg-transparent hover:underline",
        success: "bg-green-700 text-white shadow-sm hover:bg-green-800",
        "soft-blue":
          "border-blue-200 bg-blue-50 text-blue-700 shadow-none hover:bg-blue-100 hover:text-blue-800",
        cta: "w-full rounded-[20px] border-0 bg-cta text-white shadow-lg transition-all duration-300 hover:scale-[1.01] hover:bg-cta/90 hover:shadow-xl sm:w-auto",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-10 rounded-lg px-4",
        icon: "h-9 w-9",
        pill: "h-9 rounded-full px-4 py-2",
        cta: "px-8 py-4 text-lg sm:px-12 sm:py-6 sm:text-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const NON_VISUAL_TEXT_UTILITIES = new Set([
  "text-left",
  "text-center",
  "text-right",
  "text-justify",
  "text-ellipsis",
  "text-clip",
  "text-balance",
  "text-wrap",
  "text-nowrap",
]);

const getTailwindUtility = (token: string) => {
  const segments = token.split(":");
  const utility = segments.at(-1) ?? token;

  return utility.replace(/^!/, "");
};

const stripVisualButtonClasses = (value: string | undefined) => {
  if (!value) {
    return value;
  }

  return value
    .split(/\s+/)
    .filter((token) => {
      if (!token) {
        return false;
      }

      const utility = getTailwindUtility(token);

      if (/^(bg|from|via|to|border|rounded|shadow|ring)(?:-|$)/.test(utility)) {
        return false;
      }

      if (/^(fill|stroke)-(?!none$|current$)/.test(utility)) {
        return false;
      }

      if (/^text-/.test(utility) && !NON_VISUAL_TEXT_UTILITIES.has(utility)) {
        return false;
      }

      return true;
    })
    .join(" ");
};

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const resolvedClassName = stripVisualButtonClasses(className);

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), resolvedClassName)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
