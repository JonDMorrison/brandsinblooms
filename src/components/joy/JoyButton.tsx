import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import Box from "@mui/joy/Box";
import JoyBaseButton, {
  type ButtonProps as JoyBaseButtonProps,
} from "@mui/joy/Button";
import CircularProgress from "@mui/joy/CircularProgress";
import JoyBaseIconButton, {
  type IconButtonProps as JoyBaseIconButtonProps,
} from "@mui/joy/IconButton";
import type { SxProps } from "@mui/joy/styles/types";
import { mergeSx } from "@/components/joy/mergeSx";

type NativeJoyVariant = NonNullable<JoyBaseButtonProps["variant"]>;
type NativeJoyColor = NonNullable<JoyBaseButtonProps["color"]>;
type NativeJoySize = NonNullable<JoyBaseButtonProps["size"]>;

export type BloomButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "destructiveOutline"
  | "cta"
  | "link";

export type JoyButtonSize = NativeJoySize | "default" | "icon";

type JoyButtonVariantProp = NativeJoyVariant | BloomButtonVariant;

type CommonProps = {
  bloomVariant?: BloomButtonVariant;
  size?: JoyButtonSize;
  variant?: JoyButtonVariantProp;
  color?: NativeJoyColor;
};

export type JoyButtonProps = Omit<JoyBaseButtonProps, "size" | "variant"> &
  CommonProps;

const ICON_SIZES: Record<NativeJoySize, number> = {
  sm: 16,
  md: 18,
  lg: 20,
};

const BUTTON_DIMENSIONS: Record<NativeJoySize, SxProps> = {
  sm: {
    minHeight: 32,
    px: 1.5,
    py: 0.75,
    fontSize: "var(--joy-fontSize-xs)",
    fontWeight: "var(--joy-fontWeight-medium)",
  },
  md: {
    minHeight: 40,
    px: 2,
    py: 1,
    fontSize: "var(--joy-fontSize-sm)",
    fontWeight: "var(--joy-fontWeight-medium)",
  },
  lg: {
    minHeight: 48,
    px: 2.5,
    py: 1.25,
    fontSize: "var(--joy-fontSize-md)",
    fontWeight: "var(--joy-fontWeight-medium)",
  },
};

const ICON_BUTTON_DIMENSIONS: Record<NativeJoySize, SxProps> = {
  sm: {
    width: 32,
    height: 32,
  },
  md: {
    width: 40,
    height: 40,
  },
  lg: {
    width: 48,
    height: 48,
  },
};

const LEGACY_VARIANTS = new Set<BloomButtonVariant>([
  "default",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "destructiveOutline",
  "cta",
  "link",
]);

const resolveNativeSize = (size: JoyButtonSize | undefined): NativeJoySize => {
  if (!size || size === "default" || size === "icon") {
    return "sm";
  }

  return size;
};

const resolveLegacyVariant = (
  bloomVariant: BloomButtonVariant | undefined,
  variant: JoyButtonVariantProp | undefined,
) => {
  if (bloomVariant) {
    return bloomVariant;
  }

  return variant && LEGACY_VARIANTS.has(variant as BloomButtonVariant)
    ? (variant as BloomButtonVariant)
    : undefined;
};

const resolveVariantConfig = (
  bloomVariant: BloomButtonVariant | undefined,
  variant: JoyButtonVariantProp | undefined,
  color: NativeJoyColor | undefined,
) => {
  const legacyVariant = resolveLegacyVariant(bloomVariant, variant);

  if (!legacyVariant) {
    return {
      variant: (variant as NativeJoyVariant | undefined) ?? "solid",
      color: color ?? "primary",
      sx: undefined as SxProps | undefined,
    };
  }

  switch (legacyVariant) {
    case "default":
      return {
        variant: "solid" as const,
        color: (color ?? "primary") as const,
        sx: undefined,
      };
    case "outline":
      return {
        variant: "soft" as const,
        color: (color ?? "neutral") as const,
        sx: undefined,
      };
    case "secondary":
      return {
        variant: "soft" as const,
        color: (color ?? "neutral") as const,
        sx: undefined,
      };
    case "ghost":
      return {
        variant: "plain" as const,
        color: (color ?? "neutral") as const,
        sx: undefined,
      };
    case "destructive":
      return {
        variant: "solid" as const,
        color: (color ?? "danger") as const,
        sx: undefined,
      };
    case "destructiveOutline":
      return {
        variant: "solid" as const,
        color: (color ?? "danger") as const,
        sx: undefined,
      };
    case "cta":
      return {
        variant: "solid" as const,
        color: (color ?? "primary") as const,
        sx: {
          px: { xs: 3, sm: 4.5 },
          py: { xs: 1.5, sm: 1.75 },
          borderRadius: "var(--joy-radius-2xl)",
          boxShadow: "var(--joy-shadow-lg)",
          fontWeight: "var(--joy-fontWeight-semibold)",
          "&:hover": {
            boxShadow: "var(--joy-shadow-hover)",
          },
        },
      };
    case "link":
      return {
        variant: "plain" as const,
        color: (color ?? "primary") as const,
        sx: {
          px: 0,
          minHeight: "auto",
          "&:hover": {
            textDecoration: "underline",
            backgroundColor: "transparent",
          },
        },
      };
  }
};

