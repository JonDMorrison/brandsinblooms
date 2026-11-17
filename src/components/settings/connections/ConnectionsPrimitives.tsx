import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Typography, { type TypographyProps } from "@mui/joy/Typography";
import { Plug } from "lucide-react";
import mailchimpLogo from "@/assets/logos/mailchimp-new.png";
import cloverLogo from "@/assets/logos/clover.svg";
import lightspeedLogo from "@/assets/logos/lightspeed-x-series.svg";
import shopifyLogo from "@/assets/logos/shopify.svg";
import squareMark from "@/assets/logos/square-mark.svg";
import vmxMark from "@/assets/logos/vmx-mark.png";
import zapierLogo from "@/assets/logos/zapier.jpeg";
import { JoyTooltip } from "@/components/joy/JoyTooltip";
import { mergeSx } from "@/components/joy/mergeSx";
import { formatDateTimeValue, formatRelativeTimestamp } from "@/components/integrations/shared/dataTabPrimitives";
import { type ConnectionHealth, HEALTH_PRESENTATION, type IntegrationLogoKey } from "./connectionsModel";

type LogoSource = { kind: "image"; src: string; fill: boolean } | { kind: "icon"; icon: typeof Plug };

const LOGO_SOURCES: Record<IntegrationLogoKey, LogoSource> = {
  square: { kind: "image", src: squareMark, fill: false },
  shopify: { kind: "image", src: shopifyLogo, fill: false },
  lightspeed: { kind: "image", src: lightspeedLogo, fill: false },
  clover: { kind: "image", src: cloverLogo, fill: false },
  // Official app-icon tiles: render edge to edge.
  zapier: { kind: "image", src: zapierLogo, fill: true },
  mailchimp: { kind: "image", src: mailchimpLogo, fill: true },
  vmx: { kind: "image", src: vmxMark, fill: true },
  generic: { kind: "icon", icon: Plug },
};

interface IntegrationLogoProps {
  logo: IntegrationLogoKey;
  name: string;
  size?: number;
  muted?: boolean;
}

export const IntegrationLogo = ({ logo, name, size = 40, muted = false }: IntegrationLogoProps) => {
  const source = LOGO_SOURCES[logo];
  const isImage = source.kind === "image";

  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: `${Math.round(size * 0.3)}px`,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "neutral.outlinedBorder",
        // Brand marks are drawn for light backgrounds; keep the tile light in both themes.
        bgcolor: isImage ? "common.white" : "background.level1",
        color: "text.secondary",
        filter: muted ? "grayscale(0.35)" : undefined,
        opacity: muted ? 0.85 : 1,
      }}
    >
      {source.kind === "image" ? (
        <Box
          alt={`${name} logo`}
          component="img"
          src={source.src}
          sx={{
            width: source.fill ? "100%" : "58%",
            height: source.fill ? "100%" : "58%",
            objectFit: source.fill ? "cover" : "contain",
            display: "block",
          }}
        />
      ) : (
        <source.icon aria-label={`${name} logo`} role="img" size={Math.round(size * 0.5)} strokeWidth={1.75} />
      )}
    </Box>
  );
};

const StatusDot = () => (
  <Box
    aria-hidden
    sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "currentColor", flexShrink: 0 }}
  />
);

export const HealthChip = ({ health }: { health: ConnectionHealth }) => {
  const presentation = HEALTH_PRESENTATION[health];

  return (
    <Chip
      color={presentation.color}
      size="sm"
      startDecorator={
        health === "syncing" ? (
          <CircularProgress
            color="primary"
            size="sm"
            sx={{ "--CircularProgress-size": "12px", "--CircularProgress-trackThickness": "2px", "--CircularProgress-progressThickness": "2px" }}
          />
        ) : (
          <StatusDot />
        )
      }
      sx={{ fontWeight: "md" }}
      variant="soft"
    >
      {presentation.label}
    </Chip>
  );
};

interface RelativeTimeProps extends Omit<TypographyProps, "children"> {
  value: string | null;
  prefix?: string;
  fallback?: string;
}

/** "Last synced 12 minutes ago" with the exact timestamp on hover/focus. */
export const RelativeTime = ({ value, prefix, fallback = "Never", sx, ...typographyProps }: RelativeTimeProps) => {
  if (!value) {
    return (
      <Typography {...typographyProps} sx={sx}>
        {fallback}
      </Typography>
    );
  }

  return (
    <JoyTooltip size="sm" title={formatDateTimeValue(value)}>
      <Typography
        {...typographyProps}
        component="span"
        tabIndex={0}
        sx={mergeSx(
          {
            cursor: "default",
            borderRadius: "4px",
            "&:focus-visible": { outline: "2px solid", outlineColor: "focusVisible", outlineOffset: 2 },
          },
          sx,
        )}
      >
        <Box component="time" dateTime={value} sx={{ font: "inherit", color: "inherit" }}>
          {prefix ? `${prefix} ` : ""}
          {formatRelativeTimestamp(value)}
        </Box>
      </Typography>
    </JoyTooltip>
  );
};

export const DataScopeTags = ({ scopes }: { scopes: string[] }) => {
  if (scopes.length === 0) return null;

  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {scopes.map((scope) => (
        <Chip
          key={scope}
          color="neutral"
          size="sm"
          sx={{ "--Chip-minHeight": "20px", fontSize: "11px", fontWeight: "md", borderRadius: "6px" }}
          variant="outlined"
        >
          {scope}
        </Chip>
      ))}
    </Box>
  );
};
