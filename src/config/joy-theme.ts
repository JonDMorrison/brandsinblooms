import { extendTheme } from "@mui/joy/styles";
import type { PaletteRange } from "@mui/joy/styles";

declare module "@mui/joy/styles" {
  interface ColorPalettePropOverrides {
    info: true;
    brandNavy: true;
    sand: true;
  }

  interface Palette {
    info: PaletteRange;
    brandNavy: PaletteRange;
    sand: PaletteRange;
    bridge: Record<string, string>;
  }

  interface RadiusOverrides {
    "2xl": true;
    cta: true;
  }

  interface ShadowOverrides {
    hover: true;
  }

  interface ZIndexOverrides {
    header: true;
    sidebar: true;
    overlay: true;
    popover: true;
    toast: true;
  }

  interface FontWeightOverrides {
    regular: true;
    medium: true;
    semibold: true;
    bold: true;
    extrabold: true;
  }

  interface LineHeightOverrides {
    prose: true;
  }
}

type Shade = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type Scale = Record<Shade, string>;

interface PaletteBuildOptions {
  solidColor?: string;
  solidBg?: Shade | string;
  solidHoverBg?: Shade | string;
  solidActiveBg?: Shade | string;
  plainColor?: Shade | string;
  outlinedColor?: Shade | string;
  softColor?: Shade | string;
}

const hexToRgbChannel = (hex: string) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => `${value}${value}`)
          .join("")
      : normalized;
  const color = Number.parseInt(expanded, 16);
  const red = (color >> 16) & 255;
  const green = (color >> 8) & 255;
  const blue = color & 255;

  return `${red} ${green} ${blue}`;
};

const paletteVar = (paletteName: string, token: Shade | string) =>
  `var(--joy-palette-${paletteName}-${token})`;

const resolvePaletteToken = (paletteName: string, token: Shade | string) =>
  typeof token === "number" ? paletteVar(paletteName, token) : token;

const createPaletteRange = (
  paletteName: string,
  scale: Scale,
  options: PaletteBuildOptions = {},
) => ({
  ...scale,
  lightChannel: hexToRgbChannel(scale[200]),
  mainChannel: hexToRgbChannel(scale[500]),
  darkChannel: hexToRgbChannel(scale[800]),
  plainColor: resolvePaletteToken(paletteName, options.plainColor ?? 700),
  plainHoverBg: paletteVar(paletteName, 100),
  plainActiveBg: paletteVar(paletteName, 200),
  plainDisabledColor: "var(--joy-palette-neutral-400)",
  outlinedColor: resolvePaletteToken(paletteName, options.outlinedColor ?? 700),
  outlinedBorder: paletteVar(paletteName, 300),
  outlinedHoverBg: paletteVar(paletteName, 50),
  outlinedHoverBorder: paletteVar(paletteName, 400),
  outlinedActiveBg: paletteVar(paletteName, 100),
  outlinedDisabledColor: "var(--joy-palette-neutral-400)",
  outlinedDisabledBorder: "var(--joy-palette-neutral-200)",
  softColor: resolvePaletteToken(paletteName, options.softColor ?? 800),
  softBg: paletteVar(paletteName, 100),
  softHoverBg: paletteVar(paletteName, 200),
  softActiveBg: paletteVar(paletteName, 300),
  softDisabledColor: "var(--joy-palette-neutral-400)",
  softDisabledBg: "var(--joy-palette-neutral-50)",
  solidColor: options.solidColor ?? "var(--joy-palette-common-white)",
  solidBg: resolvePaletteToken(paletteName, options.solidBg ?? 500),
  solidHoverBg: resolvePaletteToken(paletteName, options.solidHoverBg ?? 600),
  solidActiveBg: resolvePaletteToken(paletteName, options.solidActiveBg ?? 700),
  solidDisabledColor: "var(--joy-palette-neutral-400)",
  solidDisabledBg: "var(--joy-palette-neutral-100)",
});

const createFocusRing = (channel: string, width = 2, alpha = 0.18) =>
  `0 0 0 ${width}px rgba(${channel} / ${alpha})`;

