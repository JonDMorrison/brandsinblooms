import type { HTMLAttributes, ReactNode } from "react";
import { joinClassNames } from "./utils";
import "./glass.css";

export type GlassCardVariant = "default" | "elevated" | "dark" | "outlined";
export type GlassCardPadding = "none" | "sm" | "md" | "lg";

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant;
  padding?: GlassCardPadding;
  className?: string;
  children: ReactNode;
}

export const GlassCard = ({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: GlassCardProps) => (
  <div
    className={joinClassNames(
      "hp-glass-card",
      `hp-glass-card--${variant}`,
      `hp-glass-card--padding-${padding}`,
      className,
    )}
    {...props}
  >
    {children}
  </div>
);
