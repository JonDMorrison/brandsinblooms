import * as React from "react";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Clock3,
  Copy,
  Download,
  Edit3,
  FileText,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  TimerReset,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isTomorrow, isValid } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BloomChip } from "@/components/bloom/BloomChip";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
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
import { PageContainer } from "@/components/joy/PageContainer";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
  type JoyTableSortDirection,
} from "@/components/joy/JoyTable";
import {
  CAMPAIGN_STATUS,
  isCampaignStatus,
  isDeliveredCampaignStatus,
} from "@/constants/campaignStatuses";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteCampaignById,
  fetchCampaignCatalog,
  getCampaignDisplayRecipientCount,
  mapCampaignCatalogItem,
  updateCampaignStatus,
  type CampaignCatalogItem,
} from "@/lib/crm/campaignEditor";
import { retryFailedEmailMessages } from "@/lib/email/emailRetryService";
import { unscheduleCampaign } from "@/utils/crmCampaignService";
import { toast } from "@/utils/toast";

type StatusFilter =
  | "all"
  | "sending"
  | "scheduled"
  | "draft"
  | "sent"
  | "failed";
type SortColumn =
  | "campaign"
  | "status"
  | "recipients"
  | "date"
  | "open-rate"
  | "click-rate";
type SortDirection = "asc" | "desc";
type ConfirmAction =
  | { type: "delete"; campaign: CampaignCatalogItem }
  | { type: "pause"; campaign: CampaignCatalogItem }
  | { type: "resume"; campaign: CampaignCatalogItem }
  | { type: "unschedule"; campaign: CampaignCatalogItem }
  | { type: "retry"; campaign: CampaignCatalogItem };

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "sending", label: "Sending" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
];

const PAGE_SIZE = 100;

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getSendProgress(campaign: CampaignCatalogItem) {
  const total = Math.max(0, Number(campaign.totalRecipients || 0));
  if (total <= 0) return 0;
  return clampPercent((Number(campaign.messagesSent || 0) / total) * 100);
}

function getRecipientCountForList(campaign: CampaignCatalogItem) {
  return Math.max(0, Number(getCampaignDisplayRecipientCount(campaign) || 0));
}

function getProcessedCount(campaign: CampaignCatalogItem) {
  return (
    Number(campaign.messagesSent || 0) +
    Number(campaign.messagesFailed || 0) +
    Number(campaign.messagesSkipped || 0)
  );
}

function parseDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return isValid(date) ? date : null;
}

function getRelativeScheduleLabel(value: string | null | undefined) {
  const date = parseDate(value);
  if (!date) return "not scheduled";
  if (isTomorrow(date)) return `Tomorrow ${format(date, "h:mm a")}`;
  return formatDistanceToNow(date, { addSuffix: true }).replace("about ", "");
}

function getContextualDate(campaign: CampaignCatalogItem) {
  if (campaign.status === CAMPAIGN_STATUS.SCHEDULED) {
    return { label: "Scheduled", value: campaign.scheduledAt };
  }

  if (
    campaign.status === CAMPAIGN_STATUS.QUEUED ||
    campaign.status === CAMPAIGN_STATUS.PARTIALLY_QUEUED
  ) {
    return {
      label: "Queued",
      value: campaign.queuedAt || campaign.queueStartedAt,
    };
  }

  if (campaign.status === CAMPAIGN_STATUS.SENDING) {
    return {
      label: "Started",
      value: campaign.sendStartedAt || campaign.queuedAt,
    };
  }

  if (isDeliveredCampaignStatus(campaign.status)) {
    return {
      label: "Sent",
      value: campaign.sentAt || campaign.sendCompletedAt,
    };
  }

  if (campaign.status === CAMPAIGN_STATUS.FAILED) {
    return { label: "Failed", value: campaign.updatedAt };
  }

  return { label: "Updated", value: campaign.updatedAt || campaign.createdAt };
}

function formatContextualDate(campaign: CampaignCatalogItem) {
  const context = getContextualDate(campaign);
  const date = parseDate(context.value);
  if (!date) return { label: context.label, value: "-" };
  return { label: context.label, value: format(date, "MMM d, h:mm a") };
}

function getSortDate(campaign: CampaignCatalogItem) {
  return new Date(
    campaign.updatedAt ||
      campaign.workerHeartbeatAt ||
      campaign.sentAt ||
      campaign.queuedAt ||
      campaign.scheduledAt ||
      campaign.createdAt ||
      0,
  ).getTime();
}