export const bloomPaletteScales = {
  primary: {
    50: "#F0FFFE",
    100: "#E1FFFE",
    200: "#C3FFFC",
    300: "#A5FFFA",
    400: "#87DFD8",
    500: "#68BEB9",
    600: "#5AA8A3",
    700: "#4C928D",
    800: "#3E7C77",
    900: "#306661",
  },
  neutral: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#4B5563",
    800: "#1F2937",
    900: "#111827",
  },
  danger: {
    50: "#FEF2F2",
    100: "#FEE2E2",
    200: "#FECACA",
    300: "#FCA5A5",
    400: "#F87171",
    500: "#DC2626",
    600: "#B91C1C",
    700: "#991B1B",
    800: "#7F1D1D",
    900: "#450A0A",
  },
  success: {
    50: "#F0FDF4",
    100: "#E7FAF7",
    200: "#BCF5E6",
    300: "#86EFDB",
    400: "#4AE0C4",
    500: "#22D3B0",
    600: "#1FA87B",
    700: "#167A5B",
    800: "#0F5F45",
    900: "#0A4D36",
  },
  warning: {
    50: "#FFF9EC",
    100: "#FEF0C7",
    200: "#FDE68A",
    300: "#FCD34D",
    400: "#FBBF24",
    500: "#F59E0B",
    600: "#D97706",
    700: "#B45309",
    800: "#92400E",
    900: "#78350F",
  },
  info: {
    50: "#EFF6FF",
    100: "#DBEAFE",
    200: "#BFDBFE",
    300: "#93C5FD",
    400: "#60A5FA",
    500: "#2563EB",
    600: "#1D4ED8",
    700: "#1E40AF",
    800: "#1E3A8A",
    900: "#172554",
  },
  brandNavy: {
    50: "#F0F4F7",
    100: "#E1E9EF",
    200: "#C3D3DF",
    300: "#A5BDCF",
    400: "#87A7BF",
    500: "#30506E",
    600: "#284656",
    700: "#203C4E",
    800: "#183246",
    900: "#10283E",
  },
  sand: {
    50: "#FBF9F4",
    100: "#F7F3E8",
    200: "#F0E6D1",
    300: "#E8D9BA",
    400: "#E0CCA3",
    500: "#D8BF8C",
    600: "#C09970",
    700: "#A87354",
    800: "#904D38",
    900: "#78271C",
  },
} as const satisfies Record<string, Scale>;

// These bridge tokens preserve the current semantic CSS variable behavior while
// Joy becomes the source of truth for all new palette work.
export const bloomLegacyBridgeTokens = {
  "background-hsl": "46 80% 97%",
  "foreground-hsl": "225 42% 32%",
  "card-hsl": "0 0% 100%",
  "card-foreground-hsl": "225 42% 32%",
  "popover-hsl": "0 0% 100%",
  "popover-foreground-hsl": "225 42% 32%",
  "primary-hsl": "193 81% 20%",
  "primary-foreground-hsl": "0 0% 100%",
  "secondary-hsl": "184 55% 41%",
  "secondary-foreground-hsl": "0 0% 100%",
  "muted-hsl": "210 40% 96%",
  "muted-foreground-hsl": "215 16% 47%",
  "accent-hsl": "225 42% 32%",
  "accent-foreground-hsl": "0 0% 100%",
  "destructive-hsl": "0 84% 60%",
  "destructive-foreground-hsl": "0 0% 100%",
  "border-hsl": "214 32% 91%",
  "input-hsl": "214 32% 91%",
  "ring-hsl": "184 55% 41%",
  "brand-navy-hsl": "210 24% 27%",
  "brand-teal-hsl": "174 63% 57%",
  "mint-100-hsl": "142 76% 89%",
  "mint-600-hsl": "160 68% 40%",
  "sand-50-hsl": "46 80% 97%",
  "gray-50-hsl": "210 40% 98%",
  "gray-100-hsl": "210 40% 96%",
  "gray-200-hsl": "214 32% 91%",
  "gray-300-hsl": "215 20% 82%",
  "gray-400-hsl": "215 16% 65%",
  "gray-500-hsl": "215 16% 47%",
  "gray-600-hsl": "215 19% 35%",
  "gray-700-hsl": "218 11% 35%",
  "gray-800-hsl": "215 28% 17%",
  "gray-900-hsl": "221 39% 11%",
  "brand-blue-hsl": "220 70% 50%",
  "chip-draft-hsl": "220 9% 46%",
  "chip-generated-hsl": "221 83% 53%",
  "chip-approved-hsl": "174 63% 57%",
  "chip-scheduled-hsl": "221 83% 53%",
  "chip-posted-hsl": "174 63% 57%",
} as const;

