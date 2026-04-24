import type { KeyboardEvent } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  MailCheck,
  MousePointerClick,
} from "lucide-react";

export type NewsletterCampaignDisplayStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "archived";

export interface NewsletterCampaignCardData {
  id: string;
  title: string;
  audienceSummary: string | null;
  dateLabel: string;
  deliveredCount: number | null;
  openRate: number | null;
  clickRate: number | null;
  scheduledDetail: string | null;
  status: NewsletterCampaignDisplayStatus;
  statusLabel: string;
}

interface NewsletterCampaignCardProps {
  campaign: NewsletterCampaignCardData;
  onClick: () => void;
}

const cardTransition =
  "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background-color 0.2s ease";

function formatCompactNumber(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "-";
  }

  return `${new Intl.NumberFormat("en", {
    maximumFractionDigits: value >= 10 ? 0 : 1,
  }).format(value)}%`;
}

function getStatusTone(status: NewsletterCampaignDisplayStatus) {
  switch (status) {
    case "scheduled":
      return { color: "warning" as const, variant: "soft" as const };
    case "sending":
      return { color: "primary" as const, variant: "soft" as const };
    case "sent":
      return { color: "success" as const, variant: "soft" as const };
    case "failed":
      return { color: "danger" as const, variant: "soft" as const };
    case "archived":
      return { color: "neutral" as const, variant: "outlined" as const };
    default:
      return { color: "neutral" as const, variant: "soft" as const };
  }
}

function MetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MailCheck;
  label: string;
  value: string;
}) {
  return (
    <Stack
      spacing={0.4}
      sx={{
        minWidth: 0,
        flex: 1,
        px: 1.5,
        py: 1.25,
        borderRadius: "lg",
        backgroundColor: "rgba(15, 23, 42, 0.035)",
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Icon size={14} />
        <Typography level="body-xs" sx={{ color: "text.tertiary" }}>
          {label}
        </Typography>
      </Stack>
      <Typography level="body-sm" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export function NewsletterCampaignCard({
  campaign,
  onClick,
}: NewsletterCampaignCardProps) {
  const statusTone = getStatusTone(campaign.status);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const renderFooter = () => {
    if (campaign.status === "sent") {
      const hasMetrics =
        campaign.openRate !== null ||
        campaign.clickRate !== null ||
        campaign.deliveredCount !== null;

      if (!hasMetrics) {
        return (
          <Button
            size="sm"
            variant="plain"
            color="primary"
            endDecorator={<ArrowRight size={14} />}
            onClick={(event) => {
              event.stopPropagation();
              onClick();
            }}
            sx={{ px: 0, alignSelf: "flex-start" }}
          >
            View report for detailed metrics
          </Button>
        );
      }

      return (
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
          <MetricCell
            icon={MailCheck}
            label="Open Rate"
            value={formatPercent(campaign.openRate)}
          />
          <MetricCell
            icon={MousePointerClick}
            label="Click Rate"
            value={formatPercent(campaign.clickRate)}
          />
          <MetricCell
            icon={BarChart3}
            label="Delivered"
            value={formatCompactNumber(campaign.deliveredCount)}
          />
        </Stack>
      );
    }

    if (campaign.status === "scheduled" || campaign.status === "sending") {
      return (
        <Typography level="body-xs" sx={{ color: "text.secondary" }}>
          {campaign.scheduledDetail ??
            "Scheduled delivery window is set in the editor."}
        </Typography>
      );
    }

    if (campaign.status === "draft") {
      return (
        <Button
          size="sm"
          variant="plain"
          color="primary"
          endDecorator={<ArrowRight size={14} />}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
          sx={{ px: 2, alignSelf: "flex-start" }}
        >
          Continue editing
        </Button>
      );
    }

    return (
      <Button
        size="sm"
        variant="plain"
        color={campaign.status === "failed" ? "danger" : "neutral"}
        endDecorator={<ArrowRight size={14} />}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        sx={{ px: 0, alignSelf: "flex-start" }}
      >
        Open campaign
      </Button>
    );
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      variant="outlined"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      sx={{
        height: "100%",
        p: 2.5,
        borderRadius: "xl",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        boxShadow: "sm",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        textAlign: "left",
        transition: cardTransition,
        outline: 0,
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "md",
          borderColor: "rgba(37, 99, 235, 0.24)",
        },
        "&:focus-visible": {
          boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.16)",
          borderColor: "primary.400",
        },
        "@keyframes newsletter-card-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(37, 99, 235, 0.18)" },
          "70%": { boxShadow: "0 0 0 8px rgba(37, 99, 235, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(37, 99, 235, 0)" },
        },
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        justifyContent="space-between"
        alignItems="center"
      >
        <Chip
          size="sm"
          color={statusTone.color}
          variant={statusTone.variant}
          sx={
            campaign.status === "sending"
              ? {
                  animation: "newsletter-card-pulse 1.8s ease-in-out infinite",
                }
              : undefined
          }
        >
          {campaign.statusLabel}
        </Chip>
        <Typography
          level="body-xs"
          sx={{ color: "text.tertiary", textAlign: "right" }}
        >
          {campaign.dateLabel}
        </Typography>
      </Stack>

      <Stack spacing={0.85} sx={{ minWidth: 0 }}>
        <Typography
          level="title-md"
          sx={{
            fontWeight: 600,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {campaign.title}
        </Typography>
        {campaign.audienceSummary ? (
          <Typography
            level="body-xs"
            sx={{
              color: "text.secondary",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {campaign.audienceSummary}
          </Typography>
        ) : null}
      </Stack>

      <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.14)" }} />

      <Box sx={{ mt: "auto" }}>{renderFooter()}</Box>
    </Card>
  );
}

export function NewsletterCampaignCardSkeleton() {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        p: 2.5,
        borderRadius: "xl",
        borderColor: "neutral.200",
        boxShadow: "sm",
        gap: 2,
      }}
    >
      <Stack
        direction="row"
        spacing={1.5}
        justifyContent="space-between"
        alignItems="center"
      >
        <Skeleton
          variant="rectangular"
          width={78}
          height={26}
          animation="wave"
          sx={{ borderRadius: "999px" }}
        />
        <Skeleton variant="text" width={88} height={14} animation="wave" />
      </Stack>

      <Stack spacing={0.9}>
        <Skeleton variant="text" width="74%" height={24} animation="wave" />
        <Skeleton variant="text" width="56%" height={16} animation="wave" />
      </Stack>

      <Divider sx={{ borderColor: "rgba(148, 163, 184, 0.14)" }} />

      <Stack direction="row" spacing={1}>
        {Array.from({ length: 3 }).map((_, index) => (
          <Stack
            key={index}
            spacing={0.5}
            sx={{
              flex: 1,
              px: 1.5,
              py: 1.25,
              borderRadius: "lg",
              backgroundColor: "rgba(15, 23, 42, 0.035)",
            }}
          >
            <Skeleton variant="text" width="70%" height={12} animation="wave" />
            <Skeleton variant="text" width="52%" height={18} animation="wave" />
          </Stack>
        ))}
      </Stack>
    </Card>
  );
}
