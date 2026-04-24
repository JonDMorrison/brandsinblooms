import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Checkbox from "@mui/joy/Checkbox";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Edit,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  FilterChipBar,
  type FilterDefinition,
  type FilterOption,
  type FilterValue,
  type SortChipOption,
} from "@/components/crm/filters";
import {
  CatalogStatsStrip,
  CatalogStatsStripSkeleton,
} from "@/components/crm/catalog/CatalogStatsStrip";
import { JoyAlertDialog } from "@/components/joy/JoyAlertDialog";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { JoyDebouncedInput } from "@/components/joy/JoyDebouncedInput";
import {
  JoyDropdownMenu,
  JoyDropdownMenuContent,
  JoyDropdownMenuItem,
  JoyDropdownMenuLabel,
  JoyDropdownMenuSeparator,
  JoyDropdownMenuTrigger,
} from "@/components/joy/JoyDropdownMenu";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AutomationRow = Database["public"]["Tables"]["crm_automations"]["Row"];
type AutomationRunRow = Pick<
  Database["public"]["Tables"]["automation_runs"]["Row"],
  | "automation_id"
  | "completed_at"
  | "created_at"
  | "started_at"
  | "status"
  | "updated_at"
>;

type ViewMode = "grid" | "table";
type SortOption = "newest" | "oldest" | "alphabetical" | "last_modified";
type AutomationStatus = "active" | "draft" | "paused" | "completed" | "failed";

type AutomationCatalogItem = {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  triggerLabel: string;
  isActive: boolean;
  status: AutomationStatus;
  createdAt: string | null;
  updatedAt: string | null;
  executionCount: number;
  successRate: number | null;
  lastTriggeredAt: string | null;
  lastRunStatus: string | null;
  stepCount: number;
};

const GRID_COLUMNS = {
  xs: "1fr",
  sm: "repeat(2, minmax(0, 1fr))",
  md: "repeat(3, minmax(0, 1fr))",
} as const;

const STATUS_OPTIONS: FilterOption[] = [
  { id: "active", label: "Active", dotColor: "success.500" },
  { id: "draft", label: "Draft", dotColor: "neutral.400" },
  { id: "paused", label: "Paused", dotColor: "warning.500" },
  { id: "completed", label: "Completed", dotColor: "primary.500" },
  { id: "failed", label: "Failed", dotColor: "danger.500" },
];

const AUTOMATION_STATUS_META: Record<
  AutomationStatus,
  {
    chipColor: "danger" | "neutral" | "primary" | "success" | "warning";
    dotColor: string;
    label: string;
  }
> = {
  active: { chipColor: "success", dotColor: "success.500", label: "Active" },
  completed: {
    chipColor: "primary",
    dotColor: "primary.500",
    label: "Completed",
  },
  draft: { chipColor: "neutral", dotColor: "neutral.400", label: "Draft" },
  failed: { chipColor: "danger", dotColor: "danger.500", label: "Failed" },
  paused: { chipColor: "warning", dotColor: "warning.500", label: "Paused" },
};

const SORT_OPTIONS: SortChipOption[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "alphabetical", label: "Alphabetical" },
  { id: "last_modified", label: "Last Modified" },
];

const TRIGGER_LABELS: Record<string, string> = {
  abandoned_cart: "Abandoned cart",
  birthday: "Birthday",
  "contact.created": "Contact created",
  "contact.updated": "Contact updated",
  first_purchase: "First purchase",
  loyalty_join: "Loyalty joined",
  manual: "Manual",
  newsletter_opt_in: "Newsletter opt-in",
  "order.ready_for_pickup": "Order ready for pickup",
  "order.shipped": "Order shipped",
  "payment.completed": "Payment completed",
  "persona.assigned": "Persona assigned",
  purchase_delay: "Purchase delay",
  refund_created: "Refund created",
  "refund.created": "Refund created",
  repeat_purchase_90d: "Repeat purchase 90d",
  review_request: "Review request",
  seasonal: "Seasonal reminder",
  segment_joined: "Segment joined",
  "segment.added": "Segment added",
  welcome: "Welcome",
};

const COMPLETED_RUN_STATUSES = new Set(["completed", "success"]);
const FAILED_RUN_STATUSES = new Set(["failed", "error"]);
const PAUSED_RUN_STATUSES = new Set(["paused", "cancelled"]);
const STATUS_IDS = new Set(
  STATUS_OPTIONS.map((option) => option.id as AutomationStatus),
);

function normalizeViewMode(value: string | null): ViewMode {
  return value === "table" ? "table" : "grid";
}

