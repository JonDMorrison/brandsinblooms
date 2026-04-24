import * as React from "react";
import JoyBaseChip, { type ChipProps as JoyBaseChipProps } from "@mui/joy/Chip";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

type NativeJoyChipColor = NonNullable<JoyBaseChipProps["color"]>;
type NativeJoyChipVariant = NonNullable<JoyBaseChipProps["variant"]>;
type NativeJoyChipSize = NonNullable<JoyBaseChipProps["size"]>;

export type BloomChipVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

export type JoyChipSize = NativeJoyChipSize | "default";
type JoyChipVariantProp = NativeJoyChipVariant | BloomChipVariant;

export interface JoyChipProps extends Omit<
  JoyBaseChipProps,
  "color" | "size" | "variant"
> {
  bloomVariant?: BloomChipVariant;
  color?: NativeJoyChipColor;
  size?: JoyChipSize;
  variant?: JoyChipVariantProp;
}

export interface JoyStatusChipProps extends Omit<
  JoyChipProps,
  "children" | "color"
> {
  status: string;
  label?: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
}

const LEGACY_VARIANTS = new Set<BloomChipVariant>([
  "default",
  "secondary",
  "destructive",
  "outline",
  "success",
  "warning",
  "info",
]);

const resolveNativeSize = (
  size: JoyChipSize | undefined,
): NativeJoyChipSize => {
  if (!size || size === "default") {
    return "sm";
  }

  return size;
};

const resolveLegacyVariant = (
  bloomVariant: BloomChipVariant | undefined,
  variant: JoyChipVariantProp | undefined,
) => {
  if (bloomVariant) {
    return bloomVariant;
  }

  return variant && LEGACY_VARIANTS.has(variant as BloomChipVariant)
    ? (variant as BloomChipVariant)
    : undefined;
};

const resolveVariantConfig = (
  bloomVariant: BloomChipVariant | undefined,
  variant: JoyChipVariantProp | undefined,
  color: NativeJoyChipColor | undefined,
) => {
  const legacyVariant = resolveLegacyVariant(bloomVariant, variant);

  if (!legacyVariant) {
    return {
      color: color ?? "neutral",
      variant: (variant as NativeJoyChipVariant | undefined) ?? "soft",
    };
  }

  switch (legacyVariant) {
    case "default":
      return { color: "primary" as const, variant: "solid" as const };
    case "secondary":
      return { color: "neutral" as const, variant: "soft" as const };
    case "destructive":
      return { color: "danger" as const, variant: "solid" as const };
    case "outline":
      return { color: "neutral" as const, variant: "soft" as const };
    case "success":
      return { color: "success" as const, variant: "soft" as const };
    case "warning":
      return { color: "warning" as const, variant: "soft" as const };
    case "info":
      return { color: "primary" as const, variant: "soft" as const };
  }
};

const formatStatusLabel = (status: string) =>
  status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const resolveStatusTone = (status: string): JoyStatusChipProps["tone"] => {
  const normalized = status.trim().toLowerCase();

  if (
    [
      "active",
      "approved",
      "completed",
      "delivered",
      "enabled",
      "healthy",
      "paid",
      "resolved",
      "sent",
      "success",
      "verified",
    ].includes(normalized)
  ) {
    return "success";
  }

  if (
    [
      "critical",
      "danger",
      "declining",
      "disabled",
      "error",
      "expired",
      "failed",
      "urgent",
      "rejected",
      "blocked",
    ].includes(normalized)
  ) {
    return "danger";
  }

  if (
    [
      "trial",
      "trialing",
      "warning",
      "pending",
      "queued",
      "paused",
      "scheduled",
      "investigating",
      "high",
    ].includes(normalized)
  ) {
    return "warning";
  }

  if (["open", "verifying", "processing", "medium"].includes(normalized)) {
    return "info";
  }

  return "neutral";
};

const toneColorMap: Record<
  NonNullable<JoyStatusChipProps["tone"]>,
  NativeJoyChipColor
> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "neutral",
  info: "primary",
};

export const JoyChip = React.forwardRef<HTMLDivElement, JoyChipProps>(
  ({ bloomVariant, color, size = "default", sx, variant, ...props }, ref) => {
    const resolvedSize = resolveNativeSize(size);
    const resolvedConfig = resolveVariantConfig(bloomVariant, variant, color);

    return (
      <JoyBaseChip
        ref={ref}
        color={resolvedConfig.color}
        size={resolvedSize}
        variant={resolvedConfig.variant}
        sx={mergeSx(
          {
            borderRadius: 999,
            fontWeight: "var(--joy-fontWeight-medium)",
            textTransform: "none",
            whiteSpace: "nowrap",
          },
          sx,
        )}
        {...props}
      />
    );
  },
);

JoyChip.displayName = "JoyChip";

export const JoyStatusChip = React.forwardRef<
  HTMLDivElement,
  JoyStatusChipProps
>(({ label, status, tone, variant = "soft", ...props }, ref) => {
  const resolvedTone = tone ?? resolveStatusTone(status);

  return (
    <JoyChip
      ref={ref}
      color={toneColorMap[resolvedTone]}
      variant={variant}
      {...props}
    >
      {label ?? formatStatusLabel(status)}
    </JoyChip>
  );
});

JoyStatusChip.displayName = "JoyStatusChip";
