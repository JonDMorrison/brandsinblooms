import { useUserRole } from "@/hooks/useUserRole";
import { deriveCampaignDisplayName, isUnsetCampaignName } from "@/lib/crm/campaignDisplayName";
import { CampaignOrganization } from "@/components/crm/campaigns/CampaignOrganization";
import { CampaignCardGrid } from "@/components/crm/campaigns/CampaignCardGrid";
import { ThisWeekThemeStrip } from "@/components/crm/campaigns/ThisWeekThemeStrip";
import { campaignReadiness, partitionEmptyDrafts, visibleColumnsForFilter } from "@/lib/crm/campaignCardModel";
import { useCampaignOrganization, campaignOrganizationClient } from "@/lib/crm/campaignOrganization";
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
  CheckCircle,
  Copy,
  Download,
  Edit3,
  FileText,
  LayoutGrid,
  List,
  MoreHorizontal,
  Palette,
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
  type CampaignStatus,
} from "@/constants/campaignStatuses";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import { useEmailCampaignStats } from "@/hooks/analytics/useEmailCampaignStats";
import {
  ESTIMATED_STATS_EXPLANATION,
  ESTIMATED_STATS_LABEL,
  type CampaignStats,
} from "@/lib/crm/campaignStats";
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
type ChannelFilter = "all" | "email" | "sms";
type SortColumn =
  | "campaign"
  | "type"
  | "scheduled-date"
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
  { value: "draft", label: "Drafts" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All campaigns" },
];

