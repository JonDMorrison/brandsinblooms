import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import ToggleButtonGroup from "@mui/joy/ToggleButtonGroup";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Copy,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Newspaper,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import { JoyDebouncedInput } from "@/components/joy/JoyDebouncedInput";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyPageHeaderBand } from "@/components/joy/JoyPageHeaderBand";
import { PageContainer } from "@/components/joy/PageContainer";
import { JoySelect } from "@/components/joy/JoySelect";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
  type JoyTableSortDirection,
} from "@/components/joy/JoyTable";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import { useTenant } from "@/hooks/useTenant";
import {
  deleteCampaignById,
  fetchCampaignCatalog,
  updateCampaignStatus,
  type CampaignCatalogItem,
  type CampaignChannel,
} from "@/lib/crm/campaignEditor";

type ViewMode = "grid" | "table";
type TypeFilter = "all" | CampaignChannel;
type StatusFilter =
  | "all"
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed"
  | "paused";
type SortOption =
  | "newest"
  | "oldest"
  | "name-asc"
  | "name-desc"
  | "recipients-desc"
  | "recipients-asc"
  | "open-rate-desc"
  | "open-rate-asc"
  | "click-rate-desc"
  | "click-rate-asc";
type SortColumn =
  | "campaign"
  | "recipients"
  | "open-rate"
  | "click-rate"
  | "date";

const GRID_COLUMNS = {
  xs: "1fr",
  md: "repeat(2, minmax(0, 1fr))",
  xl: "repeat(3, minmax(0, 1fr))",
} as const;

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "recipients-desc", label: "Most recipients" },
  { value: "open-rate-desc", label: "Best open rate" },
  { value: "click-rate-desc", label: "Best click rate" },
];

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "newsletter", label: "Newsletter" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "paused", label: "Paused" },
];

function getCampaignIcon(channel: CampaignChannel) {
  switch (channel) {
    case "sms":
      return MessageSquare;
    case "newsletter":
      return Newspaper;
    default:
      return Mail;
  }
}

function getCampaignSubject(campaign: CampaignCatalogItem) {
  return campaign.subjectLine || campaign.preheaderText || "No subject yet";
}

function isSentCampaign(campaign: CampaignCatalogItem) {
  return ["sent", "sent_with_errors"].includes(campaign.status);
}

function getDisplayDate(campaign: CampaignCatalogItem) {
  const dateValue =
    campaign.sentAt ||
    campaign.scheduledAt ||
    campaign.updatedAt ||
    campaign.createdAt;

  return dateValue
    ? formatDistanceToNow(new Date(dateValue), { addSuffix: true })
    : "No date";
}

function getSortDate(campaign: CampaignCatalogItem) {
  return new Date(
    campaign.sentAt ||
      campaign.scheduledAt ||
      campaign.updatedAt ||
      campaign.createdAt ||
      0,
  ).getTime();
}

