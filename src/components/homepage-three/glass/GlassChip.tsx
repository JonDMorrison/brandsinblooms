import type { HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

export type GlassChipVariant = "default" | "green" | "dark";

export interface GlassChipProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: GlassChipVariant;
  className?: string;
  children: ReactNode;
}

export const GlassChip = ({
  variant = "default",
  className,
  children,
  ...props
}: GlassChipProps) => (
  <span
    className={joinClassNames(
      "hp-glass-chip",
      `hp-glass-chip--${variant}`,
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