function normalizeFilter(value: string | null): StatusFilter {
  switch (value) {
    case "sending":
    case "scheduled":
    case "draft":
    case "sent":
    case "failed":
      return value;
    default:
      return "all";
  }
}

function normalizeSortColumn(value: string | null): SortColumn {
  switch (value) {
    case "campaign":
    case "status":
    case "recipients":
    case "date":
    case "open-rate":
    case "click-rate":
      return value;
    default:
      return "date";
  }
}

function normalizeSortDirection(value: string | null): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

function getSortDirection(
  currentColumn: SortColumn,
  currentDirection: SortDirection,
  column: SortColumn,
): JoyTableSortDirection {
  return currentColumn === column ? currentDirection : "none";
}

function matchesStatusFilter(
  campaign: CampaignCatalogItem,
  filter: StatusFilter,
) {
  switch (filter) {
    case "all":
      return true;
    case "sending":
      return [
        CAMPAIGN_STATUS.QUEUED,
        CAMPAIGN_STATUS.PARTIALLY_QUEUED,
        CAMPAIGN_STATUS.SENDING,
        CAMPAIGN_STATUS.PAUSED,
      ].includes(campaign.status);
    case "scheduled":
      return campaign.status === CAMPAIGN_STATUS.SCHEDULED;
    case "draft":
      return campaign.status === CAMPAIGN_STATUS.DRAFT;
    case "sent":
      return isDeliveredCampaignStatus(campaign.status);
    case "failed":
      return campaign.status === CAMPAIGN_STATUS.FAILED;
  }
}

function StatusChip({
  campaign,
  compactOnNarrow = true,
}: {
  campaign: CampaignCatalogItem;
  compactOnNarrow?: boolean;
}) {
  const progress = Math.round(getSendProgress(campaign));
  let color: React.ComponentProps<typeof Chip>["color"] = "neutral";
  let label = "Draft";
  let icon: React.ReactNode = null;

  switch (campaign.status) {
    case CAMPAIGN_STATUS.DRAFT:
      label = "Draft - ready to edit";
      icon = <FileText size={13} />;
      break;
    case CAMPAIGN_STATUS.SCHEDULED:
      label = `Scheduled - ${getRelativeScheduleLabel(campaign.scheduledAt)}`;
      icon = <Clock3 size={13} />;
      break;
    case CAMPAIGN_STATUS.QUEUED:
      label = "Queued";
      icon = <TimerReset size={13} />;
      break;
    case CAMPAIGN_STATUS.PARTIALLY_QUEUED:
      label = "Queuing...";
      color = "warning";
      icon = (
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: "currentColor",
            animation: "campaign-status-pulse 1.1s ease-in-out infinite",
          }}
        />
      );
      break;
    case CAMPAIGN_STATUS.SENDING:
      label = `Sending - ${progress}%`;
      color = "primary";
      icon = <Send size={13} />;
      break;
    case CAMPAIGN_STATUS.PAUSED:
      label = "Paused";
      color = "warning";
      icon = <Pause size={13} />;
      break;
    case CAMPAIGN_STATUS.SENT:
      label = "Sent";
      color = "success";
      icon = <BarChart3 size={13} />;
      break;
    case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
      label = `Sent - ${Number(campaign.messagesFailed || 0).toLocaleString()} errors`;
      color = "warning";
      icon = <AlertCircle size={13} />;
      break;
    case CAMPAIGN_STATUS.FAILED:
      label = "Failed";
      color = "danger";
      icon = <XCircle size={13} />;
      break;
    default:
      label = isCampaignStatus(campaign.status) ? campaign.status : "Draft";
      icon = <FileText size={13} />;
  }

  const chip = (
    <Chip
      color={color}
      size="sm"
      variant="soft"
      startDecorator={icon}
      sx={{
        minHeight: 24,
        maxWidth: "100%",
        transition:
          "background-color 180ms ease, color 180ms ease, opacity 180ms ease",
        "@keyframes campaign-status-pulse": {
          "0%, 100%": { opacity: 0.35, transform: "scale(0.9)" },
          "50%": { opacity: 0.9, transform: "scale(1)" },
        },
      }}
    >
      <Box
        component="span"
        sx={{
          display: compactOnNarrow
            ? { xs: "inline", sm: "none", lg: "inline" }
            : "inline",
          whiteSpace: "nowrap",
          transition: "opacity 180ms ease",
        }}
      >
        {label}
      </Box>
    </Chip>
  );

  return compactOnNarrow ? <Tooltip title={label}>{chip}</Tooltip> : chip;
}

