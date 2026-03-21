import React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface CRMMetricCardProps {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  icon: LucideIcon;
  iconClassName: string;
  iconWrapClassName: string;
  appearance?: "default" | "flat";
  valueClassName?: string;
  subtitleClassName?: string;
  className?: string;
}

export function CRMMetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  iconWrapClassName,
  appearance = "default",
  valueClassName,
  subtitleClassName,
  className,
}: CRMMetricCardProps) {
  return (
    <div
      className={cn(
        "group flex h-full min-h-[152px] flex-col rounded-2xl border border-border/70 px-4 py-4 shadow-sm transition-all duration-200",
        appearance === "default"
          ? "bg-gradient-to-br from-white via-white to-slate-50/70 hover:-translate-y-0.5 hover:shadow-md"
          : "bg-white",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <span
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
            iconWrapClassName,
          )}
        >
          <Icon className={cn("h-4.5 w-4.5", iconClassName)} />
        </span>
      </div>
      <div
        className={cn(
          "mt-4 line-clamp-2 break-words text-3xl font-semibold tracking-tight text-foreground",
          valueClassName,
        )}
      >
        {value}
      </div>
      {subtitle ? (
        <div
          className={cn(
            "mt-1.5 line-clamp-2 text-sm text-muted-foreground",
            subtitleClassName,
          )}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