const createLoadingIndicator = (size: NativeJoySize) => (
  <CircularProgress
    size="sm"
    thickness={3}
    sx={{
      color: "currentColor",
      "--CircularProgress-size": `${ICON_SIZES[size]}px`,
    }}
  />
);

const decoratorSx = (iconSize: number): SxProps => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  "& > .lucide": {
    width: `${iconSize}px`,
    height: `${iconSize}px`,
  },
  "& > .MuiSvgIcon-root": {
    fontSize: `${iconSize}px`,
  },
  "& > *": {
    flexShrink: 0,
  },
});

const normalizeDecorator = (
  decorator: ReactNode,
  iconSize: number,
): ReactNode => {
  if (!decorator) {
    return decorator;
  }

  return <Box sx={decoratorSx(iconSize)}>{decorator}</Box>;
};

const stripLegacySpacingClasses = (value: string | undefined) => {
  if (!value) {
    return value;
  }

  return value
    .split(/\s+/)
    .filter(
      (token) =>
        token &&
        !/^m[rlxy]?-[0-9]+$/.test(token) &&
        !/^size-[0-9]+$/.test(token),
    )
    .join(" ");
};

const extractLegacyStartDecorator = (
  children: ReactNode,
  iconSize: number,
  startDecorator: ReactNode,
) => {
  if (startDecorator) {
    return {
      startDecorator: normalizeDecorator(startDecorator, iconSize),
      children,
    };
  }

  const childArray = Children.toArray(children);
  const firstChild = childArray[0];

  if (!isValidElement(firstChild)) {
    return { startDecorator: undefined, children };
  }

  const element = firstChild as ReactElement<{ className?: string }>;
  const elementType = element.type as { displayName?: string; name?: string };
  const isLikelyIcon =
    typeof element.type !== "string" &&
    (element.props.className?.includes("w-") ||
      element.props.className?.includes("h-") ||
      elementType.displayName?.includes("Icon") ||
      elementType.name?.includes("Icon") ||
      elementType.name?.includes("Rounded"));

  if (!isLikelyIcon) {
    return { startDecorator: undefined, children };
  }

  const normalizedIcon = cloneElement(element, {
    className: stripLegacySpacingClasses(element.props.className),
  });

  return {
    startDecorator: normalizeDecorator(normalizedIcon, iconSize),
    children: childArray.slice(1),
  };
};

const getSharedSx = (size: NativeJoySize, iconSize: number): SxProps => ({
  ...BUTTON_DIMENSIONS[size],
  borderRadius: "var(--joy-radius-lg)",
  transition:
    "transform 150ms ease-out, background-color 150ms ease-out, border-color 150ms ease-out, box-shadow 150ms ease-out, color 150ms ease-out",
  "&:active": {
    transform: "scale(0.98)",
  },
  "&.Mui-focusVisible, &:focus-visible": {
    outline: 0,
    boxShadow: "0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.18)",
  },
  "&.Mui-disabled, &:disabled, &[aria-disabled='true']": {
    opacity: 0.5,
    pointerEvents: "none",
  },
  "& .lucide": {
    width: `${iconSize}px`,
    height: `${iconSize}px`,
  },
  "& .MuiSvgIcon-root": {
    fontSize: `${iconSize}px`,
  },
});

export const JoyButton = forwardRef<HTMLElement, JoyButtonProps>(
  function JoyButton(
    {
      bloomVariant,
      color,
      loading,
      loadingIndicator,
      size = "default",
      startDecorator,
      endDecorator,
      sx,
      variant,
      children,
      ...props
    },
    ref,
  ) {
    const nativeSize = resolveNativeSize(size);
    const iconSize = ICON_SIZES[nativeSize];
    const variantConfig = resolveVariantConfig(bloomVariant, variant, color);
    const extractedDecorator = extractLegacyStartDecorator(
      children,
      iconSize,
      startDecorator,
    );
    const resolvedLoadingIndicator =
      loadingIndicator ?? createLoadingIndicator(nativeSize);

    if (size === "icon") {
      const iconButtonProps = props as Omit<
        JoyBaseIconButtonProps,
        "size" | "variant"
      >;

      return (
        <JoyBaseIconButton
          {...iconButtonProps}
          ref={ref as never}
          color={variantConfig.color}
          loading={loading}
          loadingIndicator={resolvedLoadingIndicator}
          size={nativeSize}
          sx={mergeSx(
            ICON_BUTTON_DIMENSIONS[nativeSize],
            getSharedSx(nativeSize, iconSize),
            variantConfig.sx,
            sx,
          )}
          variant={variantConfig.variant}
        >
          {Children.toArray(extractedDecorator.children)[0] ?? children}
        </JoyBaseIconButton>
      );
    }

    return (
      <JoyBaseButton
        {...props}
        ref={ref as never}
        color={variantConfig.color}
        loading={loading}
        loadingIndicator={resolvedLoadingIndicator}
        size={nativeSize}
        startDecorator={extractedDecorator.startDecorator}
        endDecorator={normalizeDecorator(endDecorator, iconSize)}
        sx={mergeSx(getSharedSx(nativeSize, iconSize), variantConfig.sx, sx)}
        variant={variantConfig.variant}
      >
        {extractedDecorator.children}
      </JoyBaseButton>
    );
  },
);

JoyButton.displayName = "JoyButton";
