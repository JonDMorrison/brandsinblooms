import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ChevronRight } from "lucide-react";
import type { IntegrationDefinition } from "@/components/integrations/integrationsHubConfig";
import {
  providerLogoAssets,
  providerMarkAssets,
} from "@/components/integrations/providerLogoAssets";

type ChipColor = "success" | "neutral" | "warning" | "danger";
type ChipVariant = "soft" | "outlined";
const LOGO_TILE_SIZE = 40;

type HubStatusTone = "connected" | "not-connected" | "attention" | "error";

export interface HubIntegrationCardProps {
  item: IntegrationDefinition;
  featured?: boolean;
  onActivate?: (item: IntegrationDefinition) => void;
  activityLabel?: string | null;
  statusTone?: HubStatusTone;
  statusLabel?: string;
}

export interface LegacyIntegrationCardProps {
  title: string;
  description: string;
  icon?: ReactNode;
  isConnected?: boolean;
  badge?: ReactNode;
  children?: ReactNode;
  featured?: boolean;
  onClick?: () => void;
}

export type IntegrationCardProps =
  | HubIntegrationCardProps
  | LegacyIntegrationCardProps;

type StatusPresentation = {
  label: string;
  color: ChipColor;
  variant: ChipVariant;
};

const CATEGORY_SHORT_LABELS: Partial<
  Record<IntegrationDefinition["category"], string>
> = {
  "marketing-import": "Marketing",
  "pos-systems": "POS",
};

function isHubProps(
  props: IntegrationCardProps,
): props is HubIntegrationCardProps {
  return "item" in props;
}

