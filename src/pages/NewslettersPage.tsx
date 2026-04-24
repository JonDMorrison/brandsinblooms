import React, { useMemo, useState } from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import MenuButton from "@mui/joy/MenuButton";
import Skeleton from "@mui/joy/Skeleton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  ChevronDown,
  FileText,
  LayoutTemplate,
  Inbox,
  Mail,
  Plus,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { NewsletterPicker } from "@/components/newsletter/NewsletterPicker";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuLabel,
  JoyDropdownMenuSeparator,
} from "@/components/joy/JoyDropdownMenu";
import {
  NewsletterCampaignCard,
  NewsletterCampaignCardSkeleton,
  type NewsletterCampaignCardData,
  type NewsletterCampaignDisplayStatus,
} from "@/components/newsletter/NewsletterCampaignCard";
import { NewsletterStatsStrip } from "@/components/newsletter/NewsletterStatsStrip";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useTenant } from "@/hooks/useTenant";

const surfaceTransition =
  "transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out, background-color 0.2s ease-in-out";

const buttonTransitionSx = {
  transition: "all 0.15s ease",
};

type FilterKey = "all" | "draft" | "scheduled" | "sent" | "archived";

type CampaignMetrics = {
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  unsubscribed?: number;
};

type RecentNewsletterRow = {
  id: string;
  name: string;
  subject_line: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  synced_from: string | null;
  metadata: Json | null;
  metrics: Json | null;
  open_rate: number | null;
  click_rate: number | null;
  total_sent: number | null;
  total_opens: number | null;
  total_clicks: number | null;
  crm_segments:
    | {
        name: string;
        customer_count: number | null;
      }
    | Array<{
        name: string;
        customer_count: number | null;
      }>
    | null;
};

const compactNumberFormatter = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function toMetrics(value: Json | null): CampaignMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as CampaignMetrics;
}

function toRecord(value: Json | null): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function normalizeSegment(
  value: RecentNewsletterRow["crm_segments"],
): { name: string; customer_count: number | null } | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function isNewsletterSurfaceCampaign(
  row: Pick<RecentNewsletterRow, "metadata" | "synced_from">,
) {
  const metadata = toRecord(row.metadata);
  const metadataType = String(metadata.campaignType ?? "").toLowerCase();

  if (metadataType === "sms") {
    return false;
  }

  return true;
}

function deriveRate(
  value: number | null,
  numerator: number | null,
  denominator: number | null,
) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (numerator && denominator && denominator > 0) {
    return (numerator / denominator) * 100;
  }

  return null;
}

function deriveDeliveredCount(row: RecentNewsletterRow) {
  const metrics = toMetrics(row.metrics);
  const metricSent = metrics.delivered ?? metrics.sent;

  if (typeof row.total_sent === "number" && Number.isFinite(row.total_sent)) {
    return row.total_sent;
  }

  return typeof metricSent === "number" && Number.isFinite(metricSent)
    ? metricSent
    : null;
}

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value);
}

function formatDateLabel(
  row: RecentNewsletterRow,
  displayStatus: NewsletterCampaignDisplayStatus,
) {
  const targetDate =
    displayStatus === "sent"
      ? row.sent_at
      : displayStatus === "scheduled" || displayStatus === "sending"
        ? (row.scheduled_at ?? row.updated_at)
        : (row.updated_at ?? row.created_at);

  if (!targetDate) {
    return "No recent activity";
  }

  return formatDistanceToNow(new Date(targetDate), { addSuffix: true });
}

function formatScheduledDetail(row: RecentNewsletterRow) {
  if (!row.scheduled_at) {
    return null;
  }

  return `Scheduled for ${format(new Date(row.scheduled_at), "MMM d, h:mm a")}`;
}

function toDisplayStatus(
  rawStatus: string | null,
): NewsletterCampaignDisplayStatus {
  switch (rawStatus) {
    case "scheduled":
    case "queued":
    case "partially_queued":
      return "scheduled";
    case "sending":
      return "sending";
    case "sent":
    case "sent_with_errors":
      return "sent";
    case "failed":
      return "failed";
    case "paused":
    case "archived":
      return "archived";
    default:
      return "draft";
  }
}

