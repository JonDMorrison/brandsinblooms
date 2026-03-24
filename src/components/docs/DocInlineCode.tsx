import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

export function DocInlineCode({
  className,
  ...props
}: ComponentPropsWithoutRef<"code">) {
  return (
    <code
      className={cn(
        "rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-800",
        className,
      )}
      {...props}
    />
  );
}
