import React from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function DisplayMedium({
  children,
  className,
  ...props
}: TypographyProps) {
  return (
    <h1
      className={cn("text-4xl font-bold tracking-tight", className)}
      {...props}
    >
      {children}
    </h1>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function HeadlineLarge({
  children,
  className,
  ...props
}: TypographyProps) {
  return (
    <h1
      className={cn("text-3xl font-bold tracking-tight", className)}
      {...props}
    >
      {children}
    </h1>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function HeadlineMedium({
  children,
  className,
  ...props
}: TypographyProps) {
  return (
    <h2
      className={cn("text-2xl font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h2>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function HeadlineSmall({
  children,
  className,
  ...props
}: TypographyProps) {
  return (
    <h3
      className={cn("text-xl font-semibold tracking-tight", className)}
      {...props}
    >
      {children}
    </h3>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function BodyLarge({ children, className, ...props }: TypographyProps) {
  return (
    <p className={cn("text-lg leading-7", className)} {...props}>
      {children}
    </p>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function BodyMedium({ children, className, ...props }: TypographyProps) {
  return (
    <p className={cn("text-base leading-6", className)} {...props}>
      {children}
    </p>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function BodySmall({ children, className, ...props }: TypographyProps) {
  return (
    <p className={cn("text-sm leading-5", className)} {...props}>
      {children}
    </p>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function Caption({ children, className, ...props }: TypographyProps) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)} {...props}>
      {children}
    </span>
  );
}

/**
 * @deprecated Use Joy Typography directly instead.
 */
export function CaptionMedium({
  children,
  className,
  ...props
}: TypographyProps) {
  return (
    <span className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </span>
  );
}