function getCampaignStatusTone(campaign: CampaignCatalogItem) {
  switch (campaign.status) {
    case "sent":
      return "success" as const;
    case "sent_with_errors":
      return "warning" as const;
    case "failed":
      return "danger" as const;
    case "scheduled":
    case "queued":
    case "partially_queued":
    case "sending":
      return "info" as const;
    case "paused":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function getCampaignStatusLabel(campaign: CampaignCatalogItem) {
  if (campaign.status === "sent_with_errors") {
    return "Sent w/ errors";
  }

  if (campaign.status === "partially_queued") {
    return "Partially queued";
  }

  return undefined;
}

function normalizeSortOption(value: string | null): SortOption {
  switch (value) {
    case "oldest":
    case "name-asc":
    case "name-desc":
    case "recipients-desc":
    case "recipients-asc":
    case "open-rate-desc":
    case "open-rate-asc":
    case "click-rate-desc":
    case "click-rate-asc":
      return value;
    case "name":
      return "name-asc";
    case "recipients":
      return "recipients-desc";
    case "open-rate":
      return "open-rate-desc";
    case "newest":
    default:
      return "newest";
  }
}

function matchesStatusFilter(
  campaign: CampaignCatalogItem,
  status: StatusFilter,
) {
  if (status === "all") {
    return true;
  }

  if (status === "sent") {
    return isSentCampaign(campaign);
  }

  if (status === "scheduled") {
    return ["scheduled", "queued", "partially_queued"].includes(
      campaign.status,
    );
  }

  if (status === "sending") {
    return ["sending", "queued", "partially_queued"].includes(campaign.status);
  }

  return campaign.status === status;
}

function getColumnSortDirection(
  sort: SortOption,
  column: SortColumn,
): JoyTableSortDirection {
  switch (column) {
    case "campaign":
      if (sort === "name-asc") return "asc";
      if (sort === "name-desc") return "desc";
      return "none";
    case "recipients":
      if (sort === "recipients-asc") return "asc";
      if (sort === "recipients-desc") return "desc";
      return "none";
    case "open-rate":
      if (sort === "open-rate-asc") return "asc";
      if (sort === "open-rate-desc") return "desc";
      return "none";
    case "click-rate":
      if (sort === "click-rate-asc") return "asc";
      if (sort === "click-rate-desc") return "desc";
      return "none";
    case "date":
      if (sort === "oldest") return "asc";
      if (sort === "newest") return "desc";
      return "none";
  }
}

function getNextSortOption(
  current: SortOption,
  column: SortColumn,
): SortOption {
  switch (column) {
    case "campaign":
      return current === "name-asc" ? "name-desc" : "name-asc";
    case "recipients":
      return current === "recipients-desc"
        ? "recipients-asc"
        : "recipients-desc";
    case "open-rate":
      return current === "open-rate-desc" ? "open-rate-asc" : "open-rate-desc";
    case "click-rate":
      return current === "click-rate-desc"
        ? "click-rate-asc"
        : "click-rate-desc";
    case "date":
      return current === "newest" ? "oldest" : "newest";
  }
}

function CampaignStatsStrip({
  items,
}: {
  items: Array<{ label: string; value: string; icon: React.ElementType }>;
}) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", overflow: "hidden" }}>
      <Stack
        direction={{ xs: "column", xl: "row" }}
        divider={
          <Divider
            orientation="vertical"
            sx={{ display: { xs: "none", xl: "block" } }}
          />
        }
      >
        {items.map((item) => (
          <Box key={item.label} sx={{ flex: 1, p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Avatar
                color="neutral"
                variant="soft"
                sx={{ width: 32, height: 32 }}
              >
                <item.icon size={16} />
              </Avatar>
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  {item.label}
                </Typography>
                <Typography level="title-md" fontWeight="lg">
                  {item.value}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Sheet>
  );
}

function StatsStripSkeleton() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", overflow: "hidden" }}>
      <Stack
        direction={{ xs: "column", xl: "row" }}
        divider={
          <Divider
            orientation="vertical"
            sx={{ display: { xs: "none", xl: "block" } }}
          />
        }
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Box key={index} sx={{ flex: 1, p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Skeleton
                variant="circular"
                width={32}
                height={32}
                animation="wave"
              />
              <Stack spacing={0.5}>
                <Skeleton
                  variant="text"
                  width={80}
                  height={12}
                  animation="wave"
                />
                <Skeleton
                  variant="text"
                  width={48}
                  height={22}
                  animation="wave"
                />
              </Stack>
            </Stack>
          </Box>
        ))}
      </Stack>
    </Sheet>
  );
}

function CampaignCardSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{ borderRadius: "lg", p: 2, minHeight: 226, height: "100%" }}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton
            variant="circular"
            width={36}
            height={36}
            animation="wave"
          />
          <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Skeleton variant="text" width="65%" height={18} animation="wave" />
            <Skeleton variant="text" width="85%" height={14} animation="wave" />
          </Stack>
          <Skeleton
            variant="circular"
            width={28}
            height={28}
            animation="wave"
          />
        </Stack>

        <Box>
          <Skeleton
            variant="rectangular"
            width={52}
            height={22}
            animation="wave"
            sx={{ borderRadius: "sm" }}
          />
        </Box>

        <Stack direction="row" spacing={3}>
          <Skeleton variant="text" width={90} height={14} animation="wave" />
          <Skeleton variant="text" width={70} height={14} animation="wave" />
          <Skeleton variant="text" width={60} height={14} animation="wave" />
        </Stack>

        <Skeleton variant="text" width={120} height={12} animation="wave" />

        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ mt: "auto" }}
        >
          <Skeleton variant="text" width={80} height={14} animation="wave" />
          <Skeleton variant="text" width={100} height={14} animation="wave" />
        </Stack>
      </Stack>
    </Sheet>
  );
}