function ProgressMeter({ campaign }: { campaign: CampaignCatalogItem }) {
  if (campaign.status !== CAMPAIGN_STATUS.SENDING) return null;

  return (
    <Stack spacing={0.5} sx={{ mt: 0.75, maxWidth: 180 }}>
      <LinearProgress
        determinate
        color="primary"
        size="sm"
        value={getSendProgress(campaign)}
        variant="soft"
        sx={{
          height: 4,
          borderRadius: 999,
          transition: "opacity 180ms ease",
          "& .MuiLinearProgress-bar": { transition: "transform 400ms ease" },
        }}
      />
      <Typography level="body-xs" sx={{ color: "neutral.500" }}>
        {Number(campaign.messagesSent || 0).toLocaleString()} /{" "}
        {Number(campaign.totalRecipients || 0).toLocaleString()}
      </Typography>
    </Stack>
  );
}

function RateCell({
  value,
  count,
  active,
}: {
  value: number;
  count: number;
  active: boolean;
}) {
  const hasValue = active && (value > 0 || count > 0);
  const display = hasValue ? `${value.toFixed(1)}%` : "-";

  return (
    <Stack spacing={0.75} alignItems="flex-end">
      <Typography
        level="body-sm"
        sx={{
          fontWeight: hasValue ? "md" : "regular",
          color: hasValue ? "neutral.800" : "neutral.400",
        }}
      >
        {display}
      </Typography>
      <LinearProgress
        determinate
        color="neutral"
        size="sm"
        value={hasValue ? clampPercent(value) : 0}
        variant="soft"
        sx={{
          width: 72,
          height: 3,
          borderRadius: 999,
          opacity: hasValue ? 1 : 0.35,
          "& .MuiLinearProgress-bar": { transition: "transform 300ms ease" },
        }}
      />
    </Stack>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, index) => (
        <JoyTableRow key={index}>
          <JoyTableCell>
            <Skeleton animation="wave" variant="text" width="78%" />
          </JoyTableCell>
          <JoyTableCell>
            <Skeleton
              animation="wave"
              variant="rectangular"
              width={92}
              height={24}
              sx={{ borderRadius: "md" }}
            />
          </JoyTableCell>
          <JoyTableCell sx={{ textAlign: "right" }}>
            <Skeleton
              animation="wave"
              variant="text"
              width={52}
              sx={{ ml: "auto" }}
            />
          </JoyTableCell>
          <JoyTableCell>
            <Skeleton animation="wave" variant="text" width={110} />
          </JoyTableCell>
          <JoyTableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
            <Skeleton
              animation="wave"
              variant="text"
              width={72}
              sx={{ ml: "auto" }}
            />
          </JoyTableCell>
          <JoyTableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
            <Skeleton
              animation="wave"
              variant="text"
              width={72}
              sx={{ ml: "auto" }}
            />
          </JoyTableCell>
          <JoyTableCell sx={{ textAlign: "center" }}>
            <Skeleton
              animation="wave"
              variant="circular"
              width={28}
              height={28}
              sx={{ mx: "auto" }}
            />
          </JoyTableCell>
        </JoyTableRow>
      ))}
    </>
  );
}

