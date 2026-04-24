import React from "react";
import { cn } from "@/lib/utils";

interface TipBoxProps {
  children: React.ReactNode;
  className?: string;
}

export function TipBox({ children, className }: TipBoxProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700",
        className
      )}
    >
      {children}
    </div>
  );
}