function CampaignCard({
  campaign,
  onOpenDuplicate,
  onOpenDelete,
  onToggleStatus,
  onNavigate,
  onOpenRecipients,
}: {
  campaign: CampaignCatalogItem;
  onOpenDuplicate: (campaign: CampaignCatalogItem) => void;
  onOpenDelete: (campaign: CampaignCatalogItem) => void;
  onToggleStatus: (campaign: CampaignCatalogItem) => void;
  onNavigate: (campaign: CampaignCatalogItem) => void;
  onOpenRecipients: (campaign: CampaignCatalogItem) => void;
}) {
  const Icon = getCampaignIcon(campaign.channel);
  const sentCampaign = isSentCampaign(campaign);

  return (
    <Sheet
      onClick={() => onNavigate(campaign)}
      variant="outlined"
      sx={{
        borderRadius: "lg",
        p: 2,
        minHeight: 226,
        height: "100%",
        cursor: "pointer",
        transition: "all 200ms ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "md",
        },
      }}
    >
      <Stack spacing={2} sx={{ height: "100%" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            sx={{ minWidth: 0, flex: 1 }}
          >
            <Avatar
              color="neutral"
              variant="soft"
              sx={{ width: 36, height: 36 }}
            >
              <Icon size={18} />
            </Avatar>
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                level="title-sm"
                fontWeight="lg"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {campaign.name}
              </Typography>
              <Typography
                level="body-xs"
                sx={{
                  color: "neutral.500",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getCampaignSubject(campaign)}
              </Typography>
            </Stack>
          </Stack>

          <JoyDropdownMenu>
            <JoyDropdownMenuTrigger variant="plain" color="neutral" size="sm">
              <MoreHorizontal size={16} />
            </JoyDropdownMenuTrigger>
            <JoyDropdownMenuContent>
              <JoyDropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDuplicate(campaign);
                }}
                startDecorator={<Copy size={16} />}
              >
                Duplicate
              </JoyDropdownMenuItem>
              <JoyDropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleStatus(campaign);
                }}
                startDecorator={
                  campaign.status === "paused" ? (
                    <Play size={16} />
                  ) : (
                    <Pause size={16} />
                  )
                }
              >
                {campaign.status === "paused" ? "Resume" : "Pause"}
              </JoyDropdownMenuItem>
              <JoyDropdownMenuItem
                destructive
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenDelete(campaign);
                }}
                startDecorator={<Trash2 size={16} />}
              >
                Delete
              </JoyDropdownMenuItem>
            </JoyDropdownMenuContent>
          </JoyDropdownMenu>
        </Stack>

        <Box>
          <JoyStatusChip
            size="sm"
            status={campaign.status}
            tone={getCampaignStatusTone(campaign)}
            label={getCampaignStatusLabel(campaign)}
          />
        </Box>

        <Stack direction="row" spacing={3} useFlexGap flexWrap="wrap">
          <Typography level="body-xs" sx={{ color: "neutral.600" }}>
            {campaign.totalRecipients.toLocaleString()} recipients
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.600" }}>
            {sentCampaign ? `${campaign.openRate.toFixed(1)}% open` : "-- open"}
          </Typography>
          <Typography level="body-xs" sx={{ color: "neutral.600" }}>
            {sentCampaign
              ? `${campaign.clickRate.toFixed(1)}% click`
              : "-- click"}
          </Typography>
        </Stack>

        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {getDisplayDate(campaign)}
        </Typography>

        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ mt: "auto" }}
        >
          <JoyButton
            bloomVariant="link"
            color="neutral"
            onClick={(event) => {
              event.stopPropagation();
              onNavigate(campaign);
            }}
          >
            {sentCampaign ? "View report" : "Continue editing"}
          </JoyButton>
          <JoyButton
            bloomVariant="link"
            color="primary"
            onClick={(event) => {
              event.stopPropagation();
              if (sentCampaign) {
                onOpenRecipients(campaign);
                return;
              }
              onOpenDuplicate(campaign);
            }}
          >
            {sentCampaign ? "View recipients" : "Duplicate"}
          </JoyButton>
        </Stack>
      </Stack>
    </Sheet>
  );
}