const neutralPalette = {
  ...createPaletteRange("neutral", bloomPaletteScales.neutral, {
    solidColor: "var(--joy-palette-common-white)",
    solidBg: 700,
    solidHoverBg: 800,
    solidActiveBg: 900,
    plainColor: 700,
    outlinedColor: 700,
    softColor: 800,
  }),
  plainHoverColor: paletteVar("neutral", 900),
  outlinedHoverColor: paletteVar("neutral", 900),
  softHoverColor: paletteVar("neutral", 900),
};

const primaryPalette = createPaletteRange(
  "primary",
  bloomPaletteScales.primary,
  {
    solidColor: "var(--joy-palette-common-white)",
    solidBg: 700,
    solidHoverBg: 800,
    solidActiveBg: 900,
    plainColor: 700,
    outlinedColor: 700,
    softColor: "var(--joy-palette-brandNavy-900)",
  },
);

const dangerPalette = createPaletteRange("danger", bloomPaletteScales.danger, {
  solidColor: "var(--joy-palette-common-white)",
  solidBg: 600,
  solidHoverBg: 700,
  solidActiveBg: 800,
  plainColor: 700,
  outlinedColor: 700,
  softColor: 800,
});

const successPalette = createPaletteRange(
  "success",
  bloomPaletteScales.success,
  {
    solidColor: "var(--joy-palette-common-white)",
    solidBg: 700,
    solidHoverBg: 800,
    solidActiveBg: 900,
    plainColor: 700,
    outlinedColor: 700,
    softColor: 800,
  },
);

const warningPalette = createPaletteRange(
  "warning",
  bloomPaletteScales.warning,
  {
    solidColor: "var(--joy-palette-common-white)",
    solidBg: 700,
    solidHoverBg: 800,
    solidActiveBg: 900,
    plainColor: 800,
    outlinedColor: 800,
    softColor: 900,
  },
);

const infoPalette = createPaletteRange("info", bloomPaletteScales.info, {
  solidColor: "var(--joy-palette-common-white)",
  solidBg: 600,
  solidHoverBg: 700,
  solidActiveBg: 800,
  plainColor: 700,
  outlinedColor: 700,
  softColor: 800,
});

const sandPalette = createPaletteRange("sand", bloomPaletteScales.sand, {
  solidColor: "var(--joy-palette-brandNavy-900)",
  solidBg: 300,
  solidHoverBg: 400,
  solidActiveBg: 500,
  plainColor: 800,
  outlinedColor: 800,
  softColor: 900,
});

const spacingScale: Record<number, string> = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
  16: "64px",
  20: "80px",
  24: "96px",
};

const bloomSpacing = (...values: Array<number | string>) => {
  if (values.length === 0) {
    return "0px";
  }

  return values
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      const isNegative = value < 0;
      const absoluteValue = Math.abs(value);
      const resolvedValue =
        spacingScale[absoluteValue] ?? `${absoluteValue * 4}px`;

      return `${isNegative ? "-" : ""}${resolvedValue}`;
    })
    .join(" ");
};

const interactiveTransition =
  "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, color 150ms ease";

const primaryFocusRing = createFocusRing(
  "var(--joy-palette-primary-mainChannel)",
);

const defaultFieldOutline = "2px solid var(--joy-palette-primary-400)";

const focusRingStyles = {
  outline: 0,
  boxShadow: primaryFocusRing,
};

const controlSurfaceStyles = {
  borderRadius: "var(--joy-radius-lg)",
  borderColor: "var(--joy-palette-neutral-300)",
  backgroundColor: "var(--joy-palette-background-surface)",
  color: "var(--joy-palette-neutral-800)",
  boxShadow: "none",
  transition: interactiveTransition,
};

const controlFieldTextStyles = {
  fontFamily: "var(--joy-fontFamily-body)",
  fontSize: "var(--joy-fontSize-sm)",
  fontWeight: "var(--joy-fontWeight-regular)",
  lineHeight: "var(--joy-lineHeight-md)",
  color: "var(--joy-palette-neutral-800)",
};