function parseCsvParam(value: string | null) {
  if (!value) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeFilterMode(value: string | null): FilterValue["mode"] {
  return value === "exclude" ? "exclude" : "include";
}

function normalizeSortOption(value: string | null): SortOption {
  switch (value) {
    case "oldest":
    case "alphabetical":
    case "last_modified":
      return value;
    case "name":
      return "alphabetical";
    case "triggered":
      return "last_modified";
    default:
      return "newest";
  }
}

function getTriggerLabel(triggerType: string) {
  return TRIGGER_LABELS[triggerType] ?? triggerType.replace(/[_.-]+/g, " ");
}

function getAutomationDescription(row: AutomationRow) {
  const flowState =
    row.flow_state && typeof row.flow_state === "object"
      ? (row.flow_state as Record<string, unknown>)
      : null;
  const metadata =
    flowState?.metadata && typeof flowState.metadata === "object"
      ? (flowState.metadata as Record<string, unknown>)
      : null;

  const candidates = [flowState?.description, metadata?.description];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "No description";
}

function getStepCount(row: AutomationRow) {
  const flowState = row.flow_state as {
    nodes?: Array<{ type?: string }>;
  } | null;
  const workflowSteps = row.workflow_steps as
    | Array<unknown>
    | { nodes?: Array<{ type?: string }> }
    | null;

  if (flowState?.nodes && Array.isArray(flowState.nodes)) {
    return flowState.nodes.filter((node) => node.type !== "trigger").length;
  }

  if (Array.isArray(workflowSteps)) {
    return workflowSteps.length;
  }

  if (workflowSteps?.nodes && Array.isArray(workflowSteps.nodes)) {
    return workflowSteps.nodes.filter((node) => node.type !== "trigger").length;
  }

  return 0;
}

function toComparableTime(value: string | null | undefined) {
  return value ? new Date(value).getTime() : 0;
}

function formatRelativeTime(value: string | null) {
  if (!value) {
    return "Never triggered";
  }

  return `Last triggered ${formatDistanceToNow(new Date(value), {
    addSuffix: true,
  })}`;
}

function getSuccessRateLabel(value: number | null) {
  return value === null ? "-" : `${Math.round(value)}%`;
}

function deriveAutomationStatus(
  isActive: boolean,
  executionCount: number,
  lastRunStatus: string | null,
): AutomationStatus {
  if (isActive) {
    return "active";
  }

  if (executionCount === 0) {
    return "draft";
  }

  if (lastRunStatus && FAILED_RUN_STATUSES.has(lastRunStatus.toLowerCase())) {
    return "failed";
  }

  if (lastRunStatus && PAUSED_RUN_STATUSES.has(lastRunStatus.toLowerCase())) {
    return "paused";
  }

  if (
    lastRunStatus &&
    COMPLETED_RUN_STATUSES.has(lastRunStatus.toLowerCase())
  ) {
    return "completed";
  }

  return "paused";
}

function matchesFilterSelection(value: string, filter: FilterValue) {
  if (filter.selectedIds.length === 0) {
    return true;
  }

  if (filter.mode === "exclude") {
    return true;
  }

  return filter.selectedIds.includes(value);
}

function AutomationStatusPill({ status }: { status: AutomationStatus }) {
  const meta = AUTOMATION_STATUS_META[status];

  return (
    <JoyChip
      size="sm"
      variant="soft"
      color={meta.chipColor}
      startDecorator={
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            backgroundColor: meta.dotColor,
          }}
        />
      }
      sx={{ fontWeight: "md" }}
    >
      {meta.label}
    </JoyChip>
  );
}

function AutomationCardSkeleton() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", p: 2, minHeight: 248 }}>
      <Stack spacing={1.5} sx={{ height: "100%" }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Skeleton
            variant="circular"
            width={36}
            height={36}
            animation="wave"
          />
          <Skeleton variant="text" width="55%" height={18} animation="wave" />
          <Box sx={{ ml: "auto" }}>
            <Skeleton
              variant="circular"
              width={28}
              height={28}
              animation="wave"
            />
          </Box>
        </Stack>

        <Box>
          <Skeleton variant="text" width="85%" height={14} animation="wave" />
          <Skeleton
            variant="text"
            width="65%"
            height={14}
            animation="wave"
            sx={{ mt: 0.5 }}
          />
        </Box>

        <Stack direction="row" spacing={1}>
          <Skeleton
            variant="rectangular"
            width={90}
            height={22}
            animation="wave"
            sx={{ borderRadius: "sm" }}
          />
          <Skeleton
            variant="rectangular"
            width={58}
            height={22}
            animation="wave"
            sx={{ borderRadius: "sm" }}
          />
        </Stack>

        <Stack direction="row" spacing={3}>
          <Skeleton variant="text" width={84} height={14} animation="wave" />
          <Skeleton variant="text" width={72} height={14} animation="wave" />
        </Stack>

        <Skeleton variant="text" width={128} height={14} animation="wave" />

        <Stack
          direction="row"
          justifyContent="space-between"
          sx={{ mt: "auto" }}
        >
          <Skeleton variant="text" width={80} height={14} animation="wave" />
          <Skeleton variant="text" width={90} height={14} animation="wave" />
        </Stack>
      </Stack>
    </Sheet>
  );
}