export function CRMCampaignsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { cloneCampaign, isCloning } = useCampaignCloning();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteTarget, setDeleteTarget] =
    React.useState<CampaignCatalogItem | null>(null);
  const [duplicateTarget, setDuplicateTarget] =
    React.useState<CampaignCatalogItem | null>(null);
  const [duplicateName, setDuplicateName] = React.useState("");

  const query = searchParams.get("q") ?? "";
  const type = (searchParams.get("type") as TypeFilter | null) ?? "all";
  const status = (searchParams.get("status") as StatusFilter | null) ?? "all";
  const sort = normalizeSortOption(searchParams.get("sort"));
  const view = (searchParams.get("view") as ViewMode | null) ?? "grid";

  const campaignsQuery = useQuery({
    queryKey: ["crm-campaign-catalog", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => fetchCampaignCatalog(tenant!.id),
  });

  const updateParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (
          !value ||
          value === "all" ||
          (key === "view" && value === "grid") ||
          (key === "sort" && value === "newest")
        ) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const campaigns = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = (campaignsQuery.data ?? []).filter((campaign) => {
      if (type !== "all" && campaign.channel !== type) {
        return false;
      }

      if (!matchesStatusFilter(campaign, status)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return `${campaign.name} ${campaign.subjectLine} ${campaign.preheaderText}`
        .toLowerCase()
        .includes(normalizedQuery);
    });

    filtered.sort((left, right) => {
      switch (sort) {
        case "oldest":
          return getSortDate(left) - getSortDate(right);
        case "name-asc":
          return left.name.localeCompare(right.name);
        case "name-desc":
          return right.name.localeCompare(left.name);
        case "recipients-asc":
          return left.totalRecipients - right.totalRecipients;
        case "recipients-desc":
          return right.totalRecipients - left.totalRecipients;
        case "open-rate-asc":
          return left.openRate - right.openRate;
        case "open-rate-desc":
          return right.openRate - left.openRate;
        case "click-rate-asc":
          return left.clickRate - right.clickRate;
        case "click-rate-desc":
          return right.clickRate - left.clickRate;
        case "newest":
        default:
          return getSortDate(right) - getSortDate(left);
      }
    });

    return filtered;
  }, [campaignsQuery.data, query, sort, status, type]);

  const stats = React.useMemo(() => {
    const sentThisMonth = (campaignsQuery.data ?? []).filter((campaign) => {
      if (!campaign.sentAt) {
        return false;
      }

      const sentDate = new Date(campaign.sentAt);
      const now = new Date();
      return (
        sentDate.getMonth() === now.getMonth() &&
        sentDate.getFullYear() === now.getFullYear()
      );
    }).length;

    const sentCampaigns = (campaignsQuery.data ?? []).filter((campaign) =>
      isSentCampaign(campaign),
    );
    const avgOpenRate = sentCampaigns.length
      ? sentCampaigns.reduce((sum, campaign) => sum + campaign.openRate, 0) /
        sentCampaigns.length
      : 0;
    const avgClickRate = sentCampaigns.length
      ? sentCampaigns.reduce((sum, campaign) => sum + campaign.clickRate, 0) /
        sentCampaigns.length
      : 0;
    const totalRecipients = (campaignsQuery.data ?? []).reduce(
      (sum, campaign) => sum + campaign.totalRecipients,
      0,
    );

    return [
      {
        label: "Total campaigns",
        value: (campaignsQuery.data ?? []).length.toLocaleString(),
        icon: Mail,
      },
      {
        label: "Sent this month",
        value: sentThisMonth.toLocaleString(),
        icon: BarChart3,
      },
      {
        label: "Avg open rate",
        value: `${avgOpenRate.toFixed(1)}%`,
        icon: Search,
      },
      {
        label: "Avg click rate",
        value: `${avgClickRate.toFixed(1)}%`,
        icon: Copy,
      },
      {
        label: "Total recipients",
        value: totalRecipients.toLocaleString(),
        icon: Users,
      },
    ];
  }, [campaignsQuery.data]);

  const totalCount = campaignsQuery.data?.length ?? 0;
  const draftCount = React.useMemo(
    () =>
      (campaignsQuery.data ?? []).filter(
        (campaign) => campaign.status === "draft",
      ).length,
    [campaignsQuery.data],
  );
  const hasActiveFilters =
    query.trim().length > 0 ||
    type !== "all" ||
    status !== "all" ||
    sort !== "newest" ||
    view !== "grid";

  const invalidateCampaigns = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm-campaign-catalog"] });
  }, [queryClient]);

  const handleNavigate = React.useCallback(
    (campaign: CampaignCatalogItem) => {
      if (isSentCampaign(campaign)) {
        navigate(`/crm/campaigns/${campaign.id}/report`);
        return;
      }

      navigate(`/crm/campaigns/${campaign.id}`);
    },
    [navigate],
  );

  const handleOpenRecipients = React.useCallback(
    (campaign: CampaignCatalogItem) => {
      navigate(`/crm/campaigns/${campaign.id}/recipients`);
    },
    [navigate],
  );

  const handleToggleStatus = React.useCallback(
    async (campaign: CampaignCatalogItem) => {
      await updateCampaignStatus(
        campaign.id,
        campaign.status === "paused" ? "scheduled" : "paused",
        {
          send_blocked_reason:
            campaign.status === "paused" ? null : "paused_by_user",
        },
      );
      await invalidateCampaigns();
    },
    [invalidateCampaigns],
  );

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    await deleteCampaignById(deleteTarget.id);
    setDeleteTarget(null);
    await invalidateCampaigns();
  }, [deleteTarget, invalidateCampaigns]);

  const handleDuplicate = React.useCallback(async () => {
    if (!duplicateTarget) {
      return;
    }

    const duplicatedId = await cloneCampaign(duplicateTarget.id, {
      newName: duplicateName.trim() || `${duplicateTarget.name} (Copy)`,
      clearScheduling: true,
    });

    setDuplicateTarget(null);
    setDuplicateName("");
    await invalidateCampaigns();

    if (duplicatedId) {
      navigate(`/crm/campaigns/${duplicatedId}`);
    }
  }, [
    cloneCampaign,
    duplicateName,
    duplicateTarget,
    invalidateCampaigns,
    navigate,
  ]);

  React.useEffect(() => {
    if (duplicateTarget) {
      setDuplicateName(`${duplicateTarget.name} (Copy)`);
    }
  }, [duplicateTarget]);

  const isLoading = campaignsQuery.isLoading;

  return (
    <PageContainer>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <JoyPageHeaderBand
          title="Campaigns"
          description="Build, schedule, and monitor email and SMS campaigns from one workflow."
          metadata={
            <>
              <JoyChip size="sm" variant="soft" color="neutral">
                {totalCount} total
              </JoyChip>
              <JoyChip size="sm" variant="soft" color="neutral">
                {draftCount} drafts
              </JoyChip>
            </>
          }
          actions={
            <>
              <JoyButton
                size="sm"
                variant="solid"
                color="primary"
                startDecorator={<Plus size={16} />}
                onClick={() => navigate("/crm/campaigns/new?type=email")}
              >
                New Email Campaign
              </JoyButton>
              <JoyButton
                size="sm"
                variant="outlined"
                color="neutral"
                startDecorator={<Plus size={16} />}
                onClick={() => navigate("/crm/campaigns/new?type=sms")}
              >
                New SMS Campaign
              </JoyButton>
            </>
          }
          sx={{
            px: 0,
            py: 0,
            borderRadius: 0,
            background: "transparent",
          }}
        />

        {isLoading ? (
          <StatsStripSkeleton />
        ) : (
          <CampaignStatsStrip items={stats} />
        )}

        <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 1.5 }}>
          <Stack
            direction="row"
            spacing={1.5}
            alignItems="center"
            useFlexGap
            flexWrap="wrap"
          >
            <JoyDebouncedInput
              size="sm"
              value={query}
              debounceMs={250}
              onDebouncedChange={(value) => updateParams({ q: value || null })}
              placeholder="Search campaigns..."
              startDecorator={<Search size={16} />}
              sx={{ minWidth: 200, flex: 1, maxWidth: 320 }}
            />

            <JoySelect
              size="sm"
              value={type}
              onValueChange={(value) => updateParams({ type: value || null })}
              options={TYPE_OPTIONS}
              formControlSx={{ width: "auto", minWidth: 120 }}
            />

            <JoySelect
              size="sm"
              value={status}
              onValueChange={(value) => updateParams({ status: value || null })}
              options={STATUS_OPTIONS}
              formControlSx={{ width: "auto", minWidth: 136 }}
            />

            <JoySelect
              size="sm"
              value={sort}
              onValueChange={(value) => updateParams({ sort: value || null })}
              options={SORT_OPTIONS}
              formControlSx={{ width: "auto", minWidth: 148 }}
            />

            <Box
              sx={{
                ml: { xs: 0, md: "auto" },
                width: { xs: "100%", md: "auto" },
                display: "flex",
                justifyContent: { xs: "flex-start", md: "flex-end" },
              }}
            >
              <ToggleButtonGroup
                size="sm"
                color="neutral"
                value={view}
                onChange={(_event, value) =>
                  value && updateParams({ view: value })
                }
              >
                <IconButton
                  value="grid"
                  variant="plain"
                  color="neutral"
                  size="sm"
                >
                  <LayoutGrid size={16} />
                </IconButton>
                <IconButton
                  value="table"
                  variant="plain"
                  color="neutral"
                  size="sm"
                >
                  <List size={16} />
                </IconButton>
              </ToggleButtonGroup>
            </Box>

            {hasActiveFilters ? (
              <JoyButton
                variant="plain"
                color="primary"
                size="sm"
                sx={{ minHeight: "auto", px: 0 }}
                onClick={() =>
                  setSearchParams(new URLSearchParams(), { replace: true })
                }
              >
                Clear filters
              </JoyButton>
            ) : null}
          </Stack>
        </Sheet>

        {isLoading ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gap: 2,
            }}
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <CampaignCardSkeleton key={index} />
            ))}
          </Box>
        ) : campaigns.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 10 }}>
            <Avatar
              color="neutral"
              variant="soft"
              sx={{ width: 56, height: 56 }}
            >
              <Mail size={24} />
            </Avatar>
            <Typography level="title-lg">Create your first campaign</Typography>
            <Typography level="body-sm" color="neutral" textAlign="center">
              Start with an email or SMS draft, then refine the audience and
              content in the editor.
            </Typography>
            <JoyButton
              onClick={() => navigate("/crm/campaigns/new?type=email")}
            >
              Create campaign
            </JoyButton>
          </Stack>
        ) : view === "grid" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gap: 2,
            }}
          >
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onNavigate={handleNavigate}
                onOpenRecipients={handleOpenRecipients}
                onOpenDelete={setDeleteTarget}
                onOpenDuplicate={setDuplicateTarget}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </Box>
        ) : (
          <Sheet
            variant="outlined"
            sx={{ borderRadius: "lg", overflow: "hidden" }}
          >
            <JoyTable>
              <JoyTableHead>
                <JoyTableRow>
                  <JoyTableHeaderCell sx={{ width: 40, px: 1.5 }}>
                    <Checkbox size="sm" />
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    sortable
                    sortDirection={getColumnSortDirection(sort, "campaign")}
                    onSort={() =>
                      updateParams({
                        sort: getNextSortOption(sort, "campaign"),
                      })
                    }
                    sx={{ width: "34%" }}
                  >
                    Campaign
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: 100 }}>
                    Status
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    align="right"
                    sortable
                    sortDirection={getColumnSortDirection(sort, "recipients")}
                    onSort={() =>
                      updateParams({
                        sort: getNextSortOption(sort, "recipients"),
                      })
                    }
                    sx={{ width: 90 }}
                  >
                    Recipients
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    align="right"
                    sortable
                    sortDirection={getColumnSortDirection(sort, "open-rate")}
                    onSort={() =>
                      updateParams({
                        sort: getNextSortOption(sort, "open-rate"),
                      })
                    }
                    sx={{ width: 90 }}
                  >
                    Open Rate
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    align="right"
                    sortable
                    sortDirection={getColumnSortDirection(sort, "click-rate")}
                    onSort={() =>
                      updateParams({
                        sort: getNextSortOption(sort, "click-rate"),
                      })
                    }
                    sx={{ width: 90 }}
                  >
                    Click Rate
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    sortable
                    sortDirection={getColumnSortDirection(sort, "date")}
                    onSort={() =>
                      updateParams({ sort: getNextSortOption(sort, "date") })
                    }
                    sx={{ width: 120 }}
                  >
                    Date
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    align="center"
                    sx={{ width: 48, px: 1.5 }}
                  >
                    Actions
                  </JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {campaigns.map((campaign) => {
                  const Icon = getCampaignIcon(campaign.channel);
                  const sentCampaign = isSentCampaign(campaign);

                  return (
                    <JoyTableRow
                      key={campaign.id}
                      clickable
                      onClick={() => handleNavigate(campaign)}
                    >
                      <JoyTableCell
                        sx={{ width: 40, px: 1.5, py: 1 }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Checkbox size="sm" />
                      </JoyTableCell>
                      <JoyTableCell sx={{ py: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{ minWidth: 0 }}
                        >
                          <Avatar color="neutral" variant="soft" size="sm">
                            <Icon size={16} />
                          </Avatar>
                          <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              level="body-sm"
                              sx={{
                                fontWeight: "var(--joy-fontWeight-md)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {campaign.name}
                            </Typography>
                            <Typography
                              level="body-xs"
                              sx={{
                                color: "neutral.500",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {getCampaignSubject(campaign)}
                            </Typography>
                          </Stack>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell sx={{ py: 1 }}>
                        <JoyStatusChip
                          size="sm"
                          status={campaign.status}
                          tone={getCampaignStatusTone(campaign)}
                          label={getCampaignStatusLabel(campaign)}
                        />
                      </JoyTableCell>
                      <JoyTableCell sx={{ py: 1, textAlign: "right" }}>
                        <Typography level="body-sm">
                          {campaign.totalRecipients.toLocaleString()}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell sx={{ py: 1, textAlign: "right" }}>
                        <Typography
                          level="body-sm"
                          sx={{
                            fontWeight:
                              campaign.openRate > 0
                                ? "var(--joy-fontWeight-md)"
                                : "var(--joy-fontWeight-regular)",
                          }}
                        >
                          {sentCampaign
                            ? `${campaign.openRate.toFixed(1)}%`
                            : "--"}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell sx={{ py: 1, textAlign: "right" }}>
                        <Typography level="body-sm">
                          {sentCampaign
                            ? `${campaign.clickRate.toFixed(1)}%`
                            : "--"}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell sx={{ py: 1 }}>
                        <Typography
                          level="body-xs"
                          sx={{ color: "neutral.500" }}
                        >
                          {getDisplayDate(campaign)}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell
                        sx={{ width: 48, px: 1.5, py: 1, textAlign: "center" }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <JoyDropdownMenu>
                          <JoyDropdownMenuTrigger
                            variant="plain"
                            color="neutral"
                            size="sm"
                          >
                            <MoreHorizontal size={16} />
                          </JoyDropdownMenuTrigger>
                          <JoyDropdownMenuContent>
                            <JoyDropdownMenuItem
                              onClick={() => handleNavigate(campaign)}
                              startDecorator={<BarChart3 size={16} />}
                            >
                              {sentCampaign
                                ? "Open report"
                                : "Continue editing"}
                            </JoyDropdownMenuItem>
                            {sentCampaign ? (
                              <JoyDropdownMenuItem
                                onClick={() => handleOpenRecipients(campaign)}
                                startDecorator={<Users size={16} />}
                              >
                                View recipients
                              </JoyDropdownMenuItem>
                            ) : null}
                            <JoyDropdownMenuItem
                              onClick={() => setDuplicateTarget(campaign)}
                              startDecorator={<Copy size={16} />}
                            >
                              Duplicate
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              onClick={() => void handleToggleStatus(campaign)}
                              startDecorator={
                                campaign.status === "paused" ? (
                                  <Play size={16} />
                                ) : (
                                  <Pause size={16} />
                                )
                              }
                            >
                              {campaign.status === "paused"
                                ? "Resume"
                                : "Pause"}
                            </JoyDropdownMenuItem>
                            <JoyDropdownMenuItem
                              destructive
                              onClick={() => setDeleteTarget(campaign)}
                              startDecorator={<Trash2 size={16} />}
                            >
                              Delete
                            </JoyDropdownMenuItem>
                          </JoyDropdownMenuContent>
                        </JoyDropdownMenu>
                      </JoyTableCell>
                    </JoyTableRow>
                  );
                })}
              </JoyTableBody>
            </JoyTable>
          </Sheet>
        )}
      </Stack>

      <JoyAlertDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete campaign"
        description={`Delete ${deleteTarget?.name ?? "this campaign"}? This action cannot be undone.`}
      />

      <JoyDialog
        open={Boolean(duplicateTarget)}
        onClose={() => setDuplicateTarget(null)}
        size="sm"
        title="Duplicate campaign"
        description="Create a copy of this campaign and open it in the editor."
      >
        <JoyDialogContent>
          <JoyInput
            label="New campaign name"
            onValueChange={setDuplicateName}
            value={duplicateName}
          />
        </JoyDialogContent>
        <JoyDialogActions>
          <JoyButton
            bloomVariant="ghost"
            color="neutral"
            onClick={() => setDuplicateTarget(null)}
          >
            Cancel
          </JoyButton>
          <JoyButton loading={isCloning} onClick={() => void handleDuplicate()}>
            Duplicate campaign
          </JoyButton>
        </JoyDialogActions>
      </JoyDialog>
    </PageContainer>
  );
}

export default CRMCampaignsPage;