const disabledControlStyles = {
  borderColor: "var(--joy-palette-neutral-200)",
  backgroundColor: "var(--joy-palette-neutral-50)",
  color: "var(--joy-palette-neutral-400)",
};

export const joyTheme = extendTheme({
  focus: {
    thickness: "2px",
    selector: "&.Mui-focusVisible, &:focus-visible",
    default: {
      outlineOffset: "1px",
      outline: defaultFieldOutline,
    },
  },
  fontFamily: {
    body: "'Quicksand', system-ui, sans-serif",
    display: "'Inter', system-ui, sans-serif",
    code: "ui-monospace, SFMono-Regular, SF Mono, Consolas, monospace",
    fallback: "system-ui, sans-serif",
  },
  fontSize: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    xl2: "1.5rem",
    xl3: "1.875rem",
    xl4: "2.25rem",
  },
  fontWeight: {
    xs: 300,
    sm: 400,
    md: 500,
    lg: 600,
    xl: 700,
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },
  lineHeight: {
    xs: 1.2,
    sm: 1.4,
    md: 1.5,
    lg: 1.75,
    xl: 1.75,
    prose: 1.75,
  },
  spacing: bloomSpacing,
  radius: {
    xs: "4px",
    sm: "4px",
    md: "6px",
    lg: "8px",
    xl: "12px",
    "2xl": "16px",
    cta: "20px",
  },
  shadow: {
    xs: "var(--joy-shadowRing, 0 0 #000), 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    sm: "var(--joy-shadowRing, 0 0 #000), 0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "var(--joy-shadowRing, 0 0 #000), 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "var(--joy-shadowRing, 0 0 #000), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    xl: "var(--joy-shadowRing, 0 0 #000), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    hover:
      "var(--joy-shadowRing, 0 0 #000), 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },
  zIndex: {
    badge: 1,
    table: 5,
    popup: 40,
    modal: 50,
    tooltip: 60,
    snackbar: 60,
    header: 10,
    sidebar: 20,
    overlay: 30,
    popover: 40,
    toast: 60,
  },
  typography: {
    h1: {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "1.5rem",
      fontWeight: "var(--joy-fontWeight-bold)",
      lineHeight: 1.2,
      letterSpacing: "-0.02em",
      color: "var(--joy-palette-neutral-900)",
    },
    h2: {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "1.125rem",
      fontWeight: "var(--joy-fontWeight-semibold)",
      lineHeight: 1.2,
      letterSpacing: "-0.01em",
      color: "var(--joy-palette-neutral-800)",
    },
    h3: {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "1rem",
      fontWeight: "var(--joy-fontWeight-semibold)",
      lineHeight: 1.4,
      color: "var(--joy-palette-neutral-800)",
    },
    h4: {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "var(--joy-fontSize-sm)",
      fontWeight: "var(--joy-fontWeight-semibold)",
      lineHeight: 1.4,
      color: "var(--joy-palette-neutral-800)",
    },
    "title-lg": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "1.125rem",
      fontWeight: "var(--joy-fontWeight-semibold)",
      lineHeight: 1.4,
      color: "var(--joy-palette-neutral-800)",
    },
    "title-md": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "1rem",
      fontWeight: "var(--joy-fontWeight-semibold)",
      lineHeight: 1.4,
      color: "var(--joy-palette-neutral-800)",
    },
    "title-sm": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "0.875rem",
      fontWeight: "var(--joy-fontWeight-medium)",
      lineHeight: 1.4,
      color: "var(--joy-palette-neutral-700)",
    },
    "body-lg": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "0.875rem",
      fontWeight: "var(--joy-fontWeight-regular)",
      lineHeight: 1.5,
      color: "var(--joy-palette-neutral-700)",
    },
    "body-md": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "0.875rem",
      fontWeight: "var(--joy-fontWeight-regular)",
      lineHeight: 1.5,
      color: "var(--joy-palette-neutral-700)",
    },
    "body-sm": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "0.875rem",
      fontWeight: "var(--joy-fontWeight-regular)",
      lineHeight: 1.5,
      color: "var(--joy-palette-neutral-700)",
    },
    "body-xs": {
      fontFamily: "var(--joy-fontFamily-body)",
      fontSize: "var(--joy-fontSize-xs)",
      fontWeight: "var(--joy-fontWeight-medium)",
      lineHeight: 1.5,
      color: "var(--joy-palette-neutral-500)",
    },
  },
  components: {
    JoyButton: {
      defaultProps: {
        color: "primary",
        size: "sm",
        variant: "solid",
      },
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-lg)",
          fontWeight: "var(--joy-fontWeight-medium)",
          textTransform: "none",
          transition: `${interactiveTransition}, transform 100ms ease`,
          "&:active": {
            transform: "scale(0.98)",
          },
          "&.Mui-focusVisible, &:focus-visible": focusRingStyles,
        },
      },
    },
    JoyChip: {
      defaultProps: {
        color: "neutral",
        size: "sm",
        variant: "soft",
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: "var(--joy-fontWeight-medium)",
          textTransform: "none",
          transition:
            "background-color 100ms ease, color 100ms ease, box-shadow 150ms ease",
        },
      },
    },
    JoyIconButton: {
      defaultProps: {
        size: "sm",
      },
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-lg)",
          transition: `${interactiveTransition}, transform 100ms ease`,
          "&:active": {
            transform: "scale(0.98)",
          },
          "&.Mui-focusVisible, &:focus-visible": focusRingStyles,
        },
      },
    },
    JoyInput: {
      defaultProps: {
        color: "neutral",
        size: "sm",
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          ...controlSurfaceStyles,
          minHeight: 36,
          "--Input-gap": "0.625rem",
          "--Input-paddingInline": "0.75rem",
          "--Input-focusedThickness": "0px",
          "--Input-placeholderColor": "var(--joy-palette-neutral-400)",
          "--Input-placeholderOpacity": "1",
          "--Input-decoratorColor": "var(--joy-palette-neutral-400)",
          "&:hover:not([data-disabled='true'])": {
            backgroundColor: "var(--joy-palette-background-surface)",
            borderColor: "var(--joy-palette-neutral-400)",
          },
          "&:focus-within": {
            borderColor: "var(--joy-palette-primary-400)",
          },
          "&.Mui-focusVisible, &:focus-visible": {
            borderColor: "transparent",
          },
          "&[data-disabled='true'], &[aria-disabled='true']": {
            ...disabledControlStyles,
          },
        },
        input: {
          ...controlFieldTextStyles,
          "&::placeholder": {
            color: "var(--joy-palette-neutral-400)",
            opacity: 1,
          },
        },
      },
    },
    JoyFormLabel: {
      styleOverrides: {
        root: {
          color: "var(--joy-palette-neutral-600)",
          fontSize: "0.8125rem",
          fontWeight: "var(--joy-fontWeight-medium)",
          lineHeight: 1.4,
          marginBottom: "4px",
        },
      },
    },
    JoyFormHelperText: {
      styleOverrides: {
        root: {
          marginTop: 0,
          minHeight: 18,
          color: "var(--joy-palette-neutral-500)",
          fontSize: "var(--joy-fontSize-xs)",
          fontWeight: "var(--joy-fontWeight-regular)",
          lineHeight: 1.4,
        },
      },
    },
    JoyListItemButton: {
      styleOverrides: {
        root: {
          "&.Mui-focusVisible, &:focus-visible": focusRingStyles,
        },
      },
    },
    JoyMenu: {
      defaultProps: {
        size: "sm",
        variant: "plain",
      },
      styleOverrides: {
        root: {
          borderRadius: "var(--joy-radius-xl)",
          borderColor: "var(--joy-palette-neutral-200)",
          backgroundColor: "var(--joy-palette-background-popup)",
          boxShadow: "var(--joy-shadow-lg)",
          padding: "0.5rem",
          "--List-padding": "0px",
        },
      },
    },
    JoyMenuButton: {
      styleOverrides: {
        root: {
          "&.Mui-focusVisible, &:focus-visible": focusRingStyles,
        },
      },
    },
    JoyMenuItem: {
      styleOverrides: {
        root: {
          minHeight: 36,
          borderRadius: "var(--joy-radius-lg)",
          fontSize: "13px",
          fontWeight: "var(--joy-fontWeight-medium)",
          transition:
            "background-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
          "&.Mui-focusVisible, &:focus-visible": focusRingStyles,
        },
      },
    },
    JoySelect: {
      defaultProps: {
        color: "neutral",
        size: "sm",
        variant: "outlined",
      },
      styleOverrides: {
        button: {
          ...controlSurfaceStyles,
          minHeight: 36,
          "--Select-focusedThickness": "0px",
          "--Select-placeholderOpacity": "1",
          "--Select-indicatorColor": "var(--joy-palette-neutral-400)",
          paddingInline: "0.75rem",
          fontSize: "var(--joy-fontSize-sm)",
          fontWeight: "var(--joy-fontWeight-regular)",
          lineHeight: "var(--joy-lineHeight-md)",
          color: "var(--joy-palette-neutral-800)",
          "--Select-decoratorColor": "var(--joy-palette-neutral-400)",
          "&:hover:not([aria-disabled='true'])": {
            backgroundColor: "var(--joy-palette-background-surface)",
            borderColor: "var(--joy-palette-neutral-400)",
          },
          "&:focus-within": {
            borderColor: "var(--joy-palette-primary-400)",
          },
          "&.Mui-focusVisible, &:focus-visible": {
            borderColor: "transparent",
          },
          "&[aria-disabled='true']": {
            ...disabledControlStyles,
          },
        },
        listbox: {
          padding: "0.5rem",
          borderRadius: "var(--joy-radius-lg)",
          borderColor: "var(--joy-palette-neutral-200)",
          backgroundColor: "#FFFFFF",
          boxShadow: "var(--joy-shadow-lg)",
          zIndex: "var(--joy-zIndex-popup)",
          "--List-padding": "0px",
        },
      },
    },
    JoyTextarea: {
      defaultProps: {
        color: "neutral",
        size: "sm",
        variant: "outlined",
      },
      styleOverrides: {
        root: {
          ...controlSurfaceStyles,
          minHeight: 80,
          "--Textarea-paddingBlock": "0.625rem",
          "--Textarea-paddingInline": "0.75rem",
          "--Textarea-focusedThickness": "0px",
          "--Textarea-placeholderColor": "var(--joy-palette-neutral-400)",
          "--Textarea-placeholderOpacity": "1",
          "--Textarea-decoratorColor": "var(--joy-palette-neutral-400)",
          "&:hover:not([data-disabled='true'])": {
            backgroundColor: "var(--joy-palette-background-surface)",
            borderColor: "var(--joy-palette-neutral-400)",
          },
          "&:focus-within": {
            borderColor: "var(--joy-palette-primary-400)",
          },
          "&.Mui-focusVisible, &:focus-visible": {
            borderColor: "transparent",
          },
          "&[data-disabled='true'], &[aria-disabled='true']": {
            ...disabledControlStyles,
          },
        },
        textarea: {
          ...controlFieldTextStyles,
          minHeight: 80,
          resize: "vertical",
          "&::placeholder": {
            color: "var(--joy-palette-neutral-400)",
            opacity: 1,
          },
        },
      },
    },
  },
  colorSchemes: {
    light: {
      shadowRing: "0 0 #000",
      shadowChannel: "15 23 42",
      shadowOpacity: "0.08",
      palette: {
        common: {
          white: "#FFFFFF",
          black: "#000000",
        },
        primary: primaryPalette,
        neutral: neutralPalette,
        danger: dangerPalette,
        success: successPalette,
        warning: warningPalette,
        info: infoPalette,
        brandNavy: createPaletteRange(
          "brandNavy",
          bloomPaletteScales.brandNavy,
        ),
        sand: sandPalette,
        bridge: bloomLegacyBridgeTokens,
        text: {
          primary: bloomPaletteScales.brandNavy[800],
          secondary: bloomPaletteScales.neutral[700],
          tertiary: bloomPaletteScales.neutral[600],
          icon: bloomPaletteScales.brandNavy[700],
        },
        background: {
          body: bloomPaletteScales.sand[50],
          surface: "var(--joy-palette-common-white)",
          popup: "var(--joy-palette-common-white)",
          level1: "var(--joy-palette-common-white)",
          level2: bloomPaletteScales.sand[50],
          level3: bloomPaletteScales.neutral[100],
          tooltip: bloomPaletteScales.neutral[800],
          backdrop: `rgba(${hexToRgbChannel(bloomPaletteScales.brandNavy[900])} / 0.24)`,
        },
        divider: bloomPaletteScales.neutral[200],
        focusVisible: `rgba(var(--joy-palette-primary-mainChannel) / 0.18)`,
      },
    },
  },
} as const);

export type JoyTheme = typeof joyTheme;
