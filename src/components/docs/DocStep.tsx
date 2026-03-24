import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface DocStepProps {
  stepNumber: number | string;
  stepTitle: string;
  children: ReactNode;
  isLast?: boolean;
}

export function DocStep({
  stepNumber,
  stepTitle,
  children,
  isLast = false,
}: DocStepProps) {
  return (
    <div className={cn("relative flex gap-4", !isLast && "pb-6")}>
      {!isLast ? (
        <div
          className="absolute left-3 top-6 bottom-0 w-px bg-gray-200"
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
        <span className="font-mono text-xs font-bold">{stepNumber}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-sm font-semibold text-foreground">
          {stepTitle}
        </p>
        <div className="text-sm leading-7 text-muted-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