function getInitials(value: string) {
  return value
    .split(" ")
    .map((segment) => segment[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const deltaMs = parsed.getTime() - Date.now();
  const absDeltaMs = Math.abs(deltaMs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (absDeltaMs < 60_000) {
    return rtf.format(Math.round(deltaMs / 1_000), "second");
  }

  if (absDeltaMs < 3_600_000) {
    return rtf.format(Math.round(deltaMs / 60_000), "minute");
  }

  if (absDeltaMs < 86_400_000) {
    return rtf.format(Math.round(deltaMs / 3_600_000), "hour");
  }

  if (absDeltaMs < 2_592_000_000) {
    return rtf.format(Math.round(deltaMs / 86_400_000), "day");
  }

  return rtf.format(Math.round(deltaMs / 2_592_000_000), "month");
}

function getHubStatusPresentation(
  item: IntegrationDefinition,
  statusTone?: HubStatusTone,
  statusLabel?: string,
): StatusPresentation {
  if (statusTone === "attention") {
    return {
      label: statusLabel ?? "Needs attention",
      color: "warning",
      variant: "soft",
    };
  }

  if (statusTone === "error") {
    return {
      label: statusLabel ?? "Error",
      color: "danger",
      variant: "soft",
    };
  }

  if (item.status === "connected") {
    return {
      label: statusLabel ?? "Connected",
      color: "success",
      variant: "soft",
    };
  }

  if (item.status === "coming-soon") {
    return {
      label: statusLabel ?? "Coming soon",
      color: "neutral",
      variant: "outlined",
    };
  }

  return {
    label: statusLabel ?? "Not connected",
    color: "neutral",
    variant: "outlined",
  };
}

export function IntegrationCard(props: IntegrationCardProps) {
  const featured = props.featured ?? false;
  const clickable = isHubProps(props)
    ? typeof props.onActivate === "function"
    : typeof props.onClick === "function";

  const title = isHubProps(props) ? props.item.name : props.title;
  const description = isHubProps(props)
    ? props.item.description
    : props.description;
  const categoryLabel = isHubProps(props)
    ? (CATEGORY_SHORT_LABELS[props.item.category] ?? props.item.categoryLabel)
    : null;
  const statusPresentation: StatusPresentation = isHubProps(props)
    ? getHubStatusPresentation(props.item, props.statusTone, props.statusLabel)
    : {
        label: props.isConnected ? "Connected" : "Not connected",
        color: props.isConnected ? "success" : "neutral",
        variant: props.isConnected ? "soft" : "outlined",
      };
  const activityLabel = isHubProps(props)
    ? (props.activityLabel ??
      (props.item.status === "connected"
        ? formatRelativeTime(props.item.connectedSince)
        : null))
    : null;
  const logoSrc = isHubProps(props)
    ? (providerMarkAssets[props.item.slug] ?? providerLogoAssets[props.item.slug])
    : null;
  const legacyIcon = !isHubProps(props) ? props.icon : null;

  const handleActivate = () => {
    if (!clickable) {
      return;
    }

    if (isHubProps(props)) {
      props.onActivate?.(props.item);
      return;
    }

    props.onClick?.();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!clickable) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (!clickable) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("a, button")) {
      return;
    }

    handleActivate();
  };

  return (
    <Sheet
      component="article"
      color="neutral"
      variant="outlined"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? `${title}: ${statusPresentation.label}. Open details` : undefined}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        // Grid parents use bare `1fr` tracks; without this the no-wrap title
        // sets the track's minimum width and overflows narrow viewports.
        minWidth: 0,
        gap: 3,
        p: 4,
        borderRadius: "xl",
        borderColor: "neutral.outlinedBorder",
        bgcolor: "background.surface",
        boxShadow: "xs",
        cursor: clickable ? "pointer" : "default",
        transition:
          "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": clickable
          ? {
              transform: "translateY(-2px)",
              boxShadow: "md",
              borderColor: "neutral.outlinedHoverBorder",
            }
          : undefined,
        "&:hover .integration-card-chevron": clickable
          ? { color: "text.primary", transform: "translateX(2px)" }
          : undefined,
        "&:focus-visible": clickable
          ? {
              outline: "2px solid",
              outlineColor: "primary.500",
              outlineOffset: 2,
            }
          : undefined,
      }}
    >
      <Stack direction="row" spacing={3} alignItems="center" sx={{ minWidth: 0 }}>
        <Box
          sx={{
            width: LOGO_TILE_SIZE,
            height: LOGO_TILE_SIZE,
            flexShrink: 0,
            display: "grid",
            placeItems: "center",
            overflow: "hidden",
            borderRadius: "10px",
            border: "1px solid",
            borderColor: "neutral.outlinedBorder",
            // Partner marks are drawn for light backgrounds, so the tile stays
            // white in every colour scheme; icon and initials fallbacks follow the theme.
            bgcolor: logoSrc ? "common.white" : "neutral.softBg",
            color: "text.secondary",
            fontWeight: "lg",
            fontSize: "sm",
          }}
        >
          {logoSrc ? (
            <Box
              component="img"
              src={logoSrc}
              alt=""
              loading="lazy"
              sx={{
                width: "72%",
                height: "72%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : legacyIcon ? (
            legacyIcon
          ) : (
            getInitials(title)
          )}
        </Box>

        <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
            sx={{ minWidth: 0 }}
          >
            <Typography
              component="h3"
              level="title-md"
              sx={{ fontWeight: 700, lineHeight: 1.25, overflowWrap: "anywhere" }}
            >
              {title}
            </Typography>
            {featured ? (
              <Chip color="primary" size="sm" variant="soft" sx={{ flexShrink: 0 }}>
                Featured
              </Chip>
            ) : null}
          </Stack>
          {categoryLabel ? (
            <Typography level="body-xs" sx={{ color: "text.tertiary" }} noWrap>
              {categoryLabel}
            </Typography>
          ) : null}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
          <Chip
            color={statusPresentation.color}
            size="sm"
            variant={statusPresentation.variant}
          >
            {statusPresentation.label}
          </Chip>
          {clickable ? (
            <Box
              aria-hidden
              className="integration-card-chevron"
              sx={{
                display: "flex",
                color: "text.tertiary",
                transition: "color 180ms ease, transform 180ms ease",
              }}
            >
              <ChevronRight size={18} />
            </Box>
          ) : null}
        </Stack>
      </Stack>

      {!isHubProps(props) && props.badge ? props.badge : null}

      <Stack spacing={1}>
        <Typography
          level="body-sm"
          sx={{ color: "text.secondary", lineHeight: 1.55 }}
        >
          {description}
        </Typography>
        {isHubProps(props) && props.item.metaLabel ? (
          <Typography level="body-xs" sx={{ color: "neutral.600", fontWeight: 600 }}>
            {props.item.metaLabel}
          </Typography>
        ) : null}
      </Stack>

      {isHubProps(props) && props.item.children?.length ? (
        <Stack direction="row" flexWrap="wrap" gap={0.75} useFlexGap>
          {props.item.children.map((child) => (
            <Chip
              key={child.name}
              color={child.status === "connected" ? "success" : "neutral"}
              size="sm"
              variant={child.status === "connected" ? "soft" : "outlined"}
            >
              {child.name}
            </Chip>
          ))}
        </Stack>
      ) : null}

      {!isHubProps(props) && props.children ? (
        <Box sx={{ mt: "auto" }}>{props.children}</Box>
      ) : null}

      {activityLabel ? (
        <Typography level="body-xs" sx={{ color: "text.tertiary", mt: "auto" }}>
          Last sync {activityLabel}
        </Typography>
      ) : null}
    </Sheet>
  );
}
