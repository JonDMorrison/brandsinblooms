import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

type DocCalloutVariant = "info" | "warning" | "success" | "danger";

interface DocCalloutProps {
  variant?: DocCalloutVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantMap = {
  info: {
    icon: Info,
    container: "border-l-[3px] border-l-blue-500 bg-blue-50 text-blue-900",
    iconClassName: "text-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    container: "border-l-[3px] border-l-amber-500 bg-amber-50 text-amber-900",
    iconClassName: "text-amber-500",
  },
  success: {
    icon: CheckCircle2,
    container:
      "border-l-[3px] border-l-emerald-500 bg-emerald-50 text-emerald-900",
    iconClassName: "text-emerald-500",
  },
  danger: {
    icon: ShieldAlert,
    container: "border-l-[3px] border-l-red-500 bg-red-50 text-red-900",
    iconClassName: "text-red-500",
  },
} as const;

export function DocCallout({
  variant = "info",
  title,
  children,
  className,
}: DocCalloutProps) {
  const config = variantMap[variant];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "rounded-r-lg rounded-l-none px-4 py-3",
        config.container,
        className,
      )}
    >
      <div className="flex gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", config.iconClassName)} />
        <div className="min-w-0">
          {title ? <p className="mb-1 text-sm font-semibold">{title}</p> : null}
          <div className="text-sm leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