function toFilterKey(
  displayStatus: NewsletterCampaignDisplayStatus,
): FilterKey {
  switch (displayStatus) {
    case "scheduled":
    case "sending":
      return "scheduled";
    case "sent":
      return "sent";
    case "failed":
    case "archived":
      return "archived";
    default:
      return "draft";
  }
}

function toStatusLabel(
  rawStatus: string | null,
  displayStatus: NewsletterCampaignDisplayStatus,
) {
  if (rawStatus === "sent_with_errors") {
    return "Sent";
  }

  switch (displayStatus) {
    case "scheduled":
      return "Scheduled";
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "failed":
      return "Failed";
    case "archived":
      return "Archived";
    default:
      return "Draft";
  }
}

function buildAudienceSummary(
  row: RecentNewsletterRow,
  displayStatus: NewsletterCampaignDisplayStatus,
) {
  const segment = normalizeSegment(row.crm_segments);
  const deliveredCount = deriveDeliveredCount(row);

  if (displayStatus === "sent" && deliveredCount) {
    if (segment?.name) {
      return `${segment.name} • ${formatCompactNumber(deliveredCount)} recipients`;
    }

    return `Sent to ${formatCompactNumber(deliveredCount)} recipients`;
  }

  if (segment?.name) {
    const segmentCount =
      typeof segment.customer_count === "number" && segment.customer_count > 0
        ? ` • ${formatCompactNumber(segment.customer_count)} subscribers`
        : "";
    return `Targeting: ${segment.name}${segmentCount}`;
  }

  if (deliveredCount) {
    return `Audience size: ${formatCompactNumber(deliveredCount)} recipients`;
  }

  return null;
}

function toCardData(row: RecentNewsletterRow): NewsletterCampaignCardData {
  const displayStatus = toDisplayStatus(row.status);
  const deliveredCount = deriveDeliveredCount(row);
  const openRate = deriveRate(row.open_rate, row.total_opens, deliveredCount);
  const clickRate = deriveRate(
    row.click_rate,
    row.total_clicks,
    deliveredCount,
  );

  return {
    id: row.id,
    title: row.name || row.subject_line || "Untitled newsletter",
    audienceSummary: buildAudienceSummary(row, displayStatus),
    dateLabel: formatDateLabel(row, displayStatus),
    deliveredCount,
    openRate: displayStatus === "sent" ? openRate : null,
    clickRate: displayStatus === "sent" ? clickRate : null,
    scheduledDetail:
      displayStatus === "scheduled" || displayStatus === "sending"
        ? formatScheduledDetail(row)
        : null,
    status: displayStatus,
    statusLabel: toStatusLabel(row.status, displayStatus),
  };
}

function createFilterCounts(campaigns: NewsletterCampaignCardData[]) {
  return campaigns.reduce<Record<FilterKey, number>>(
    (counts, campaign) => {
      counts.all += 1;
      counts[toFilterKey(campaign.status)] += 1;
      return counts;
    },
    {
      all: 0,
      draft: 0,
      scheduled: 0,
      sent: 0,
      archived: 0,
    },
  );
}

type ActionCardConfig = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  icon: LucideIcon;
  buttonVariant: "solid" | "outlined";
  accent: {
    background: string;
    hoverBackground: string;
    color: string;
    borderColor: string;
  };
} & (
  | {
      action: {
        type: "navigate";
        href: string;
      };
    }
  | {
      action: {
        type: "open-ai-picker";
      };
    }
);

