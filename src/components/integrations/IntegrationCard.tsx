import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import type { IntegrationDefinition } from "@/components/integrations/integrationsHubConfig";
import { providerLogoAssets } from "@/components/integrations/providerLogoAssets";

type ChipColor = "success" | "neutral" | "warning" | "danger";
type ChipVariant = "soft" | "outlined";
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
  const statusPresentation = isHubProps(props)
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
    ? providerLogoAssets[props.item.slug]
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
      variant={featured ? "soft" : "outlined"}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      sx={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 1.75,
        minHeight: 248,
        p: 2.5,
        borderRadius: "xl",
        borderColor: featured ? "neutral.outlinedBorder" : "neutral.200",
        bgcolor: featured ? "neutral.softBg" : "background.surface",
        boxShadow: "sm",
        cursor: clickable ? "pointer" : "default",
        transition:
          "transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease",
        "&:hover": clickable
          ? {
              transform: "translateY(-2px)",
              boxShadow: "md",
              borderColor: "neutral.300",
            }
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
      <Stack direction="row" justifyContent="space-between" spacing={1.5}>
        <Avatar
          color="neutral"
          size="lg"
          variant={logoSrc ? "soft" : "outlined"}
          sx={{
            bgcolor: logoSrc ? "background.surface" : "neutral.softBg",
            color: "text.primary",
          }}
        >
          {logoSrc ? (
            <Box
              component="img"
              src={logoSrc}
              alt={`${title} logo`}
              sx={{
                width: "70%",
                height: "70%",
                objectFit: "contain",
              }}
            />
          ) : legacyIcon ? (
            legacyIcon
          ) : (
            getInitials(title)
          )}
        </Avatar>

        {featured ? (
          <Chip color="neutral" size="sm" variant="soft">
            Featured
          </Chip>
        ) : null}
      </Stack>

      <Stack spacing={1.1}>
        <Typography component="h3" level="title-md" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>

        {categoryLabel ? (
          <Chip
            color="neutral"
            size="sm"
            variant="soft"
            sx={{ alignSelf: "flex-start", fontWeight: 600 }}
          >
            {categoryLabel}
          </Chip>
        ) : null}

        {!isHubProps(props) && props.badge ? props.badge : null}

        <Typography
          level="body-sm"
          sx={{ color: "text.secondary", lineHeight: 1.55 }}
        >
          {description}
        </Typography>
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

      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1.5}
        sx={{ mt: "auto", pt: 0.5 }}
      >
        <Chip
          color={statusPresentation.color}
          size="sm"
          variant={statusPresentation.variant}
        >
          {statusPresentation.label}
        </Chip>

        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {activityLabel ? `Last sync ${activityLabel}` : "Open details"}
        </Typography>
      </Stack>
    </Sheet>
  );
}