function AutomationTableSkeleton() {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "lg", overflow: "hidden" }}>
      <JoyTable>
        <JoyTableHead>
          <JoyTableRow>
            <JoyTableHeaderCell sx={{ width: 44 }} />
            <JoyTableHeaderCell>Name</JoyTableHeaderCell>
            <JoyTableHeaderCell>Trigger Type</JoyTableHeaderCell>
            <JoyTableHeaderCell>Status</JoyTableHeaderCell>
            <JoyTableHeaderCell align="right">Executions</JoyTableHeaderCell>
            <JoyTableHeaderCell>Last Triggered</JoyTableHeaderCell>
            <JoyTableHeaderCell align="center">Actions</JoyTableHeaderCell>
          </JoyTableRow>
        </JoyTableHead>
        <JoyTableBody>
          {Array.from({ length: 6 }).map((_, index) => (
            <JoyTableRow key={index}>
              <JoyTableCell>
                <Skeleton
                  variant="circular"
                  width={18}
                  height={18}
                  animation="wave"
                />
              </JoyTableCell>
              <JoyTableCell>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Skeleton
                    variant="circular"
                    width={32}
                    height={32}
                    animation="wave"
                  />
                  <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                    <Skeleton
                      variant="text"
                      width="46%"
                      height={16}
                      animation="wave"
                    />
                    <Skeleton
                      variant="text"
                      width="70%"
                      height={13}
                      animation="wave"
                    />
                  </Stack>
                </Stack>
              </JoyTableCell>
              <JoyTableCell>
                <Skeleton
                  variant="rectangular"
                  width={92}
                  height={22}
                  animation="wave"
                  sx={{ borderRadius: "sm" }}
                />
              </JoyTableCell>
              <JoyTableCell>
                <Skeleton
                  variant="rectangular"
                  width={64}
                  height={22}
                  animation="wave"
                  sx={{ borderRadius: "sm" }}
                />
              </JoyTableCell>
              <JoyTableCell align="right">
                <Skeleton
                  variant="text"
                  width={42}
                  height={14}
                  animation="wave"
                  sx={{ ml: "auto" }}
                />
              </JoyTableCell>
              <JoyTableCell>
                <Skeleton
                  variant="text"
                  width={112}
                  height={14}
                  animation="wave"
                />
              </JoyTableCell>
              <JoyTableCell align="center">
                <Skeleton
                  variant="circular"
                  width={28}
                  height={28}
                  animation="wave"
                  sx={{ mx: "auto" }}
                />
              </JoyTableCell>
            </JoyTableRow>
          ))}
        </JoyTableBody>
      </JoyTable>
    </Sheet>
  );
}