const actionCards: ActionCardConfig[] = [
  {
    eyebrow: "Compose",
    title: "New Newsletter",
    description:
      "Jump straight into the CRM newsletter builder with campaign defaults already in place.",
    actionLabel: "Launch builder",
    action: {
      type: "navigate",
      href: "/crm/campaigns/new?type=newsletter",
    },
    icon: Plus,
    buttonVariant: "solid",
    accent: {
      background: "rgba(37, 99, 235, 0.12)",
      hoverBackground: "rgba(37, 99, 235, 0.18)",
      color: "#1d4ed8",
      borderColor: "rgba(37, 99, 235, 0.18)",
    },
  },
  {
    eyebrow: "AI Studio",
    title: "AI Ideas",
    description:
      "Generate AI-powered newsletter concepts, seasonal prompts, and editor-ready starting points tailored to your next send.",
    actionLabel: "AI Ideas",
    action: {
      type: "open-ai-picker",
    },
    icon: Sparkles,
    buttonVariant: "outlined",
    accent: {
      background: "rgba(37, 99, 235, 0.12)",
      hoverBackground: "rgba(37, 99, 235, 0.18)",
      color: "#1d4ed8",
      borderColor: "rgba(37, 99, 235, 0.18)",
    },
  },
  {
    eyebrow: "Monitor",
    title: "Campaigns",
    description:
      "Review drafts, scheduled sends, and reporting in the full CRM campaign queue.",
    actionLabel: "View campaigns",
    action: {
      type: "navigate",
      href: "/crm/campaigns",
    },
    icon: Send,
    buttonVariant: "outlined",
    accent: {
      background: "rgba(13, 148, 136, 0.12)",
      hoverBackground: "rgba(13, 148, 136, 0.18)",
      color: "#0f766e",
      borderColor: "rgba(13, 148, 136, 0.18)",
    },
  },
];

function NewsletterActionCard({
  action,
  actionLabel,
  accent,
  buttonVariant,
  description,
  eyebrow,
  icon: Icon,
  onAction,
  title,
}: ActionCardConfig & {
  onAction: (action: ActionCardConfig["action"]) => void;
}) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: "100%",
        minHeight: { xs: 240, md: 264 },
        p: { xs: 3, md: 3.25 },
        borderRadius: "xl",
        borderColor: "neutral.200",
        boxShadow: "sm",
        background:
          "linear-gradient(180deg, rgba(255, 255, 255, 0.99) 0%, rgba(248, 250, 252, 0.94) 100%)",
        display: "flex",
        flexDirection: "column",
        gap: 2.25,
        overflow: "hidden",
        position: "relative",
        transition: surfaceTransition,
        "&::after": {
          content: '""',
          position: "absolute",
          inset: "auto -44px -56px auto",
          width: 160,
          height: 160,
          borderRadius: "50%",
          background: accent.background,
          opacity: 0.5,
          filter: "blur(24px)",
          pointerEvents: "none",
        },
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "md",
          borderColor: accent.borderColor,
        },
        "&:hover .newsletter-action-card__icon": {
          backgroundColor: accent.hoverBackground,
        },
      }}
    >
      <Sheet
        className="newsletter-action-card__icon"
        variant="soft"
        sx={{
          width: 56,
          height: 56,
          borderRadius: "lg",
          display: "grid",
          placeItems: "center",
          backgroundColor: accent.background,
          color: accent.color,
          border: "1px solid",
          borderColor: accent.borderColor,
          transition:
            "background-color 0.2s ease-in-out, transform 0.2s ease-in-out",
          position: "relative",
          zIndex: 1,
        }}
      >
        <Icon size={22} />
      </Sheet>

      <Stack spacing={1.1} sx={{ position: "relative", zIndex: 1 }}>
        <Typography
          level="body-xs"
          sx={{
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "text.tertiary",
          }}
        >
          {eyebrow}
        </Typography>
        <Typography
          level="title-lg"
          sx={{ color: "text.primary", letterSpacing: "-0.02em" }}
        >
          {title}
        </Typography>
        <Typography
          level="body-sm"
          sx={{
            color: "text.secondary",
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 2,
            overflow: "hidden",
            maxWidth: 320,
          }}
        >
          {description}
        </Typography>
      </Stack>

      <Box sx={{ mt: "auto", pt: 1, position: "relative", zIndex: 1 }}>
        <Button
          size="sm"
          variant={buttonVariant}
          color={buttonVariant === "solid" ? "primary" : "neutral"}
          endDecorator={<ArrowRight size={14} />}
          onClick={() => onAction(action)}
          sx={{ width: "100%", ...buttonTransitionSx }}
        >
          {actionLabel}
        </Button>
      </Box>
    </Card>
  );
}