// "Newsletter" and "Email" are the same thing: every newsletter built today
// is saved as an email campaign; "newsletter" only marks a few older synced
// rows. They are merged into one "Email" type.
const CHANNEL_FILTERS: Array<{ value: ChannelFilter; label: string }> = [
  { value: "all", label: "All types" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
];

const CHANNEL_LABELS: Record<CampaignCatalogItem["channel"], string> = {
  email: "Email",
  newsletter: "Email",
  sms: "SMS",
};

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

const LOW_RECIPIENT_REVIEW_STATUSES: ReadonlySet<CampaignStatus> = new Set([
  CAMPAIGN_STATUS.DRAFT,
  CAMPAIGN_STATUS.SCHEDULED,
]);

function shouldShowLowRecipientWarning(campaign: CampaignCatalogItem) {
  if (!isCampaignStatus(campaign.status)) {
    return false;
  }
  if (!LOW_RECIPIENT_REVIEW_STATUSES.has(campaign.status as CampaignStatus)) {
    return false;
  }
  return getRecipientCountForList(campaign) <= 1;
}

/**
 * Sent email campaigns show the shared rollup (src/lib/crm/campaignStats.ts)
 * instead of the stored crm_campaigns columns, so the list matches the
 * report, the dashboard and Reports > Overview.
 */
function applyCampaignStats(
  campaign: CampaignCatalogItem,
  stats: CampaignStats | undefined,
): CampaignCatalogItem {
  if (!stats) return campaign;
  return {
    ...campaign,
    totalRecipients: stats.recipients,
    totalOpens: stats.opens,
    totalClicks: stats.clicks,
    openRate: stats.openRate,
    clickRate: stats.clickRate,
  };
}

/** The shared display name (drafts: "Draft, <date>"; others: "Campaign, <date>"). */
function getCampaignListName(campaign: CampaignCatalogItem) {
  return deriveCampaignDisplayName({
    name: campaign.name,
    subjectLine: campaign.subjectLine,
    firstHeadline: campaign.firstHeadline,
    date: campaign.createdAt,
    status: campaign.status,
    sentAt: campaign.sentAt ?? campaign.sendCompletedAt,
    scheduledAt: campaign.scheduledAt,
  });
}

function usesSharedStats(campaign: CampaignCatalogItem) {
  return isDeliveredCampaignStatus(campaign.status) && campaign.channel !== "sms";
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

/**
 * The Date column sorts by the date it shows (getContextualDate: sent,
 * scheduled, queued, started, failed or updated), so the order always
 * matches what the reader sees on every status tab. Rows without a shown
 * date ("-") have no sort date.
 */
function getSortDate(campaign: CampaignCatalogItem): number | null {
  return parseDate(getContextualDate(campaign).value)?.getTime() ?? null;
}

/** Compares shown dates ascending; rows without a date always sort last. */
export function compareShownDates(
  left: CampaignCatalogItem,
  right: CampaignCatalogItem,
  direction: SortDirection,
) {
  const a = getSortDate(left);
  const b = getSortDate(right);
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

export function normalizeFilter(value: string | null): StatusFilter {
  switch (value) {
    case "all":
    case "sending":
    case "scheduled":
    case "draft":
    case "sent":
    case "failed":
      return value;
    default:
      return "draft";
  }
}

export function normalizeChannelFilter(value: string | null): ChannelFilter {
  if (value === "newsletter") return "email";
  return value === "email" || value === "sms" ? value : "all";
}

/** Older "newsletter" rows count as email. */
function matchesChannelFilter(channel: CampaignCatalogItem["channel"], filter: ChannelFilter) {
  if (filter === "all") return true;
  return filter === "email" ? channel === "email" || channel === "newsletter" : channel === filter;
}

function normalizeSortColumn(value: string | null): SortColumn {
  switch (value) {
    case "campaign":
    case "type":
    case "scheduled-date":
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

const ACTIVELY_SENDING_STATUSES: ReadonlyArray<CampaignCatalogItem["status"]> = [
  CAMPAIGN_STATUS.QUEUED,
  CAMPAIGN_STATUS.PARTIALLY_QUEUED,
  CAMPAIGN_STATUS.SENDING,
];

function isActivelySendingStatus(status: CampaignCatalogItem["status"]) {
  return ACTIVELY_SENDING_STATUSES.includes(status);
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

export function StatusChip({
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
      label = campaign.isEmptyDraft ? "Empty draft" : "Draft - ready to edit";
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
      icon = <CheckCircle size={13} />;
      break;
    case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
      // Sending is complete; recipient errors remain in the campaign report.
      label = Number(campaign.messagesSent || 0) > 0 ? "Sent" : "Failed";
      color = Number(campaign.messagesSent || 0) > 0 ? "success" : "danger";
      icon = Number(campaign.messagesSent || 0) > 0
        ? <CheckCircle size={13} />
        : <XCircle size={13} />;
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
  pending = false,
}: {
  value: number;
  count: number;
  active: boolean;
  pending?: boolean;
}) {
  if (active && pending) {
    return (
      <Stack spacing={0.75} alignItems="flex-end">
        <Skeleton animation="wave" variant="text" width={40} />
      </Stack>
    );
  }
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
          <JoyTableCell>
            <Skeleton animation="wave" variant="text" width={62} />
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
            <Skeleton animation="wave" variant="text" width={108} />
          </JoyTableCell>
          <JoyTableCell>
            <Skeleton animation="wave" variant="text" width={110} />
          </JoyTableCell>
          <JoyTableCell sx={{ display: { xs: "none", xl: "table-cell" } }}>
            <Skeleton
              animation="wave"
              variant="text"
              width={72}
              sx={{ ml: "auto" }}
            />
          </JoyTableCell>
          <JoyTableCell sx={{ display: { xs: "none", xl: "table-cell" } }}>
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
  const [organizationTarget, setOrganizationTarget] = React.useState<string | null>(null);
  const organization = useCampaignOrganization(tenant?.id);
  const groupFilter = searchParams.get("group") ?? "all";
  const {hasPermission} = useUserRole();
  const [quickEdit,setQuickEdit] = React.useState<{campaign:CampaignCatalogItem;field:"name"|"subject_line";value:string}|null>(null);
  const [quickSaving,setQuickSaving] = React.useState(false);
  const saveQuickEdit = async () => {
    if (!quickEdit || !tenant?.id || !hasPermission("campaigns.write")) return;
    setQuickSaving(true);
    try {
      let update = supabase.from("crm_campaigns").update({[quickEdit.field]:quickEdit.value.trim()}).eq("tenant_id",tenant.id).eq("id",quickEdit.campaign.id).eq("status","draft");
      if (quickEdit.campaign.updatedAt) update=update.eq("updated_at",quickEdit.campaign.updatedAt);
      const {data,error} = await update.select("id");
      if(error) throw error;
      if(!data?.length) throw new Error("This campaign changed or is locked. Open it to review the latest version.");
      await queryClient.invalidateQueries({queryKey:["crm-campaign-catalog",tenant.id]});
      setQuickEdit(null);
    } catch(error) { toast.error(error instanceof Error ? error.message : "Could not save this change."); }
    finally {setQuickSaving(false);}
  };
  const editCell = (campaign:CampaignCatalogItem,field:"name"|"subject_line") => {
    if(campaign.status === CAMPAIGN_STATUS.DRAFT && hasPermission("campaigns.write")) setQuickEdit({campaign,field,value:field === "name" ? campaign.name : campaign.subjectLine});
    else handleNavigate(campaign);
  };

  const [rescheduleTarget,setRescheduleTarget] = React.useState<CampaignCatalogItem|null>(null);
  const [rescheduleValue,setRescheduleValue] = React.useState("");
  const [rescheduling,setRescheduling] = React.useState(false);
  const openSchedule = (campaign:CampaignCatalogItem) => {
    if(campaign.status !== CAMPAIGN_STATUS.SCHEDULED) {navigate(`/crm/campaigns/${campaign.id}?section=actions&action=schedule`);return;}
    const date=new Date(campaign.scheduledAt ?? Date.now());
    setRescheduleValue(new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16));
    setRescheduleTarget(campaign);
  };
  const reschedule = async () => {
    if(!rescheduleTarget?.updatedAt || !hasPermission("campaigns.send")) return;
    const date=new Date(rescheduleValue);
    if(!Number.isFinite(date.getTime()) || date.getTime()<=Date.now()){toast.error("Choose a future send time.");return;}
    setRescheduling(true);
    try {
      const {error}=await campaignOrganizationClient.rpc("reschedule_campaign",{p_campaign_id:rescheduleTarget.id,p_expected_updated_at:rescheduleTarget.updatedAt,p_scheduled_at:date.toISOString()});
      if(error)throw error;
      await queryClient.invalidateQueries({queryKey:["crm-campaign-catalog",tenant?.id]});
      setRescheduleTarget(null);toast.success("Send time updated");
    }catch(error){toast.error(error instanceof Error ? error.message : "Could not change the send time. Refresh and try again.");}
    finally{setRescheduling(false);}
  };

  const query = searchParams.get("q") ?? "";
  const statusFilter = normalizeFilter(searchParams.get("status"));
  const viewMode: "cards" | "table" = searchParams.get("view") === "table" ? "table" : "cards";
  const tableColumns = visibleColumnsForFilter(statusFilter);
  const [showEmptyDrafts, setShowEmptyDrafts] = React.useState(false);
  const [confirmClearEmpty, setConfirmClearEmpty] = React.useState(false);
  const [clearingEmpty, setClearingEmpty] = React.useState(false);
  const channelFilter = normalizeChannelFilter(searchParams.get("type"));
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
    // Studio is a separate route: its saves happen while this subscription is
    // unmounted. Do not reuse the global five-minute cache on returning here.
    staleTime: 0,
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
          (key === "status" && value === "draft") ||
          (key === "type" && value === "all") ||
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

              const updated = mapCampaignCatalogItem(payload.new as Parameters<typeof mapCampaignCatalogItem>[0]);
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

  const sharedStatsIds = React.useMemo(
    () => (campaignsQuery.data ?? []).filter(usesSharedStats).map((campaign) => campaign.id),
    [campaignsQuery.data],
  );
  const campaignStats = useEmailCampaignStats(sharedStatsIds);
  const catalog = React.useMemo(
    () => (campaignsQuery.data ?? []).map((campaign) =>
      applyCampaignStats(campaign, campaignStats.stats.get(campaign.id))),
    [campaignsQuery.data, campaignStats.stats],
  );

  const totalCount = campaignsQuery.data?.length ?? 0;
  // "Active sends": campaigns actually going out. A paused campaign is not
  // sending, so it is not counted (it still shows under the Sending filter).
  const activeCount = React.useMemo(
    () =>
      (campaignsQuery.data ?? []).filter((campaign) =>
        isActivelySendingStatus(campaign.status),
      ).length,
    [campaignsQuery.data],
  );

  const filteredCampaigns = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = catalog.filter((campaign) => {
      if (!matchesStatusFilter(campaign, statusFilter)) return false;
      if (groupFilter !== "all" && !organization.data?.memberships.some(m => m.campaign_id === campaign.id && m.group_id === groupFilter)) return false;
      if (!matchesChannelFilter(campaign.channel, channelFilter)) return false;
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
        case "type":
          result = left.channel.localeCompare(right.channel);
          break;
        case "scheduled-date":
          result = (parseDate(left.scheduledAt)?.getTime() ?? 0) -
            (parseDate(right.scheduledAt)?.getTime() ?? 0);
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
          // Already in the shown direction (and keeps undated rows last).
          return compareShownDates(left, right, sortDirection);
      }
      return sortDirection === "asc" ? result : -result;
    });

    return filtered;
  }, [catalog, query, sortColumn, sortDirection, statusFilter, channelFilter, groupFilter, organization.data]);

  // Empty drafts (no content, no subject) carry no work. They stay out of the
  // list unless someone asks to see them.
  const { visible: nonEmptyCampaigns, empty: emptyDrafts } = React.useMemo(
    () => partitionEmptyDrafts(filteredCampaigns),
    [filteredCampaigns],
  );
  const listCampaigns = showEmptyDrafts ? filteredCampaigns : nonEmptyCampaigns;

  const paginatedCampaigns = React.useMemo(() => {
    if (listCampaigns.length <= PAGE_SIZE) return listCampaigns;
    const start = (page - 1) * PAGE_SIZE;
    return listCampaigns.slice(start, start + PAGE_SIZE);
  }, [listCampaigns, page]);

  const hasFilters = groupFilter !== "all" || statusFilter !== "draft" || channelFilter !== "all" || query.trim().length > 0;
  const isLoading = tenantLoading || campaignsQuery.isLoading;
  const isEmptyCatalog =
    !isLoading && !campaignsQuery.isError && totalCount === 0;
  const isEmptyFiltered =
    !isLoading &&
    !campaignsQuery.isError &&
    totalCount > 0 &&
    listCampaigns.length === 0;

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
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action failed");
    } finally {
      setActionLoading(false);
    }
  }, [confirmAction, invalidateCampaigns]);

  const clearEmptyDrafts = React.useCallback(async () => {
    setClearingEmpty(true);
    try {
      // Only drafts with no content and no subject; anything else is skipped.
      const targets = emptyDrafts.filter(
        (campaign) => campaign.isEmptyDraft && campaign.status === CAMPAIGN_STATUS.DRAFT,
      );
      for (const campaign of targets) {
        await deleteCampaignById(campaign.id);
      }
      toast.success(
        `${targets.length} empty ${targets.length === 1 ? "draft" : "drafts"} deleted`,
      );
      setConfirmClearEmpty(false);
      setShowEmptyDrafts(false);
      await invalidateCampaigns();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the empty drafts");
    } finally {
      setClearingEmpty(false);
    }
  }, [emptyDrafts, invalidateCampaigns]);

  const clearFilters = React.useCallback(() => {
    setSearchDraft("");
    setSearchParams(new URLSearchParams({ status: "all" }), { replace: true });
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
    const designer = campaign.channel !== "sms"
      ? item("Open designer", <Palette size={16} />, () =>
          navigate(`/crm/campaigns/${campaign.id}/studio`),
        )
      : null;

    let items: React.ReactNode[];
    switch (campaign.status) {
      case CAMPAIGN_STATUS.DRAFT: {
        // Offer Send/Schedule only when the draft can be sent. Otherwise offer
        // the step that is missing, the same one the card footer names.
        const readiness = campaignReadiness(campaign);
        const missing = readiness.steps.find((step) => !step.done)?.key;
        const finishTarget =
          missing === "content"
            ? campaign.channel === "sms"
              ? `/crm/campaigns/${campaign.id}`
              : `/crm/campaigns/${campaign.id}/studio`
            : missing === "subject"
              ? `/crm/campaigns/${campaign.id}?step=review&section=inbox`
              : `/crm/campaigns/${campaign.id}?step=review&section=audience`;
        items = [
          designer,
          ...(readiness.ready
            ? [
                item("Send now", <Send size={16} />, () => navigate(`/crm/campaigns/${campaign.id}?step=review&section=actions&action=send`)),
                item("Schedule send", <Clock3 size={16} />, () => navigate(`/crm/campaigns/${campaign.id}?step=review&section=actions&action=schedule`)),
              ]
            : [item(readiness.nextStep ?? "Finish setup", <Send size={16} />, () => navigate(finishTarget))]),
          item("Edit", <Edit3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          duplicate,
          deleteItem,
        ];
        break;
      }
      case CAMPAIGN_STATUS.SCHEDULED:
        items = [
          designer,
          item("Edit", <Edit3 size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          item("Reschedule", <Clock3 size={16} />, () => openSchedule(campaign)),
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
          item("Results", <BarChart3 size={16} />, () =>
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
          item("View Details", <AlertCircle size={16} />, () =>
            navigate(`/crm/campaigns/${campaign.id}`),
          ),
          item("Retry", <RotateCcw size={16} />, () =>
            setConfirmAction({ type: "retry", campaign }),
          ),
          duplicate,
          deleteItem,
        ];
    }

    items.push(item("Groups & colour", <Palette size={16} />, () => setOrganizationTarget(campaign.id)));
    return (
      <JoyDropdownMenu>
        <JoyDropdownMenuTrigger
          aria-label={`Actions for ${campaign.name}`}
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
                  {totalCount.toLocaleString()} {totalCount === 1 ? "campaign" : "campaigns"} -{" "}
                  {activeCount.toLocaleString()} active {activeCount === 1 ? "send" : "sends"}
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
                {import.meta.env["VITE_CARE_GUIDE_STUDIO_ENABLED"] === "true" && <Button color="neutral" variant="outlined" startDecorator={<Palette size={16} />} onClick={() => navigate("/crm/care-guides")}>Care Guide Studio</Button>}
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

          <ThisWeekThemeStrip />

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
            <Stack direction="row" spacing={1} alignItems="center" sx={{mt:1}}>
              <label htmlFor="campaign-group-filter">Group</label>
              <select id="campaign-group-filter" value={groupFilter} onChange={e=>updateParams({group:e.target.value})} style={{padding:8,borderRadius:6}}>
                <option value="all">All groups</option>
                {organization.data?.groups.map(group=><option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <Button size="sm" variant="outlined" color="neutral" onClick={()=>setOrganizationTarget('manage')}>Manage groups</Button>
              {organization.isError && <Typography level="body-xs">Groups could not load. <button onClick={()=>organization.refetch()}>Retry</button></Typography>}
            </Stack>
            <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
              <Typography level="body-xs" sx={{ color: "neutral.500", mr: 0.5 }}>Type</Typography>
              {CHANNEL_FILTERS.map((filter) => (
                <Chip
                  key={filter.value}
                  size="sm"
                  color="neutral"
                  variant={channelFilter === filter.value ? "solid" : "outlined"}
                  onClick={() => updateParams({ type: filter.value })}
                  sx={{ borderRadius: "md" }}
                >
                  {filter.label}
                </Chip>
              ))}
              <Stack direction="row" spacing={0.5} sx={{ ml: "auto" }} role="group" aria-label="View">
                <Chip
                  size="sm"
                  color="neutral"
                  variant={viewMode === "cards" ? "solid" : "outlined"}
                  startDecorator={<LayoutGrid size={13} aria-hidden="true" />}
                  onClick={() => updateParams({ view: "cards" })}
                  sx={{ borderRadius: "md" }}
                >
                  Cards
                </Chip>
                <Chip
                  size="sm"
                  color="neutral"
                  variant={viewMode === "table" ? "solid" : "outlined"}
                  startDecorator={<List size={13} aria-hidden="true" />}
                  onClick={() => updateParams({ view: "table" })}
                  sx={{ borderRadius: "md" }}
                >
                  Table
                </Chip>
              </Stack>
            </Stack>
          </Sheet>

          {emptyDrafts.length > 0 && !isLoading ? (
            <Sheet
              variant="soft"
              color="neutral"
              sx={{ borderRadius: "md", px: 1.5, py: 1 }}
            >
              <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                <Typography level="body-sm" sx={{ color: "neutral.700" }}>
                  {emptyDrafts.length} empty {emptyDrafts.length === 1 ? "draft" : "drafts"}{" "}
                  {showEmptyDrafts ? "shown" : "hidden"}. They have no content and no subject.
                </Typography>
                <Button size="sm" variant="plain" color="neutral" onClick={() => setShowEmptyDrafts((value) => !value)}>
                  {showEmptyDrafts ? "Hide them" : "Show them"}
                </Button>
                {hasPermission("campaigns.write") ? (
                  <Button size="sm" variant="outlined" color="danger" onClick={() => setConfirmClearEmpty(true)}>
                    Delete them
                  </Button>
                ) : null}
              </Stack>
            </Sheet>
          ) : null}

          {viewMode === "cards" ? (
            <Stack spacing={2}>
              {isLoading ? (
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)", xl: "repeat(4, 1fr)" } }}>
                  {Array.from({ length: 8 }).map((_, index) => (
                    <Sheet key={index} variant="outlined" sx={{ borderRadius: "md", p: 1.25 }}>
                      <Skeleton variant="rectangular" sx={{ aspectRatio: "16 / 9", borderRadius: "md" }} animation="wave" />
                      <Skeleton variant="text" width="70%" sx={{ mt: 1 }} animation="wave" />
                      <Skeleton variant="text" width="45%" animation="wave" />
                    </Sheet>
                  ))}
                </Box>
              ) : null}
              {campaignsQuery.isError ? (
                <Sheet variant="soft" color="neutral" sx={{ borderRadius: "md", p: 4, textAlign: "center" }}>
                  <Typography level="title-md">Couldn't load campaigns.</Typography>
                  <Button variant="plain" color="neutral" size="sm" onClick={() => void campaignsQuery.refetch()} sx={{ mt: 1 }}>
                    Retry
                  </Button>
                </Sheet>
              ) : null}
              {isEmptyCatalog || isEmptyFiltered ? (
                <Sheet variant="soft" color="neutral" sx={{ borderRadius: "md", p: 4, textAlign: "center" }}>
                  <Typography level="title-md">
                    {isEmptyCatalog ? "No campaigns yet." : "Nothing here yet."}
                  </Typography>
                  <Typography level="body-sm" sx={{ color: "neutral.600", mt: 0.5 }}>
                    {isEmptyCatalog
                      ? "Start with this week's theme or create a new campaign."
                      : "Try another tab, or clear the filters."}
                  </Typography>
                  {hasFilters && !isEmptyCatalog ? (
                    <Button variant="plain" color="neutral" size="sm" onClick={clearFilters} sx={{ mt: 1 }}>
                      Clear filters
                    </Button>
                  ) : null}
                </Sheet>
              ) : null}
              {!isLoading && !campaignsQuery.isError && paginatedCampaigns.length > 0 ? (
                <CampaignCardGrid
                  campaigns={paginatedCampaigns}
                  getName={getCampaignListName}
                  getRecipients={getRecipientCountForList}
                  getProgress={getSendProgress}
                  getColour={(campaign) =>
                    organization.data?.colours.find((c) => c.campaign_id === campaign.id)?.colour
                  }
                  statsPending={(campaign) => campaignStats.pending.has(campaign.id)}
                  onOpen={handleNavigate}
                  renderActions={renderActions}
                  renderStatus={(campaign) => <StatusChip campaign={campaign} />}
                />
              ) : null}
              {listCampaigns.length > PAGE_SIZE ? (
                <JoyTablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  totalCount={listCampaigns.length}
                  onPageChange={setPage}
                  pageSizeOptions={[100]}
                  showPageSizeSelector={false}
                />
              ) : null}
            </Stack>
          ) : (
          <Sheet
            variant="outlined"
            sx={{ borderRadius: "md", overflow: "hidden" }}
          >
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <JoyTable sx={{
                minWidth: { sm: 940 },
                "& th:first-of-type, & td:first-of-type": {
                  position: "sticky", left: 0, zIndex: 1,
                },
                "& th:last-child, & td:last-child": {
                  position: "sticky", right: 0, zIndex: 1,
                },
              }}>
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
                      sx={{ width: { sm: 244, xl: 284 } }}
                    >
                      Campaign name
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={getSortDirection(sortColumn, sortDirection, "type")}
                      onSort={() => setSort("type")}
                      sx={{ width: 68 }}
                    >
                      Type
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={getSortDirection(
                        sortColumn,
                        sortDirection,
                        "status",
                      )}
                      onSort={() => setSort("status")}
                      sx={{ width: 144 }}
                    >
                      Status
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell
                      sortable
                      sortDirection={getSortDirection(sortColumn, sortDirection, "scheduled-date")}
                      onSort={() => setSort("scheduled-date")}
                      sx={{ width: 134, display: tableColumns.showSchedule ? undefined : "none" }}
                    >
                      Scheduled date
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
                      sx={{ width: 104 }}
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
                      sx={{ width: 116 }}
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
                        width: 104,
                        display: tableColumns.showRates ? { xs: "none", xl: "table-cell" } : "none",
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
                        width: 104,
                        display: tableColumns.showRates ? { xs: "none", xl: "table-cell" } : "none",
                      }}
                    >
                      Click rate
                    </JoyTableHeaderCell>
                    <JoyTableHeaderCell align="center" sx={{ width: 68 }}>
                      Actions
                    </JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {isLoading ? <SkeletonRows /> : null}
                  {campaignsQuery.isError ? (
                    <JoyTableRow>
                      <JoyTableCell colSpan={9}>
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
                      <JoyTableCell colSpan={9}>
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
                      <JoyTableCell colSpan={9}>
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
                            <JoyTableCell sx={{ minWidth: 240, borderLeft: `6px solid ${organization.data?.colours.find(c => c.campaign_id === campaign.id)?.colour ?? "transparent"}` }}>
                              <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                                <Typography
                                  level="body-sm"
                                  component="button"
                                  onClick={event=>{event.stopPropagation();editCell(campaign,"name");}}
                                  title={getCampaignListName(campaign)}
                                  sx={{
                                    background:"none",border:0,padding:0,cursor:"pointer",textAlign:"left",
                                    fontWeight: "lg",
                                    color: "text.primary",
                                    overflowWrap: "anywhere",
                                    whiteSpace: "normal",
                                  }}
                                >
                                  {getCampaignListName(campaign)}
                                </Typography>
                                <Typography component="button" onClick={event=>{event.stopPropagation();editCell(campaign,"subject_line");}}
                                  level="body-xs"
                                  sx={{
                                    background:"none",border:0,padding:0,cursor:"pointer",textAlign:"left",
                                    color: "neutral.500",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {campaign.subjectLine ||
                                    campaign.preheaderText ||
                                    "No subject yet"}
                                </Typography>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap">{organization.data?.groups.filter(group=>organization.data?.memberships.some(m=>m.campaign_id===campaign.id && m.group_id===group.id)).map(group=><Chip key={group.id} size="sm" variant="outlined" startDecorator={<Box sx={{width:8,height:8,bgcolor:group.colour,borderRadius:"50%"}} />}>{group.name}</Chip>)}</Stack>
                              </Stack>
                            </JoyTableCell>
                            <JoyTableCell>
                              <Typography level="body-sm">
                                {CHANNEL_LABELS[campaign.channel]}
                              </Typography>
                            </JoyTableCell>
                            <JoyTableCell>
                              <Button variant="plain" color="neutral" size="sm" onClick={event=>{event.stopPropagation();navigate(`/crm/campaigns/${campaign.id}?section=actions`);}}><StatusChip campaign={campaign} /></Button>
                              <ProgressMeter campaign={campaign} />
                            </JoyTableCell>
                            <JoyTableCell sx={{ display: tableColumns.showSchedule ? undefined : "none" }}>
                              <Typography component="button" onClick={event=>{event.stopPropagation();openSchedule(campaign);}} level="body-sm" sx={{ background:"none",border:0,padding:0,cursor:"pointer",textAlign:"left", color: campaign.scheduledAt ? "neutral.800" : "neutral.400" }}>
                                {parseDate(campaign.scheduledAt) ? format(parseDate(campaign.scheduledAt)!, "MMM d, yyyy h:mm a") : "Not scheduled"}
                              </Typography>
                            </JoyTableCell>
                            <JoyTableCell sx={{ textAlign: "right" }}>
                              <Stack
                                spacing={0.5}
                                alignItems="flex-end"
                                sx={{ width: "100%" }}
                              >
                                <Typography component="button" onClick={event=>{event.stopPropagation();navigate(terminal ? `/crm/campaigns/${campaign.id}/recipients` : `/crm/campaigns/${campaign.id}?section=audience`);}}
                                  level="body-sm"
                                  sx={{ fontWeight: "md" }}
                                >
                                  {getRecipientCountForList(
                                    campaign,
                                  ).toLocaleString()}
                                </Typography>
                                {shouldShowLowRecipientWarning(campaign) ? (
                                  <Tooltip
                                    title={
                                      getRecipientCountForList(campaign) === 0
                                        ? "This campaign has no audience configured. Open it to set the recipients before sending."
                                        : "This campaign will send to only one recipient. Open it to confirm the audience is what you expected."
                                    }
                                  >
                                    <Chip
                                      size="sm"
                                      variant="soft"
                                      color="warning"
                                      data-testid="campaign-row-low-recipient-chip"
                                      sx={{ fontSize: "11px" }}
                                    >
                                      {getRecipientCountForList(campaign) === 0
                                        ? "No recipients"
                                        : "1 recipient"}
                                    </Chip>
                                  </Tooltip>
                                ) : null}
                                {campaign.status === CAMPAIGN_STATUS.SENDING ? (
                                  <Typography
                                    level="body-xs"
                                    sx={{ color: "neutral.500" }}
                                  >
                                    {getProcessedCount(campaign).toLocaleString()}{" "}
                                    processed
                                  </Typography>
                                ) : null}
                                {campaignStats.stats.get(campaign.id)?.estimated ? (
                                  <Tooltip title={ESTIMATED_STATS_EXPLANATION}>
                                    <Typography
                                      level="body-xs"
                                      data-testid="campaign-row-estimated"
                                      sx={{ color: "neutral.500" }}
                                    >
                                      {ESTIMATED_STATS_LABEL}
                                    </Typography>
                                  </Tooltip>
                                ) : null}
                              </Stack>
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
                                display: tableColumns.showRates ? { xs: "none", xl: "table-cell" } : "none",
                              }}
                            >
                              <RateCell
                                value={campaign.openRate}
                                count={campaign.totalOpens}
                                active={terminal}
                                pending={campaignStats.pending.has(campaign.id)}
                              />
                            </JoyTableCell>
                            <JoyTableCell
                              sx={{
                                textAlign: "right",
                                display: tableColumns.showRates ? { xs: "none", xl: "table-cell" } : "none",
                              }}
                            >
                              <RateCell
                                value={campaign.clickRate}
                                count={campaign.totalClicks}
                                active={terminal}
                                pending={campaignStats.pending.has(campaign.id)}
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
                              title={getCampaignListName(campaign)}
                              sx={{
                                overflowWrap: "anywhere",
                                whiteSpace: "normal",
                              }}
                            >
                              {getCampaignListName(campaign)}
                            </Typography>
                            <StatusChip
                              campaign={campaign}
                              compactOnNarrow={false}
                            />
                            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                              {CHANNEL_LABELS[campaign.channel]}
                              {parseDate(campaign.scheduledAt)
                                ? ` · Scheduled ${format(parseDate(campaign.scheduledAt)!, "MMM d, yyyy h:mm a")}`
                                : ""}
                            </Typography>
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

            {listCampaigns.length > PAGE_SIZE ? (
              <>
                <Divider />
                <JoyTablePagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  totalCount={listCampaigns.length}
                  onPageChange={setPage}
                  pageSizeOptions={[100]}
                  showPageSizeSelector={false}
                  sx={{ px: 2, py: 2 }}
                />
              </>
            ) : null}
          </Sheet>
          )}
        </Stack>
      </Sheet>

      <JoyAlertDialog
        open={confirmClearEmpty}
        onClose={() => setConfirmClearEmpty(false)}
        onConfirm={() => void clearEmptyDrafts()}
        title={`Delete ${emptyDrafts.length} empty ${emptyDrafts.length === 1 ? "draft" : "drafts"}?`}
        description="These drafts have no content and no subject line. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={clearingEmpty}
      />

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

      <JoyDialog open={!!rescheduleTarget} onClose={()=>{if(!rescheduling)setRescheduleTarget(null);}} size="sm" title="Change send time">
        <JoyDialogContent><JoyInput type="datetime-local" label={`Send at (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} value={rescheduleValue} onValueChange={setRescheduleValue} disabled={rescheduling} /><Typography level="body-sm">The audience and approved content stay the same.</Typography></JoyDialogContent>
        <JoyDialogActions><Button variant="plain" disabled={rescheduling} onClick={()=>setRescheduleTarget(null)}>Cancel</Button><Button disabled={rescheduling || !hasPermission("campaigns.send")} onClick={()=>void reschedule()}>Confirm new send time</Button></JoyDialogActions>
      </JoyDialog>
      <JoyDialog open={!!quickEdit} onClose={()=>{if(!quickSaving)setQuickEdit(null);}} size="sm" title={quickEdit?.field === "name" ? "Edit campaign name" : "Edit subject line"}>
        <JoyDialogContent><JoyInput label={quickEdit?.field === "name" ? "Campaign name" : "Subject line"} value={quickEdit?.value ?? ""} disabled={quickSaving} onValueChange={value=>setQuickEdit(current=>current ? {...current,value} : null)} /></JoyDialogContent>
        <JoyDialogActions><Button variant="plain" disabled={quickSaving} onClick={()=>setQuickEdit(null)}>Cancel</Button><Button disabled={quickSaving || (quickEdit?.field === "name" && !quickEdit.value.trim())} onClick={()=>void saveQuickEdit()}>Save</Button></JoyDialogActions>
      </JoyDialog>
      <JoyDialog open={organizationTarget !== null} onClose={()=>setOrganizationTarget(null)} title="Organize campaigns" size="md">
        <JoyDialogContent><CampaignOrganization campaignId={organizationTarget === 'manage' ? undefined : organizationTarget} /></JoyDialogContent>
      </JoyDialog>
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