function AutomationCard({
  automation,
  onNavigate,
  onEdit,
  onDelete,
  onToggleStatus,
}: {
  automation: AutomationCatalogItem;
  onNavigate: (automation: AutomationCatalogItem) => void;
  onEdit: (automation: AutomationCatalogItem) => void;
  onDelete: (automation: AutomationCatalogItem) => void;
  onToggleStatus: (automation: AutomationCatalogItem) => void;
}) {
  const hasDescription =
    automation.description.trim().length > 0 &&
    automation.description.trim() !== "No description";

  return (
    <Sheet
      variant="outlined"
      onClick={() => onNavigate(automation)}
      sx={{
        borderRadius: "lg",
        p: 2.5,
        minHeight: 276,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        cursor: "pointer",
        transition: "all 0.15s ease",
        "&:hover": {
          borderColor: "neutral.300",
          boxShadow: "sm",
        },
      }}
    >
      <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="flex-start"
        >
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="flex-start"
            sx={{ minWidth: 0, flex: 1 }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                backgroundColor: "primary.100",
                color: "primary.600",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Zap size={18} />
            </Box>
            <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1, pt: 0.125 }}>
              <Typography
                level="title-md"
                sx={{
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {automation.name}
              </Typography>
            </Stack>
          </Stack>

          <JoyDropdownMenu>
            <JoyDropdownMenuTrigger
              variant="plain"
              color="neutral"
              size="sm"
              onClick={(event) => event.stopPropagation()}
              iconButtonSx={{
                width: 34,
                height: 34,
                minWidth: 34,
                minHeight: 34,
                borderRadius: "12px",
                border: "1px solid",
                borderColor: "neutral.200",
                backgroundColor: "background.level1",
                color: "neutral.600",
                boxShadow: "xs",
                "&:hover": {
                  backgroundColor: "neutral.100",
                  borderColor: "neutral.300",
                  color: "neutral.800",
                },
              }}
            >
              <MoreHorizontal size={18} />
            </JoyDropdownMenuTrigger>
            <JoyDropdownMenuContent
              sx={{
                minWidth: 236,
                p: 0.875,
                borderRadius: "xl",
                borderColor: "neutral.200",
                backgroundColor: "background.surface",
                boxShadow: "lg",
              }}
            >
              <JoyDropdownMenuLabel sx={{ px: 1.25, py: 0.5 }}>
                Workflow actions
              </JoyDropdownMenuLabel>
              <JoyDropdownMenuSeparator sx={{ my: 0.5 }} />
              <JoyDropdownMenuItem
                startDecorator={<Edit size={16} />}
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(automation);
                }}
                sx={{
                  minHeight: 44,
                  px: 1.5,
                  py: 1,
                  borderRadius: "lg",
                  "&:hover": {
                    backgroundColor:
                      "rgba(var(--joy-palette-primary-mainChannel) / 0.08)",
                  },
                }}
              >
                Edit workflow
              </JoyDropdownMenuItem>
              <JoyDropdownMenuItem
                startDecorator={
                  automation.isActive ? <Pause size={16} /> : <Play size={16} />
                }
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleStatus(automation);
                }}
                sx={{
                  minHeight: 44,
                  px: 1.5,
                  py: 1,
                  borderRadius: "lg",
                  "&:hover": {
                    backgroundColor: automation.isActive
                      ? "rgba(var(--joy-palette-warning-mainChannel) / 0.12)"
                      : "rgba(var(--joy-palette-success-mainChannel) / 0.12)",
                  },
                }}
              >
                {automation.isActive ? "Pause" : "Activate"}
              </JoyDropdownMenuItem>
              <JoyDropdownMenuSeparator sx={{ my: 0.5 }} />
              <JoyDropdownMenuItem
                destructive
                startDecorator={<Trash2 size={16} />}
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(automation);
                }}
                sx={{
                  minHeight: 44,
                  px: 1.5,
                  py: 1,
                  borderRadius: "lg",
                  "&:hover": {
                    backgroundColor:
                      "rgba(var(--joy-palette-danger-mainChannel) / 0.10)",
                  },
                }}
              >
                Delete
              </JoyDropdownMenuItem>
            </JoyDropdownMenuContent>
          </JoyDropdownMenu>
        </Stack>

        <Typography
          level="body-sm"
          sx={{
            color: hasDescription ? "neutral.500" : "neutral.400",
            fontStyle: hasDescription ? "normal" : "italic",
            minHeight: 42,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {hasDescription ? automation.description : "No description"}
        </Typography>

        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ py: 0.25 }}
        >
          <AutomationStatusPill status={automation.status} />
          <JoyChip
            variant="outlined"
            color="neutral"
            size="sm"
            startDecorator={<Zap size={12} />}
            sx={{
              fontWeight: "md",
              "& .lucide": {
                width: 12,
                height: 12,
                color: "var(--joy-palette-neutral-500)",
              },
            }}
          >
            {automation.triggerLabel}
          </JoyChip>
          <Typography level="body-xs" sx={{ color: "neutral.400" }}>
            {formatRelativeTime(automation.lastTriggeredAt)}
          </Typography>
        </Stack>

        <Sheet
          variant="outlined"
          sx={{
            mt: 2,
            borderRadius: "md",
            borderColor: "neutral.200",
            backgroundColor: "background.surface",
            p: 1.5,
            display: "flex",
            alignItems: "center",
            gap: 2,
          }}
        >
          <Stack spacing={0.35} sx={{ minWidth: 0, flex: 1 }}>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Executions
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              {automation.executionCount.toLocaleString()}
            </Typography>
          </Stack>
          <Divider
            orientation="vertical"
            sx={{ height: 24, alignSelf: "center", borderColor: "neutral.200" }}
          />
          <Stack
            spacing={0.35}
            sx={{
              minWidth: 0,
              flex: 1,
              alignItems: "flex-end",
              textAlign: "right",
            }}
          >
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Success rate
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 600 }}>
              {getSuccessRateLabel(automation.successRate)}
            </Typography>
          </Stack>
        </Sheet>
      </Stack>

      <Stack direction="row" justifyContent="flex-end" sx={{ pt: 1.5 }}>
        <JoyButton
          size="sm"
          variant="outlined"
          color="neutral"
          endDecorator={<ArrowRight size={14} />}
          onClick={(event) => {
            event.stopPropagation();
            onNavigate(automation);
          }}
          sx={{
            borderRadius: "md",
            fontWeight: 600,
            fontSize: "xs",
            whiteSpace: "nowrap",
          }}
        >
          Details
        </JoyButton>
      </Stack>
    </Sheet>
  );
}