function NewsletterEmptyState({
  onNavigate,
  onOpenAiIdeas,
}: {
  onNavigate: (href: string) => void;
  onOpenAiIdeas: () => void;
}) {
  return (
    <Box
      sx={{
        minHeight: { xs: 320, md: 360 },
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: 1, md: 2 },
      }}
    >
      <Stack
        spacing={2.25}
        alignItems="center"
        justifyContent="center"
        sx={{ textAlign: "center", maxWidth: 460 }}
      >
        <Sheet
          variant="soft"
          color="neutral"
          sx={{
            width: 92,
            height: 92,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            position: "relative",
            background:
              "radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.94), rgba(226, 232, 240, 0.92))",
            boxShadow: "inset 0 0 0 1px rgba(148, 163, 184, 0.18)",
            "&::after": {
              content: '""',
              position: "absolute",
              inset: 10,
              borderRadius: "50%",
              border: "1px solid rgba(148, 163, 184, 0.22)",
            },
          }}
        >
          <Mail size={36} />
        </Sheet>

        <Stack spacing={0.75} sx={{ maxWidth: 420 }}>
          <Typography level="title-sm" sx={{ fontWeight: 600 }}>
            No newsletters yet
          </Typography>
          <Typography level="body-sm" sx={{ color: "text.secondary" }}>
            Create your first newsletter to start building a campaign history
            here.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} useFlexGap>
          <Button
            size="sm"
            variant="solid"
            color="primary"
            startDecorator={<Plus size={14} />}
            onClick={() => onNavigate("/newsletters/new")}
            sx={buttonTransitionSx}
          >
            Create Newsletter
          </Button>
          <Button
            size="sm"
            variant="outlined"
            color="neutral"
            startDecorator={<Sparkles size={14} />}
            onClick={onOpenAiIdeas}
            sx={buttonTransitionSx}
          >
            Open AI Ideas
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export const NewslettersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant, loading: tenantLoading } = useTenant();
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [pickerOpen, setPickerOpen] = useState(false);

  const {
    data: recentNewsletters = [],
    error,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["recent-newsletters", tenant?.id ?? null, user?.id ?? null],
    enabled: Boolean(user) && !tenantLoading,
    queryFn: async () => {
      if (!user) {
        return [] as NewsletterCampaignCardData[];
      }

      let query = supabase
        .from("crm_campaigns")
        .select(
          `
            id,
            name,
            subject_line,
            status,
            created_at,
            updated_at,
            scheduled_at,
            sent_at,
            synced_from,
            metadata,
            metrics,
            open_rate,
            click_rate,
            total_sent,
            total_opens,
            total_clicks,
            crm_segments(name, customer_count)
          `,
        )
        .order("updated_at", { ascending: false })
        .limit(40);

      query = tenant?.id
        ? query.eq("tenant_id", tenant.id)
        : query.eq("user_id", user.id);

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      // crm_campaigns does not persist a reliable newsletter type. Fetch a
      // slightly wider recent window, exclude SMS rows client-side, then trim.
      return (data ?? [])
        .filter((row) =>
          isNewsletterSurfaceCampaign(row as RecentNewsletterRow),
        )
        .slice(0, 20)
        .map((row) => toCardData(row as RecentNewsletterRow));
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const filterCounts = useMemo(
    () => createFilterCounts(recentNewsletters),
    [recentNewsletters],
  );

  const filteredCampaigns = useMemo(() => {
    if (activeFilter === "all") {
      return recentNewsletters;
    }

    return recentNewsletters.filter(
      (campaign) => toFilterKey(campaign.status) === activeFilter,
    );
  }, [activeFilter, recentNewsletters]);

  const statsItems = useMemo(() => {
    const sentCampaigns = recentNewsletters.filter(
      (campaign) => campaign.status === "sent",
    );

    const totalSent = sentCampaigns.reduce(
      (sum, campaign) => sum + (campaign.deliveredCount ?? 0),
      0,
    );

    const openRates = sentCampaigns
      .map((campaign) => campaign.openRate)
      .filter((value): value is number => typeof value === "number");

    const averageOpenRate =
      openRates.length > 0
        ? openRates.reduce((sum, value) => sum + value, 0) / openRates.length
        : null;

    return [
      { label: "Campaigns", value: String(recentNewsletters.length) },
      { label: "Drafts", value: String(filterCounts.draft) },
      { label: "Scheduled", value: String(filterCounts.scheduled) },
      {
        label: "Total Sent",
        value: totalSent > 0 ? formatCompactNumber(totalSent) : "0",
      },
      {
        label: "Avg. Open Rate",
        value:
          averageOpenRate === null
            ? "-"
            : `${new Intl.NumberFormat("en", {
                maximumFractionDigits: averageOpenRate >= 10 ? 0 : 1,
              }).format(averageOpenRate)}%`,
      },
    ];
  }, [filterCounts.draft, filterCounts.scheduled, recentNewsletters]);

  const filterOptions = useMemo(
    () => [
      { key: "all" as const, label: `All (${filterCounts.all})` },
      { key: "draft" as const, label: `Draft (${filterCounts.draft})` },
      {
        key: "scheduled" as const,
        label: `Scheduled (${filterCounts.scheduled})`,
      },
      { key: "sent" as const, label: `Sent (${filterCounts.sent})` },
      {
        key: "archived" as const,
        label: `Archived (${filterCounts.archived})`,
      },
    ],
    [filterCounts],
  );

  const handleNavigate = (href: string) => {
    navigate(href);
  };

  const handleAction = (action: ActionCardConfig["action"]) => {
    if (action.type === "open-ai-picker") {
      setPickerOpen(true);
      return;
    }

    navigate(action.href);
  };

  const hasRecentNewsletters = recentNewsletters.length > 0;
  const isRecentSectionLoading = tenantLoading || (Boolean(user) && isLoading);
  const showRecentSectionError =
    !isRecentSectionLoading && Boolean(error) && !hasRecentNewsletters;
  const showRecentSectionEmpty =
    !isRecentSectionLoading && !error && !hasRecentNewsletters;
  const recentSectionStateKey = isRecentSectionLoading
    ? "loading"
    : showRecentSectionError
      ? "error"
      : showRecentSectionEmpty
        ? "empty"
        : "data";

  return (
    <Box sx={{ width: "100%" }}>
      <Stack spacing={3}>
        <Sheet
          variant="soft"
          sx={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "xl",
            p: { xs: 3, md: 4.25 },
            border: "1px solid",
            borderColor: "neutral.200",
            boxShadow: "sm",
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(239, 246, 255, 0.9) 44%, rgba(255, 247, 237, 0.82) 100%)",
            "&::before": {
              content: '""',
              position: "absolute",
              width: 300,
              height: 300,
              top: -160,
              right: -84,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(37, 99, 235, 0.16) 0%, rgba(37, 99, 235, 0) 68%)",
              pointerEvents: "none",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              width: 180,
              height: 180,
              top: 32,
              right: 96,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0) 72%)",
              pointerEvents: "none",
            },
          }}
        >
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={3}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", md: "center" }}
            sx={{ position: "relative", zIndex: 1 }}
          >
            <Stack spacing={1.5} sx={{ maxWidth: 700 }}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Sheet
                  variant="soft"
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "lg",
                    display: "grid",
                    placeItems: "center",
                    backgroundColor: "rgba(37, 99, 235, 0.12)",
                    color: "#1d4ed8",
                    boxShadow: "inset 0 0 0 1px rgba(37, 99, 235, 0.08)",
                  }}
                >
                  <Mail size={24} />
                </Sheet>
                <Typography
                  level="h2"
                  sx={{ fontWeight: 700, letterSpacing: "-0.03em" }}
                >
                  Newsletter Studio
                </Typography>
              </Stack>

              <Typography
                level="body-md"
                sx={{ color: "text.secondary", maxWidth: 620 }}
              >
                Create, launch, and monitor email campaigns from a refined home
                base that keeps AI ideation, blank starts, and recent campaign
                momentum within reach.
              </Typography>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                <Chip size="sm" variant="outlined" color="success">
                  Tenant email workspace
                </Chip>
                <Chip size="sm" variant="outlined" color="success">
                  AI ideas ready
                </Chip>
              </Stack>
            </Stack>

            <Stack
              spacing={0.75}
              alignItems={{ xs: "stretch", md: "flex-end" }}
              sx={{ width: { xs: "100%", md: "auto" } }}
            >
              <Box
                sx={{
                  width: { xs: "100%", md: "auto" },
                  alignSelf: { xs: "stretch", md: "flex-end" },
                }}
              >
                <JoyDropdownMenu>
                  <ButtonGroup
                    variant="solid"
                    color="primary"
                    sx={{
                      width: { xs: "100%", md: "auto" },
                      borderRadius: "lg",
                      minWidth: { md: 236 },
                      boxShadow: "sm",
                    }}
                  >
                    <Button
                      size="md"
                      variant="solid"
                      color="primary"
                      startDecorator={<Sparkles size={16} />}
                      onClick={() => setPickerOpen(true)}
                      sx={{
                        flex: 1,
                        justifyContent: "center",
                        borderInlineEnd:
                          "1px solid rgba(var(--joy-palette-primary-mainChannel) / 0.34)",
                      }}
                    >
                      Create with AI
                    </Button>

                    <MenuButton
                      size="md"
                      variant="solid"
                      color="primary"
                      aria-label="More newsletter creation options"
                      sx={{
                        minWidth: 44,
                        px: 1,
                        transition: "background-color 0.15s ease",
                        "& .newsletter-header-cta__chevron": {
                          transition: "transform 0.2s ease",
                        },
                        '&[aria-expanded="true"] .newsletter-header-cta__chevron':
                          {
                            transform: "rotate(180deg)",
                          },
                      }}
                    >
                      <ChevronDown
                        className="newsletter-header-cta__chevron"
                        size={16}
                      />
                    </MenuButton>
                  </ButtonGroup>

                  <JoyDropdownMenuContent
                    className="bg-card"
                    placement="bottom-end"
                    size="sm"
                    variant="outlined"
                    sx={{
                      mt: 1,
                      p: 0.75,
                      minWidth: 272,
                      borderRadius: "xl",
                      borderColor: "neutral.200",
                      backgroundColor: "background.surface",
                      backgroundImage:
                        "linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.96) 100%)",
                      boxShadow: "0 12px 32px rgba(15, 23, 42, 0.12)",
                      transformOrigin: "top right",
                      animation: "newsletter-cta-menu-in 0.12s ease",
                      "--List-padding": "0px",
                      "@keyframes newsletter-cta-menu-in": {
                        from: {
                          opacity: 0,
                          transform: "scale(0.97)",
                        },
                        to: {
                          opacity: 1,
                          transform: "scale(1)",
                        },
                      },
                    }}
                  >
                    <JoyDropdownMenuLabel
                      sx={{
                        px: 1,
                        pt: 0.25,
                        pb: 0.75,
                        color: "text.tertiary",
                        fontSize: "0.68rem",
                        letterSpacing: "0.1em",
                      }}
                    >
                      Quick Start
                    </JoyDropdownMenuLabel>

                    <JoyDropdownMenuItem
                      onClick={() =>
                        handleNavigate("/crm/campaigns/new?type=newsletter")
                      }
                      startDecorator={
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            color: "text.secondary",
                            background:
                              "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(241,245,249,0.92) 100%)",
                            boxShadow:
                              "inset 0 0 0 1px rgba(148, 163, 184, 0.12)",
                          }}
                        >
                          <FileText size={16} />
                        </Sheet>
                      }
                      sx={{
                        minHeight: 0,
                        px: 1.25,
                        py: 1.125,
                        borderRadius: "lg",
                        alignItems: "flex-start",
                        gap: 1.25,
                        transition:
                          "background-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease",
                        "& .MuiListItemDecorator-root": {
                          mt: 0.125,
                          minInlineSize: 0,
                        },
                        "&:hover": {
                          backgroundColor: "neutral.50",
                          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography
                          level="body-sm"
                          sx={{ fontWeight: 600, color: "text.primary" }}
                        >
                          Start from Blank
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary", lineHeight: 1.5 }}
                        >
                          Open a blank editor
                        </Typography>
                      </Stack>
                    </JoyDropdownMenuItem>

                    <JoyDropdownMenuSeparator
                      sx={{ my: 0.5, borderColor: "neutral.100" }}
                    />

                    <JoyDropdownMenuItem
                      onClick={() =>
                        handleNavigate("/templates?type=newsletter")
                      }
                      startDecorator={
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "50%",
                            display: "grid",
                            placeItems: "center",
                            color: "text.secondary",
                            background:
                              "linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(241,245,249,0.92) 100%)",
                            boxShadow:
                              "inset 0 0 0 1px rgba(148, 163, 184, 0.12)",
                          }}
                        >
                          <LayoutTemplate size={16} />
                        </Sheet>
                      }
                      sx={{
                        minHeight: 0,
                        px: 1.25,
                        py: 1.125,
                        borderRadius: "lg",
                        alignItems: "flex-start",
                        gap: 1.25,
                        transition:
                          "background-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease",
                        "& .MuiListItemDecorator-root": {
                          mt: 0.125,
                          minInlineSize: 0,
                        },
                        "&:hover": {
                          backgroundColor: "neutral.50",
                          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.06)",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography
                          level="body-sm"
                          sx={{ fontWeight: 600, color: "text.primary" }}
                        >
                          Browse Templates
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary", lineHeight: 1.5 }}
                        >
                          Start from a saved layout
                        </Typography>
                      </Stack>
                    </JoyDropdownMenuItem>
                  </JoyDropdownMenuContent>
                </JoyDropdownMenu>
              </Box>

              <Button
                size="sm"
                variant="plain"
                color="neutral"
                endDecorator={<ArrowRight size={14} />}
                onClick={() => handleNavigate("/crm/campaigns")}
                sx={{
                  px: 0,
                  minHeight: "auto",
                  alignSelf: { xs: "flex-start", md: "flex-end" },
                  ...buttonTransitionSx,
                }}
              >
                View all campaigns
              </Button>
            </Stack>
          </Stack>
        </Sheet>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "minmax(0, 1fr)",
              md: "repeat(3, minmax(0, 1fr))",
            },
            gap: 3,
            alignItems: "stretch",
          }}
        >
          {actionCards.map((card) => (
            <NewsletterActionCard
              key={card.title}
              {...card}
              onAction={handleAction}
            />
          ))}
        </Box>

        <Card
          variant="outlined"
          sx={{
            borderRadius: "xl",
            borderColor: "neutral.200",
            boxShadow: "sm",
            p: { xs: 3, md: 3.5 },
            background:
              "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)",
          }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1.25}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={0.75}>
                <Typography level="title-lg" sx={{ fontWeight: 600 }}>
                  Recent newsletters
                </Typography>
                <Typography level="body-sm" sx={{ color: "text.secondary" }}>
                  Track live momentum, revisit drafts, and keep the latest
                  newsletter work close at hand.
                </Typography>
              </Stack>

              {!isRecentSectionLoading && hasRecentNewsletters ? (
                <Chip size="sm" variant="outlined" color="neutral">
                  {recentNewsletters.length} campaigns tracked
                </Chip>
              ) : null}
            </Stack>

            <Box
              key={recentSectionStateKey}
              sx={{
                animation: "newsletter-recent-section-fade 0.18s ease",
                "@keyframes newsletter-recent-section-fade": {
                  from: { opacity: 0, transform: "translateY(4px)" },
                  to: { opacity: 1, transform: "translateY(0)" },
                },
              }}
            >
              {isRecentSectionLoading ? (
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "minmax(0, 1fr)",
                      md: "repeat(2, minmax(0, 1fr))",
                    },
                    gap: 3,
                  }}
                >
                  {Array.from({ length: 4 }).map((_, index) => (
                    <NewsletterCampaignCardSkeleton key={index} />
                  ))}
                </Box>
              ) : showRecentSectionError ? (
                <Sheet
                  variant="soft"
                  color="danger"
                  sx={{
                    borderRadius: "xl",
                    border: "1px solid",
                    borderColor: "rgba(239, 68, 68, 0.16)",
                    p: 2.5,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1.5}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Sheet
                        variant="soft"
                        color="danger"
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "lg",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <AlertCircle size={18} />
                      </Sheet>
                      <Stack spacing={0.4}>
                        <Typography level="title-sm" sx={{ fontWeight: 600 }}>
                          Unable to load newsletters
                        </Typography>
                        <Typography level="body-sm">
                          Try again to refresh recent newsletter activity.
                        </Typography>
                      </Stack>
                    </Stack>
                    <Button
                      size="sm"
                      variant="outlined"
                      color="danger"
                      onClick={() => void refetch()}
                    >
                      Retry
                    </Button>
                  </Stack>
                </Sheet>
              ) : showRecentSectionEmpty ? (
                <NewsletterEmptyState
                  onNavigate={handleNavigate}
                  onOpenAiIdeas={() => setPickerOpen(true)}
                />
              ) : (
                <Stack spacing={2.5}>
                  <NewsletterStatsStrip items={statsItems} />

                  {error ? (
                    <Sheet
                      variant="soft"
                      color="danger"
                      sx={{
                        borderRadius: "lg",
                        border: "1px solid",
                        borderColor: "rgba(239, 68, 68, 0.16)",
                        p: 1.5,
                      }}
                    >
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.25}
                        justifyContent="space-between"
                        alignItems={{ xs: "flex-start", sm: "center" }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <AlertCircle size={16} />
                          <Typography level="body-sm">
                            Unable to refresh newsletter activity right now.
                          </Typography>
                        </Stack>
                        <Button
                          size="sm"
                          variant="outlined"
                          color="danger"
                          onClick={() => void refetch()}
                        >
                          Retry
                        </Button>
                      </Stack>
                    </Sheet>
                  ) : null}

                  <Stack
                    direction="row"
                    spacing={1}
                    useFlexGap
                    sx={{
                      overflowX: "auto",
                      flexWrap: "nowrap",
                      pb: 0.5,
                      "&::-webkit-scrollbar": {
                        display: "none",
                      },
                    }}
                  >
                    {filterOptions.map((option) => {
                      const isSelected = option.key === activeFilter;

                      return (
                        <Chip
                          key={option.key}
                          size="sm"
                          variant={isSelected ? "solid" : "outlined"}
                          color={isSelected ? "primary" : "neutral"}
                          onClick={() => setActiveFilter(option.key)}
                          sx={{
                            flex: "0 0 auto",
                            cursor: "pointer",
                            transition: "all 0.18s ease",
                            "&:hover": {
                              transform: "translateY(-1px)",
                            },
                          }}
                        >
                          {option.label}
                        </Chip>
                      );
                    })}
                  </Stack>

                  {filteredCampaigns.length === 0 ? (
                    <Sheet
                      variant="soft"
                      color="neutral"
                      sx={{
                        borderRadius: "xl",
                        border: "1px solid",
                        borderColor: "neutral.200",
                        p: 3,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{
                            width: 42,
                            height: 42,
                            borderRadius: "lg",
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          <Inbox size={18} />
                        </Sheet>
                        <Stack spacing={0.4}>
                          <Typography level="title-sm">
                            No {activeFilter} newsletters
                          </Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "text.secondary" }}
                          >
                            Try another status filter or create a new newsletter
                            to fill out this view.
                          </Typography>
                        </Stack>
                      </Stack>
                    </Sheet>
                  ) : (
                    <Box
                      key={activeFilter}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "minmax(0, 1fr)",
                          md: "repeat(2, minmax(0, 1fr))",
                        },
                        gap: 3,
                        alignItems: "stretch",
                        minHeight: { xs: 260, md: 320 },
                        transition: "min-height 0.22s ease",
                        animation: "newsletter-filter-fade 0.22s ease",
                        "@keyframes newsletter-filter-fade": {
                          from: { opacity: 0, transform: "translateY(6px)" },
                          to: { opacity: 1, transform: "translateY(0)" },
                        },
                      }}
                    >
                      {filteredCampaigns.map((campaign) => {
                        const targetPath =
                          campaign.status === "sent"
                            ? `/crm/campaigns/${campaign.id}/report`
                            : `/crm/campaigns/${campaign.id}`;

                        return (
                          <NewsletterCampaignCard
                            key={campaign.id}
                            campaign={campaign}
                            onClick={() => handleNavigate(targetPath)}
                          />
                        );
                      })}
                    </Box>
                  )}
                </Stack>
              )}
            </Box>
          </Stack>
        </Card>
      </Stack>

      <NewsletterPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
      />
    </Box>
  );
};
