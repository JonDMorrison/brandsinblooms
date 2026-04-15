import type { ComponentProps } from "react";
import { AlertCircle, Check, Copy } from "lucide-react";

import type { CopyFeedbackState } from "@/hooks/useCopyFeedback";
import { cn } from "@/lib/utils";

import { Button } from "./button";

interface CopyButtonProps extends Omit<
  ComponentProps<typeof Button>,
  "children"
> {
  errorLabel?: string;
  idleLabel?: string;
  state?: CopyFeedbackState;
  successLabel?: string;
}

export function CopyButton({
  className,
  errorLabel = "Failed",
  idleLabel = "Copy",
  state = "idle",
  successLabel = "Copied!",
  type = "button",
  variant = "outline",
  ...props
}: CopyButtonProps) {
  const Icon =
    state === "success" ? Check : state === "error" ? AlertCircle : Copy;
  const label =
    state === "success"
      ? successLabel
      : state === "error"
        ? errorLabel
        : idleLabel;

  return (
    <Button
      type={type}
      variant={variant}
      className={cn(
        "h-11 min-w-[8.25rem] justify-center rounded-xl px-4 transition-colors duration-200",
        state === "success" &&
          "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        state === "error" &&
          "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
        className,
      )}
      {...props}
    >
      <Icon className="mr-2 h-4 w-4" />
      <span
        className="inline-flex min-w-[4.5rem] justify-center"
        aria-live="polite"
      >
        {label}
      </span>
    </Button>
  );
}