export function CRMCampaignsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant, loading: tenantLoading } = useTenant();
  const { cloneCampaign, isCloning } = useCampaignCloning();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchDraft, setSearchDraft] = React.useState(
    searchParams.get("q") ?? "",
  );
  const [duplicateTarget, setDuplicateTarget] =
    React.useState<CampaignCatalogItem | null>(null);
  const [duplicateName, setDuplicateName] = React.useState("");
  const [confirmAction, setConfirmAction] =
    React.useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const query = searchParams.get("q") ?? "";
  const statusFilter = normalizeFilter(searchParams.get("status"));
  const sortColumn = normalizeSortColumn(searchParams.get("sort"));
  const sortDirection = normalizeSortDirection(searchParams.get("dir"));

  const queryKey = React.useMemo(
    () => ["crm-campaign-catalog", tenant?.id] as const,
    [tenant?.id],
  );

  const campaignsQuery = useQuery({
    queryKey,
    enabled: Boolean(tenant?.id),
    queryFn: async () => fetchCampaignCatalog(tenant!.id),
  });

  React.useEffect(() => {
    setSearchDraft(query);
  }, [query]);

  const updateParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (
          !value ||
          value === "all" ||
          (key === "sort" && value === "date") ||
          (key === "dir" && value === "desc")
        ) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next, { replace: true });
      setPage(1);
    },
    [searchParams, setSearchParams],
  );

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft !== query) {
        updateParams({ q: searchDraft.trim() || null });
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query, searchDraft, updateParams]);

  React.useEffect(() => {
    if (!tenant?.id) return undefined;

    const channel = supabase
      .channel(`crm-campaigns-list-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_campaigns",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          queryClient.setQueryData<CampaignCatalogItem[]>(
            queryKey,
            (current) => {
              if (!current) return current;

              if (payload.eventType === "DELETE") {
                const deletedId = (payload.old as { id?: string }).id;
                return deletedId
                  ? current.filter((campaign) => campaign.id !== deletedId)
                  : current;
              }

              const updated = mapCampaignCatalogItem(payload.new as any);
              const existing = current.some(
                (campaign) => campaign.id === updated.id,
              );
              return existing
                ? current.map((campaign) =>
                    campaign.id === updated.id ? updated : campaign,
                  )
                : [updated, ...current];
            },
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, queryKey, tenant?.id]);

  React.useEffect(() => {
    if (duplicateTarget) {
      setDuplicateName(`${duplicateTarget.name} (Copy)`);
    }
  }, [duplicateTarget]);

  const totalCount = campaignsQuery.data?.length ?? 0;
  const activeCount = React.useMemo(
    () =>
      (campaignsQuery.data ?? []).filter((campaign) =>
        matchesStatusFilter(campaign, "sending"),
      ).length,
    [campaignsQuery.data],
  );

  const filteredCampaigns = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = (campaignsQuery.data ?? []).filter((campaign) => {
      if (!matchesStatusFilter(campaign, statusFilter)) return false;
      if (!normalizedQuery) return true;
      return `${campaign.name} ${campaign.subjectLine}`
        .toLowerCase()
        .includes(normalizedQuery);
    });

    filtered.sort((left, right) => {
      let result = 0;
      switch (sortColumn) {
        case "campaign":
          result = left.name.localeCompare(right.name);
          break;
        case "status":
          result = left.status.localeCompare(right.status);
          break;
        case "recipients":
          result =
            getRecipientCountForList(left) - getRecipientCountForList(right);
          break;
        case "open-rate":
          result = left.openRate - right.openRate;
          break;
        case "click-rate":
          result = left.clickRate - right.clickRate;
          break;
        case "date":
        default:
          result = getSortDate(left) - getSortDate(right);
      }
      return sortDirection === "asc" ? result : -result;
    });

    return filtered;
  }, [campaignsQuery.data, query, sortColumn, sortDirection, statusFilter]);

  const paginatedCampaigns = React.useMemo(() => {
    if (filteredCampaigns.length <= PAGE_SIZE) return filteredCampaigns;
    const start = (page - 1) * PAGE_SIZE;
    return filteredCampaigns.slice(start, start + PAGE_SIZE);
  }, [filteredCampaigns, page]);

  const hasFilters = statusFilter !== "all" || query.trim().length > 0;
  const isLoading = tenantLoading || campaignsQuery.isLoading;
  const isEmptyCatalog =
    !isLoading && !campaignsQuery.isError && totalCount === 0;
  const isEmptyFiltered =
    !isLoading &&
    !campaignsQuery.isError &&
    totalCount > 0 &&
    filteredCampaigns.length === 0;

  const invalidateCampaigns = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["crm-campaign-catalog"] });
  }, [queryClient]);

  const setSort = React.useCallback(
    (column: SortColumn) => {
      const nextDirection =
        sortColumn === column && sortDirection === "desc" ? "asc" : "desc";
      updateParams({ sort: column, dir: nextDirection });
    },
    [sortColumn, sortDirection, updateParams],
  );

  const handleNavigate = React.useCallback(
    (campaign: CampaignCatalogItem) => {
      if (isDeliveredCampaignStatus(campaign.status)) {
        navigate(`/crm/campaigns/${campaign.id}/report`);
        return;
      }
      navigate(`/crm/campaigns/${campaign.id}`);
    },
    [navigate],
  );

  const handleDuplicate = React.useCallback(async () => {
    if (!duplicateTarget) return;

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

  const runConfirmedAction = React.useCallback(async () => {
    if (!confirmAction) return;

    setActionLoading(true);
    try {
      switch (confirmAction.type) {
        case "delete":
          await deleteCampaignById(confirmAction.campaign.id);
          toast.success("Campaign deleted");
          break;
        case "pause":
          await updateCampaignStatus(
            confirmAction.campaign.id,
            CAMPAIGN_STATUS.PAUSED,
            {
              send_blocked_reason: "paused_by_user",
            },
          );
          toast.success("Campaign paused");
          break;
        case "resume":
          await updateCampaignStatus(
            confirmAction.campaign.id,
            CAMPAIGN_STATUS.QUEUED,
            {
              send_blocked_reason: null,
              send_error: null,
            },
          );
          toast.success("Campaign resumed");
          break;
        case "unschedule": {
          const ok = await unscheduleCampaign(confirmAction.campaign.id, {
            silent: true,
          });
          if (!ok)
            throw new Error(
              "We couldn't remove the schedule. Please try again.",
            );
          toast.success("Campaign unscheduled");
          break;
        }
        case "retry": {
          const result = await retryFailedEmailMessages(
            confirmAction.campaign.id,
          );
          toast.success(
            `Retry queued for ${result.countReset.toLocaleString()} recipients`,
          );
          break;
        }
      }
      setConfirmAction(null);
      await invalidateCampaigns();
    } catch (error: any) {
      toast.error(error?.message || "Action failed");
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, invalidateCampaigns]);

  const clearFilters = React.useCallback(() => {
    setSearchDraft("");
    setSearchParams(new URLSearchParams(), { replace: true });
    setPage(1);
  }, [setSearchParams]);

  const renderActions = (campaign: CampaignCatalogItem) => {
    const item = (
      label: string,
      icon: React.ReactNode,
      onClick: () => void,
      destructive = false,
    ) => (
      <JoyDropdownMenuItem
        destructive={destructive}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        startDecorator={icon}
      >
        {label}
      </JoyDropdownMenuItem>
    );

    const duplicate = item("Duplicate", <Copy size={16} />, () =>
      setDuplicateTarget(campaign),
    );
    const deleteItem = item(
      "Delete",
      <Trash2 size={16} />,
      () => setConfirmAction({ type: "delete", campaign }),
      true,
    );
    const recipients = item("View Recipients", <Users size={16} />, () =>
      navigate(`/crm/campaigns/${campaign.id}/recipients`),
    );

    let items: React.ReactNode[];
    switch (campaign.status) {
      case CAMPAIGN_STATUS.DRAFT:
        items = [
          item("Edit", <Edit3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          duplicate,
          deleteItem,
        ];
        break;
      case CAMPAIGN_STATUS.SCHEDULED:
        items = [
          item("Edit", <Edit3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          item("Reschedule", <Clock3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          item("Unschedule", <TimerReset size={16} />, () =>
            setConfirmAction({ type: "unschedule", campaign }),
          ),
          duplicate,
          deleteItem,
        ];
        break;
      case CAMPAIGN_STATUS.QUEUED:
      case CAMPAIGN_STATUS.PARTIALLY_QUEUED:
      case CAMPAIGN_STATUS.SENDING:
        items = [
          item("View Progress", <BarChart3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}/report`),
          ),
          item("Pause", <Pause size={16} />, () =>
            setConfirmAction({ type: "pause", campaign }),
          ),
          recipients,
        ];
        break;
      case CAMPAIGN_STATUS.PAUSED:
        items = [
          item("Resume", <Play size={16} />, () =>
            setConfirmAction({ type: "resume", campaign }),
          ),
          recipients,
          duplicate,
        ];
        break;
      case CAMPAIGN_STATUS.SENT:
      case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
        items = [
          item("View Report", <BarChart3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}/report`),
          ),
          recipients,
          duplicate,
          item("Export", <Download size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}/recipients?export=1`),
          ),
        ];
        break;
      case CAMPAIGN_STATUS.FAILED:
      default:
        items = [
          item("Retry", <RotateCcw size={16} />, () =>
            setConfirmAction({ type: "retry", campaign }),
          ),
          item("View Details", <AlertCircle size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          duplicate,
          deleteItem,
        ];
    }

    return (
      <JoyDropdownMenu>
        <JoyDropdownMenuTrigger
          variant="plain"
          color="neutral"
          size="sm"
          iconButtonSx={{ borderRadius: "md" }}
        >
          <MoreHorizontal size={16} />
        </JoyDropdownMenuTrigger>
        <JoyDropdownMenuContent>
          {items.map((node, index) => (
            <React.Fragment key={index}>{node}</React.Fragment>
          ))}
        </JoyDropdownMenuContent>
      </JoyDropdownMenu>
    );
  };

  const confirmDialogConfig = React.useMemo(() => {
    if (!confirmAction) return null;
    switch (confirmAction.type) {
      case "delete":
        return {
          title: "Delete campaign",
          description: `Delete ${confirmAction.campaign.name}? This action cannot be undone.`,
          confirmLabel: "Delete",
          variant: "danger" as const,
        };
      case "pause":
        return {
          title: "Pause campaign",
          description: `Pause ${confirmAction.campaign.name}? Pending queue work will stop until it is resumed.`,
          confirmLabel: "Pause",
          variant: "warning" as const,
        };
      case "resume":
        return {
          title: "Resume campaign",
          description: `Resume ${confirmAction.campaign.name}? Queued work will continue on the next worker run.`,
          confirmLabel: "Resume",
          variant: "warning" as const,
        };
      case "unschedule":
        return {
          title: "Unschedule campaign",
          description: `Return ${confirmAction.campaign.name} to draft?`,
          confirmLabel: "Unschedule",
          variant: "warning" as const,
        };
      case "retry":
        return {
          title: "Retry failed recipients",
          description: `Queue retries for failed recipients in ${confirmAction.campaign.name}?`,
          confirmLabel: "Retry",
          variant: "warning" as const,
        };
    }
  }, [confirmAction]);

  return (
    <PageContainer fullWidth>
      <Sheet
        variant="plain"
        sx={{
          minHeight: "calc(100vh - 96px)",
          bgcolor: "background.body",
          color: "neutral.900",
          pb: 4,
        }}
      >
        <Stack spacing={2.5}>
          <Sheet variant="plain" sx={{ bgcolor: "transparent" }}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              spacing={2}
              alignItems={{ xs: "stretch", md: "flex-end" }}
            >
              <Stack spacing={0.75}>
                <Typography level="h2" sx={{ letterSpacing: 0 }}>
                  Campaigns
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  {totalCount.toLocaleString()} campaigns -{" "}
                  {activeCount.toLocaleString()} active sends
                </Typography>
              </Stack>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent={{ xs: "flex-start", md: "flex-end" }}
                useFlexGap
                flexWrap="wrap"
              >
                <BloomChip
                  label="Campaign insights"
                  prompt="Show me how my campaigns performed this month and suggest improvements"
                />
                <Button
                  color="neutral"
                  variant="solid"
                  startDecorator={<Plus size={16} />}
                  onClick={() => navigate("/crm/campaigns/new?type=email")}
                  sx={{ alignSelf: { xs: "flex-start", md: "auto" } }}
                >
                  New Campaign
                </Button>
              </Stack>
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ borderRadius: "md", p: 1.25 }}>
            <Stack
              direction={{ xs: "column", lg: "row" }}
              spacing={1.25}
              alignItems={{ xs: "stretch", lg: "center" }}
              sx={{ width: "100%" }}
            >
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  minWidth: { xs: 0, lg: 320 },
                  flex: { lg: 1 },
                  maxWidth: { lg: 420 },
                }}
              >
                <Input
                  size="sm"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  placeholder="Search campaigns"
                  startDecorator={<Search size={16} />}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                {hasFilters ? (
                  <Button
                    variant="plain"
                    color="neutral"
                    size="sm"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </Stack>
              <Stack
                direction="row"
                spacing={0.75}
                useFlexGap
                flexWrap="wrap"
                sx={{
                  ml: "auto",
                  justifyContent: { lg: "flex-end" },
                  flexShrink: 0,
                }}
              >
                {FILTERS.map((filter) => (
                  <Chip
                    key={filter.value}
                    size="sm"
                    color="neutral"
                    variant={
                      statusFilter === filter.value ? "solid" : "outlined"
                    }
                    onClick={() => updateParams({ status: filter.value })}
                    sx={{ borderRadius: "md" }}
                  >
                    {filter.label}
                  </Chip>
                ))}
              </Stack>
            </Stack>
          </Sheet>

          <Sheet
            variant="outlined"
            sx={{ borderRadius: "md", overflow: "hidden" }}
          >
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <JoyTable>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "campaign",
                      )}
                      onSort={() => setSort("campaign")}
                      sx={{ width: "34%" }}
                    >
                      Campaign name
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "status",
                      )}
                      onSort={() => setSort("status")}
                      sx={{ width: 170 }}
                    >
                      Status
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      align="right"
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "recipients",
                      )}
                      onSort={() => setSort("recipients")}
                      sx={{ width: 110 }}
                    >
                      Recipients
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "date",
                      )}
                      onSort={() => setSort("date")}
                      sx={{ width: 150 }}
                    >
                      Date
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      align="right"
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "open-rate",
                      )}
                      onSort={() => setSort("open-rate")}
                      sx={{
                        width: 120,
                        display: { xs: "none", lg: "table-cell" },
                      }}
                    >
                      Open rate
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      align="right"
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "click-rate",
                      )}
                      onSort={() => setSort("click-rate")}
                      sx={{
                        width: 120,
                        display: { xs: "none", lg: "table-cell" },
                      }}
                    >
                      Click rate
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell align="center" sx={{ width: 56 }}>
                      Actions
                    </JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {isLoading ? <SkeletonRows /> : null}
                  {campaignsQuery.isError ? (
                    <JoyTableRow>
                      <JoyTableCell colSpan={7}>
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{ borderRadius: "md", p: 4, textAlign: "center" }}
                        >
                          <Typography level="title-md">
                            Couldn't load campaigns.
                          </Typography>
                          <Button
                            variant="plain"
                            color="neutral"
                            size="sm"
                            onClick={() => void campaignsQuery.refetch()}
                            sx={{ mt: 1 }}
                          >
                            Retry
                          </Button>
                        </Sheet>
                      </JoyTableCell>
                    </JoyTableRow>
                  ) : null}
                  {isEmptyCatalog ? (
                    <JoyTableRow>
                      <JoyTableCell colSpan={7}>
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{
                            borderRadius: "md",
                            py: 8,
                            px: 3,
                            textAlign: "center",
                          }}
                        >
                          <Typography level="h3">No campaigns yet</Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "neutral.500", mt: 0.75 }}
                          >
                            Create your first email campaign to start reaching
                            your customers.
                          </Typography>
                          <Button
                            color="neutral"
                            variant="solid"
                            sx={{ mt: 2 }}
                            onClick={() =>
                              navigate("/crm/campaigns/new?type=email")
                            }
                          >
                            Create Campaign
                          </Button>
                        </Sheet>
                      </JoyTableCell>
                    </JoyTableRow>
                  ) : null}
                  {isEmptyFiltered ? (
                    <JoyTableRow>
                      <JoyTableCell colSpan={7}>
                        <Sheet
                          variant="soft"
                          color="neutral"
                          sx={{ borderRadius: "md", p: 4, textAlign: "center" }}
                        >
                          <Typography level="title-md">
                            No campaigns match your filters.
                          </Typography>
                          <Button
                            variant="plain"
                            color="neutral"
                            size="sm"
                            onClick={clearFilters}
                            sx={{ mt: 1 }}
                          >
                            Clear filters
                          </Button>
                        </Sheet>
                      </JoyTableCell>
                    </JoyTableRow>
                  ) : null}
                  {!isLoading && !campaignsQuery.isError
                    ? paginatedCampaigns.map((campaign) => {
                        const date = formatContextualDate(campaign);
                        const terminal = isDeliveredCampaignStatus(
                          campaign.status,
                        );
                        return (
                          <JoyTableRow
                            key={campaign.id}
                            clickable
                            onClick={() => handleNavigate(campaign)}
                            sx={{
                              "& > td": {
                                transition: "background-color 140ms ease",
                              },
                            }}
                          >
                            <JoyTableCell sx={{ minWidth: 260 }}>
                              <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                                <Typography
                                  level="body-sm"
                                  sx={{
                                    fontWeight: "lg",
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
                                  {campaign.subjectLine ||
                                    campaign.preheaderText ||
                                    "No subject yet"}
                                </Typography>
                              </Stack>
                            </JoyTableCell>
                            <JoyTableCell>
                              <StatusChip campaign={campaign} />
                              <ProgressMeter campaign={campaign} />
                            </JoyTableCell>
                            <JoyTableCell sx={{ textAlign: "right" }}>
                              <Typography
                                level="body-sm"
                                sx={{ fontWeight: "md" }}
                              >
                                {getRecipientCountForList(
                                  campaign,
                                ).toLocaleString()}
                              </Typography>
                              {campaign.status === CAMPAIGN_STATUS.SENDING ? (
                                <Typography
                                  level="body-xs"
                                  sx={{ color: "neutral.500" }}
                                >
                                  {getProcessedCount(campaign).toLocaleString()}{" "}
                                  processed
                                </Typography>
                              ) : null}
                            </JoyTableCell>
                            <JoyTableCell>
                              <Typography
                                level="body-sm"
                                sx={{ fontWeight: "md" }}
                              >
                                {date.value}
                              </Typography>
                              <Typography
                                level="body-xs"
                                sx={{ color: "neutral.500" }}
                              >
                                {date.label}
                              </Typography>
                            </JoyTableCell>
                            <JoyTableCell
                              sx={{
                                textAlign: "right",
                                display: { xs: "none", lg: "table-cell" },
                              }}
                            >
                              <RateCell
                                value={campaign.openRate}
                                count={campaign.totalOpens}
                                active={terminal}
                              />
                            </JoyTableCell>
                            <JoyTableCell
                              sx={{
                                textAlign: "right",
                                display: { xs: "none", lg: "table-cell" },
                              }}
                            >
                              <RateCell
                                value={campaign.clickRate}
                                count={campaign.totalClicks}
                                active={terminal}
                              />
                            </JoyTableCell>
                            <JoyTableCell
                              sx={{ textAlign: "center" }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {renderActions(campaign)}
                            </JoyTableCell>
                          </JoyTableRow>
                        );
                      })
                    : null}
                </JoyTableBody>
              </JoyTable>
            </Box>

            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              {isLoading
                ? Array.from({ length: 8 }).map((_, index) => (
                    <Box
                      key={index}
                      sx={{
                        p: 1.5,
                        borderBottom: "1px solid",
                        borderColor: "neutral.100",
                      }}
                    >
                      <Skeleton variant="text" width="72%" animation="wave" />
                      <Skeleton variant="text" width="44%" animation="wave" />
                    </Box>
                  ))
                : null}
              {!isLoading && !campaignsQuery.isError
                ? paginatedCampaigns.map((campaign) => {
                    const date = formatContextualDate(campaign);
                    return (
                      <Box
                        key={campaign.id}
                        onClick={() => handleNavigate(campaign)}
                        sx={{
                          p: 1.5,
                          borderBottom: "1px solid",
                          borderColor: "neutral.100",
                          cursor: "pointer",
                        }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="space-between"
                          alignItems="flex-start"
                        >
                          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                            <Typography
                              level="title-sm"
                              sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {campaign.name}
                            </Typography>
                            <StatusChip
                              campaign={campaign}
                              compactOnNarrow={false}
                            />
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.500" }}
                            >
                              {date.label} - {date.value}
                            </Typography>
                          </Stack>
                          <Box onClick={(event) => event.stopPropagation()}>
                            {renderActions(campaign)}
                          </Box>
                        </Stack>
                        <ProgressMeter campaign={campaign} />
                      </Box>
                    );
                  })
                : null}
              {campaignsQuery.isError ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ m: 1.5, borderRadius: "md", p: 3, textAlign: "center" }}
                >
                  <Typography level="title-md">
                    Couldn't load campaigns.
                  </Typography>
                  <Button
                    variant="plain"
                    color="neutral"
                    size="sm"
                    onClick={() => void campaignsQuery.refetch()}
                    sx={{ mt: 1 }}
                  >
                    Retry
                  </Button>
                </Sheet>
              ) : null}
              {isEmptyCatalog ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ m: 1.5, borderRadius: "md", p: 4, textAlign: "center" }}
                >
                  <Typography level="h3">No campaigns yet</Typography>
                  <Typography
                    level="body-sm"
                    sx={{ color: "neutral.500", mt: 0.75 }}
                  >
                    Create your first email campaign to start reaching your
                    customers.
                  </Typography>
                  <Button
                    color="neutral"
                    variant="solid"
                    sx={{ mt: 2 }}
                    onClick={() => navigate("/crm/campaigns/new?type=email")}
                  >
                    Create Campaign
                  </Button>
                </Sheet>
              ) : null}
              {isEmptyFiltered ? (
                <Sheet
                  variant="soft"
                  color="neutral"
                  sx={{ m: 1.5, borderRadius: "md", p: 3, textAlign: "center" }}
                >
                  <Typography level="title-md">
                    No campaigns match your filters.
                  </Typography>
                  <Button
                    variant="plain"
                    color="neutral"
                    size="sm"
                    onClick={clearFilters}
                    sx={{ mt: 1 }}
                  >
                    Clear filters
                  </Button>
                </Sheet>
              ) : null}
            </Box>

            {filteredCampaigns.length > PAGE_SIZE ? (
              <>
                <Divider />
                <JoyTablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  totalCount={filteredCampaigns.length}
                  onPageChange={setPage}
                  pageSizeOptions={[100]}
                  showPageSizeSelector={false}
                  sx={{ px: 2, py: 2 }}
                />
              </>
            ) : null}
          </Sheet>
        </Stack>
      </Sheet>

      {confirmDialogConfig ? (
        <JoyAlertDialog
          open={Boolean(confirmAction)}
          onClose={() => setConfirmAction(null)}
          onConfirm={runConfirmedAction}
          title={confirmDialogConfig.title}
          description={confirmDialogConfig.description}
          confirmLabel={confirmDialogConfig.confirmLabel}
          variant={confirmDialogConfig.variant}
          loading={actionLoading}
        />
      ) : null}

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
