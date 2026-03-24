import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface DocLogoTileProps {
  name: string;
  icon: LucideIcon;
  logoSrc?: string;
  className?: string;
  iconClassName?: string;
  size?: "sm" | "md";
}

const sizeClasses = {
  sm: "h-7 w-7 rounded-lg",
  md: "h-10 w-10 rounded-xl",
};

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-5 w-5",
};

export function DocLogoTile({
  name,
  icon: Icon,
  logoSrc,
  className,
  iconClassName,
  size = "md",
}: DocLogoTileProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center border border-border/70 bg-white shadow-sm shadow-brand-navy/5",
        sizeClasses[size],
        className,
      )}
      aria-hidden="true"
    >
      {logoSrc ? (
        <img
          src={logoSrc}
          alt=""
          className={cn(
            "max-h-[70%] max-w-[70%] object-contain",
            size === "sm" ? "max-h-[65%] max-w-[65%]" : undefined,
          )}
        />
      ) : (
        <Icon
          className={cn("text-slate-700", iconSizeClasses[size], iconClassName)}
        />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}