export default function CRMAutomations() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] =
    React.useState<AutomationCatalogItem | null>(null);

  const query = searchParams.get("q") ?? "";
  const sort = normalizeSortOption(searchParams.get("sort"));
  const view = normalizeViewMode(searchParams.get("view"));

  const statusFilterValue = React.useMemo<FilterValue>(
    () => ({
      mode: normalizeFilterMode(searchParams.get("statusMode")),
      selectedIds: parseCsvParam(searchParams.get("status")).filter(
        (value): value is AutomationStatus =>
          STATUS_IDS.has(value as AutomationStatus),
      ),
    }),
    [searchParams],
  );

  const automationsQuery = useQuery({
    queryKey: ["crm-automations-catalog", tenant?.id],
    enabled: Boolean(tenant?.id),
    queryFn: async () => {
      const [
        { data: automationRows, error: automationError },
        { data: runRows, error: runError },
      ] = await Promise.all([
        supabase
          .from("crm_automations")
          .select(
            "id, name, trigger_type, is_active, created_at, updated_at, workflow_steps, flow_state, template_source",
          )
          .eq("tenant_id", tenant!.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("automation_runs")
          .select(
            "automation_id, status, completed_at, started_at, updated_at, created_at",
          )
          .eq("tenant_id", tenant!.id),
      ]);

      if (automationError) {
        throw automationError;
      }

      if (runError) {
        throw runError;
      }

      const runSummary = new Map<
        string,
        {
          completedCount: number;
          executionCount: number;
          failedCount: number;
          lastRunStatus: string | null;
          lastTriggeredAt: string | null;
          lastTriggeredTime: number;
        }
      >();

      for (const run of (runRows ?? []) as AutomationRunRow[]) {
        const summary = runSummary.get(run.automation_id) ?? {
          completedCount: 0,
          executionCount: 0,
          failedCount: 0,
          lastRunStatus: null,
          lastTriggeredAt: null,
          lastTriggeredTime: 0,
        };

        summary.executionCount += 1;

        const normalizedStatus = run.status?.toLowerCase() ?? "";
        if (COMPLETED_RUN_STATUSES.has(normalizedStatus)) {
          summary.completedCount += 1;
        }
        if (FAILED_RUN_STATUSES.has(normalizedStatus)) {
          summary.failedCount += 1;
        }

        const candidateTimestamp =
          run.completed_at ??
          run.updated_at ??
          run.started_at ??
          run.created_at;
        const candidateTime = toComparableTime(candidateTimestamp);
        if (candidateTime >= summary.lastTriggeredTime) {
          summary.lastTriggeredTime = candidateTime;
          summary.lastTriggeredAt = candidateTimestamp;
          summary.lastRunStatus = run.status;
        }

        runSummary.set(run.automation_id, summary);
      }

      return ((automationRows ?? []) as AutomationRow[]).map((row) => {
        const summary = runSummary.get(row.id);
        const executionCount = summary?.executionCount ?? 0;
        const completedCount = summary?.completedCount ?? 0;
        const successRate =
          executionCount > 0 ? (completedCount / executionCount) * 100 : null;
        const isActive = Boolean(row.is_active);

        return {
          id: row.id,
          name: row.name,
          description: getAutomationDescription(row),
          triggerType: row.trigger_type,
          triggerLabel: getTriggerLabel(row.trigger_type),
          isActive,
          status: deriveAutomationStatus(
            isActive,
            executionCount,
            summary?.lastRunStatus ?? null,
          ),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          executionCount,
          successRate,
          lastTriggeredAt: summary?.lastTriggeredAt ?? null,
          lastRunStatus: summary?.lastRunStatus ?? null,
          stepCount: getStepCount(row),
        } satisfies AutomationCatalogItem;
      });
    },
  });

  const triggerOptions = React.useMemo<FilterOption[]>(() => {
    const optionMap = new Map<string, FilterOption>();

    for (const automation of automationsQuery.data ?? []) {
      const existing = optionMap.get(automation.triggerLabel);

      if (existing) {
        const keywords = new Set([
          ...(existing.keywords ?? []),
          automation.triggerType,
        ]);
        existing.keywords = Array.from(keywords);
        continue;
      }

      optionMap.set(automation.triggerLabel, {
        id: automation.triggerLabel,
        label: automation.triggerLabel,
        dotColor: "neutral.400",
        keywords: [automation.triggerType],
      });
    }

    return Array.from(optionMap.values()).sort((left, right) =>
      left.label.localeCompare(right.label),
    );
  }, [automationsQuery.data]);

  const triggerIds = React.useMemo(
    () => new Set(triggerOptions.map((option) => option.id)),
    [triggerOptions],
  );

  const triggerFilterValue = React.useMemo<FilterValue>(
    () => ({
      mode: normalizeFilterMode(searchParams.get("triggerMode")),
      selectedIds: parseCsvParam(searchParams.get("trigger")).filter((value) =>
        triggerIds.has(value),
      ),
    }),
    [searchParams, triggerIds],
  );

  const updateParams = React.useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (
          !value ||
          (key === "sort" && value === "newest") ||
          (key === "view" && value === "grid") ||
          ((key === "statusMode" || key === "triggerMode") &&
            value === "include")
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

  const updateFilterParams = React.useCallback(
    (
      key: "status" | "trigger",
      modeKey: "statusMode" | "triggerMode",
      value: FilterValue,
    ) => {
      updateParams({
        [key]:
          value.selectedIds.length > 0 ? value.selectedIds.join(",") : null,
        [modeKey]: value.selectedIds.length > 0 ? value.mode : null,
      });
    },
    [updateParams],
  );

  const clearAllFilters = React.useCallback(() => {
    updateParams({
      q: null,
      status: null,
      statusMode: null,
      trigger: null,
      triggerMode: null,
    });
  }, [updateParams]);

  const filterChips = React.useMemo<
    Array<{
      definition: FilterDefinition;
      onChange: (value: FilterValue) => void;
      value: FilterValue;
    }>
  >(
    () => [
      {
        definition: {
          id: "status",
          label: "Status",
          options: STATUS_OPTIONS,
        },
        value: statusFilterValue,
        onChange: (value) => updateFilterParams("status", "statusMode", value),
      },
      {
        definition: {
          id: "trigger",
          label: "Trigger Type",
          options: triggerOptions,
          searchable: true,
          searchPlaceholder: "Search triggers...",
        },
        value: triggerFilterValue,
        onChange: (value) =>
          updateFilterParams("trigger", "triggerMode", value),
      },
    ],
    [statusFilterValue, triggerFilterValue, triggerOptions, updateFilterParams],
  );

  const automations = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = (automationsQuery.data ?? []).filter((automation) => {
      if (!matchesFilterSelection(automation.status, statusFilterValue)) {
        return false;
      }

      if (
        !matchesFilterSelection(automation.triggerLabel, triggerFilterValue)
      ) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        automation.name,
        automation.description,
        automation.triggerLabel,
        automation.triggerType,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    filtered.sort((left, right) => {
      switch (sort) {
        case "alphabetical":
          return left.name.localeCompare(right.name);
        case "oldest":
          return (
            toComparableTime(left.createdAt ?? left.updatedAt) -
            toComparableTime(right.createdAt ?? right.updatedAt)
          );
        case "last_modified":
          return (
            toComparableTime(right.updatedAt ?? right.createdAt) -
            toComparableTime(left.updatedAt ?? left.createdAt)
          );
        case "newest":
        default:
          return (
            toComparableTime(right.createdAt ?? right.updatedAt) -
            toComparableTime(left.createdAt ?? left.updatedAt)
          );
      }
    });

    return filtered;
  }, [
    automationsQuery.data,
    query,
    sort,
    statusFilterValue,
    triggerFilterValue,
  ]);

  const totalCount = automationsQuery.data?.length ?? 0;
  const activeCount = React.useMemo(
    () =>
      (automationsQuery.data ?? []).filter((item) => item.status === "active")
        .length,
    [automationsQuery.data],
  );

  const stats = React.useMemo(() => {
    const items = automationsQuery.data ?? [];
    const totalExecutions = items.reduce(
      (sum, item) => sum + item.executionCount,
      0,
    );
    const completedExecutions = items.reduce((sum, item) => {
      if (item.successRate === null) {
        return sum;
      }

      return sum + Math.round((item.executionCount * item.successRate) / 100);
    }, 0);
    const successRate =
      totalExecutions > 0
        ? `${Math.round((completedExecutions / totalExecutions) * 100)}%`
        : "-";

    return [
      {
        label: "Total Automations",
        value: totalCount.toLocaleString(),
        icon: <Zap size={18} />,
      },
      {
        label: "Active",
        value: activeCount.toLocaleString(),
        icon: <Play size={18} />,
      },
      {
        label: "Total Executions",
        value: totalExecutions.toLocaleString(),
        icon: <Activity size={18} />,
      },
      {
        label: "Success Rate",
        value: successRate,
        icon: <CheckCircle2 size={18} />,
      },
    ];
  }, [activeCount, automationsQuery.data, totalCount]);

  const hasActiveFilters =
    query.trim().length > 0 ||
    statusFilterValue.selectedIds.length > 0 ||
    triggerFilterValue.selectedIds.length > 0;

  React.useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) =>
        automations.some((automation) => automation.id === id),
      ),
    );
  }, [automations]);

  const allVisibleIds = automations.map((automation) => automation.id);
  const allSelected =
    allVisibleIds.length > 0 &&
    allVisibleIds.every((id) => selectedIds.includes(id));

  const invalidateAutomations = React.useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: ["crm-automations-catalog"],
    });
  }, [queryClient]);

  const handleRefresh = React.useCallback(async () => {
    await automationsQuery.refetch();
  }, [automationsQuery]);

  const handleToggleStatus = React.useCallback(
    async (automation: AutomationCatalogItem) => {
      const nextIsActive = !automation.isActive;
      const { error } = await supabase
        .from("crm_automations")
        .update({ is_active: nextIsActive })
        .eq("id", automation.id);

      if (error) {
        toast.error(error.message || "Failed to update automation");
        return;
      }

      toast.success(
        nextIsActive ? "Automation activated" : "Automation paused",
      );
      await invalidateAutomations();
    },
    [invalidateAutomations],
  );

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    const { error } = await supabase
      .from("crm_automations")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error(error.message || "Failed to delete automation");
      return;
    }

    toast.success("Automation deleted");
    setDeleteTarget(null);
    await invalidateAutomations();
  }, [deleteTarget, invalidateAutomations]);

  const isLoading = automationsQuery.isLoading;
  const isEmpty = !isLoading && totalCount === 0;
  const isFilteredEmpty =
    !isLoading && totalCount > 0 && automations.length === 0;

  return (
    <PageContainer fullWidth>
      <Stack spacing={3} sx={{ pb: 4 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "stretch", md: "flex-start" }}
          justifyContent="space-between"
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography level="h3" fontWeight="bold">
              Automations
            </Typography>
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Set up automated workflows to engage your customers with triggers,
              delays, and actions.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <JoyChip variant="soft" color="neutral" size="sm">
                {totalCount} workflows
              </JoyChip>
              <JoyChip variant="soft" color="neutral" size="sm">
                {activeCount} active
              </JoyChip>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              variant="outlined"
              color="neutral"
              size="sm"
              onClick={() => void handleRefresh()}
              aria-label="Refresh"
            >
              <Box
                component="span"
                sx={{
                  display: "inline-flex",
                  animation: automationsQuery.isFetching
                    ? "crm-automations-spin 1s linear infinite"
                    : "none",
                  "@keyframes crm-automations-spin": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                  },
                }}
              >
                <RefreshCw size={16} />
              </Box>
            </IconButton>
            <JoyButton
              variant="solid"
              color="primary"
              size="sm"
              startDecorator={<Plus size={16} />}
              onClick={() => navigate("/crm/automations/new")}
            >
              Create Automation
            </JoyButton>
          </Stack>
        </Stack>

        {isLoading ? (
          <CatalogStatsStripSkeleton itemCount={4} />
        ) : (
          <CatalogStatsStrip items={stats} />
        )}

        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "lg",
            px: 1.5,
            py: 2.5,
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                lg: "minmax(280px, 340px) minmax(0, 1fr)",
              },
              gap: 1.5,
              alignItems: "start",
            }}
          >
            <JoyDebouncedInput
              size="sm"
              value={query}
              debounceMs={300}
              onDebouncedChange={(value) => updateParams({ q: value || null })}
              placeholder="Search automations..."
              startDecorator={<Search size={16} />}
              sx={{
                width: "100%",
                minWidth: 0,
              }}
            />

            <Stack
              spacing={1}
              sx={{
                minWidth: 0,
                alignItems: { xs: "stretch", lg: "flex-end" },
              }}
            >
              <Stack
                direction={{ xs: "column", xl: "row" }}
                spacing={1}
                alignItems={{ xs: "stretch", xl: "center" }}
                justifyContent={{ xs: "flex-start", xl: "flex-end" }}
                sx={{ width: "100%", minWidth: 0 }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                    flex: 1,
                    display: "flex",
                    justifyContent: { xs: "flex-start", xl: "flex-end" },
                  }}
                >
                  <FilterChipBar
                    alignment="end"
                    clearAllVisible={hasActiveFilters}
                    filters={filterChips}
                    onClearAll={clearAllFilters}
                    sort={{
                      label: "Sort",
                      onChange: (value) => updateParams({ sort: value }),
                      options: SORT_OPTIONS,
                      value: sort,
                    }}
                  />
                </Box>

                <Stack
                  direction="row"
                  spacing={0.5}
                  sx={{
                    alignSelf: { xs: "flex-end", xl: "center" },
                    flexShrink: 0,
                    p: 0.375,
                    borderRadius: "xl",
                    border: "1px solid",
                    borderColor: "neutral.200",
                    backgroundColor: "background.level1",
                  }}
                >
                  <Tooltip title="Grid view">
                    <IconButton
                      variant={view === "grid" ? "soft" : "plain"}
                      color="neutral"
                      size="sm"
                      aria-label="Grid view"
                      onClick={() => updateParams({ view: "grid" })}
                    >
                      <LayoutGrid size={16} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="List view">
                    <IconButton
                      variant={view === "table" ? "soft" : "plain"}
                      color="neutral"
                      size="sm"
                      aria-label="List view"
                      onClick={() => updateParams({ view: "table" })}
                    >
                      <List size={16} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Stack>
          </Box>
        </Sheet>

        {isLoading ? (
          view === "grid" ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: GRID_COLUMNS,
                gap: 2,
              }}
            >
              {Array.from({ length: 6 }).map((_, index) => (
                <AutomationCardSkeleton key={index} />
              ))}
            </Box>
          ) : (
            <AutomationTableSkeleton />
          )
        ) : isEmpty ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: "12px",
                backgroundColor: "neutral.100",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mx: "auto",
                mb: 2,
              }}
            >
              <Zap
                size={24}
                style={{ color: "var(--joy-palette-neutral-400)" }}
              />
            </Box>
            <Typography level="body-sm" fontWeight="md">
              Create your first automation
            </Typography>
            <Typography
              level="body-xs"
              sx={{ color: "neutral.500", mt: 0.5, maxWidth: 300, mx: "auto" }}
            >
              Automate email and SMS workflows triggered by customer actions,
              purchases, and segments.
            </Typography>
            <JoyButton
              variant="solid"
              color="primary"
              size="sm"
              startDecorator={<Plus size={16} />}
              sx={{ mt: 2 }}
              onClick={() => navigate("/crm/automations/new")}
            >
              Create Automation
            </JoyButton>
          </Box>
        ) : isFilteredEmpty ? (
          <Stack spacing={1.5} alignItems="center" sx={{ py: 8 }}>
            <Avatar
              color="neutral"
              variant="soft"
              sx={{ width: 48, height: 48 }}
            >
              <Search size={22} />
            </Avatar>
            <Typography level="body-sm" fontWeight="md">
              No automations match these filters
            </Typography>
            <Typography level="body-xs" sx={{ color: "neutral.500" }}>
              Try a different search or clear the current filters.
            </Typography>
            <JoyButton
              variant="plain"
              color="primary"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear filters
            </JoyButton>
          </Stack>
        ) : view === "grid" ? (
          <Box
            sx={{ display: "grid", gridTemplateColumns: GRID_COLUMNS, gap: 2 }}
          >
            {automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                onNavigate={(item) => navigate(`/crm/automations/${item.id}`)}
                onEdit={(item) => navigate(`/crm/automations/${item.id}`)}
                onDelete={setDeleteTarget}
                onToggleStatus={(item) => void handleToggleStatus(item)}
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
                  <JoyTableHeaderCell sx={{ width: 44, px: 1.5 }}>
                    <Checkbox
                      size="sm"
                      checked={allSelected}
                      indeterminate={selectedIds.length > 0 && !allSelected}
                      onChange={(event) => {
                        setSelectedIds(
                          event.target.checked ? allVisibleIds : [],
                        );
                      }}
                    />
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: "36%" }}>
                    Name
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: 130 }}>
                    Trigger Type
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: 120 }}>
                    Status
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell align="right" sx={{ width: 110 }}>
                    Executions
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell sx={{ width: 150 }}>
                    Last Triggered
                  </JoyTableHeaderCell>
                  <JoyTableHeaderCell
                    align="center"
                    sx={{ width: 60, px: 1.5 }}
                  >
                    Actions
                  </JoyTableHeaderCell>
                </JoyTableRow>
              </JoyTableHead>
              <JoyTableBody>
                {automations.map((automation) => (
                  <JoyTableRow
                    key={automation.id}
                    clickable
                    onClick={() =>
                      navigate(`/crm/automations/${automation.id}`)
                    }
                  >
                    <JoyTableCell
                      sx={{ px: 1.5 }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        size="sm"
                        checked={selectedIds.includes(automation.id)}
                        onChange={(event) => {
                          setSelectedIds((current) =>
                            event.target.checked
                              ? [...current, automation.id]
                              : current.filter((id) => id !== automation.id),
                          );
                        }}
                      />
                    </JoyTableCell>

                    <JoyTableCell>
                      <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        sx={{ minWidth: 0 }}
                      >
                        <Avatar size="sm" variant="soft" color="neutral">
                          <Zap size={16} />
                        </Avatar>
                        <Stack spacing={0.35} sx={{ minWidth: 0 }}>
                          <Typography
                            level="body-sm"
                            fontWeight="lg"
                            sx={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {automation.name}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{
                              color: "neutral.500",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 360,
                            }}
                          >
                            {automation.description}
                          </Typography>
                        </Stack>
                      </Stack>
                    </JoyTableCell>

                    <JoyTableCell>
                      <JoyChip variant="outlined" color="neutral" size="sm">
                        {automation.triggerLabel}
                      </JoyChip>
                    </JoyTableCell>

                    <JoyTableCell>
                      <AutomationStatusPill status={automation.status} />
                    </JoyTableCell>

                    <JoyTableCell align="right">
                      <Typography level="body-sm" fontWeight="md">
                        {automation.executionCount.toLocaleString()}
                      </Typography>
                    </JoyTableCell>

                    <JoyTableCell>
                      <Typography level="body-xs" sx={{ color: "neutral.600" }}>
                        {automation.lastTriggeredAt
                          ? formatDistanceToNow(
                              new Date(automation.lastTriggeredAt),
                              {
                                addSuffix: true,
                              },
                            )
                          : "Never"}
                      </Typography>
                    </JoyTableCell>

                    <JoyTableCell
                      align="center"
                      sx={{ px: 1.5 }}
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
                            startDecorator={<Edit size={16} />}
                            onClick={() =>
                              navigate(`/crm/automations/${automation.id}`)
                            }
                          >
                            Edit workflow
                          </JoyDropdownMenuItem>
                          <JoyDropdownMenuItem
                            startDecorator={
                              automation.isActive ? (
                                <Pause size={16} />
                              ) : (
                                <Play size={16} />
                              )
                            }
                            onClick={() => void handleToggleStatus(automation)}
                          >
                            {automation.isActive ? "Pause" : "Activate"}
                          </JoyDropdownMenuItem>
                          <JoyDropdownMenuItem
                            destructive
                            startDecorator={<Trash2 size={16} />}
                            onClick={() => setDeleteTarget(automation)}
                          >
                            Delete
                          </JoyDropdownMenuItem>
                        </JoyDropdownMenuContent>
                      </JoyDropdownMenu>
                    </JoyTableCell>
                  </JoyTableRow>
                ))}
              </JoyTableBody>
            </JoyTable>
          </Sheet>
        )}

        <JoyAlertDialog
          open={Boolean(deleteTarget)}
          onClose={() => setDeleteTarget(null)}
          title="Delete Automation"
          description={`Are you sure you want to delete "${deleteTarget?.name ?? "this automation"}"? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onConfirm={() => void handleDelete()}
          variant="danger"
        />
      </Stack>
    </PageContainer>
  );
}
