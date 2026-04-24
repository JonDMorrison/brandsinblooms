import React, { useMemo, useState } from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  History,
  RefreshCw,
  UserRound,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import {
  JoyTable,
  JoyTableBody,
  JoyTableCell,
  JoyTableHead,
  JoyTableHeaderCell,
  JoyTablePagination,
  JoyTableRow,
} from "@/components/joy/JoyTable";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoySelect } from "@/components/joy/JoySelect";
import { PageContainer } from "@/components/joy/PageContainer";
import {
  usePauseAutomationRun,
  useAutomationRuns,
  type AutomationRun,
} from "@/hooks/useScheduledAutomationTasks";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "paused", label: "Paused" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

export const CRMAutomationExecutionsPage: React.FC = () => {
  const { automationId } = useParams();
  const navigate = useNavigate();
  const pauseRunMutation = usePauseAutomationRun();
  const { data: runs = [], isLoading } = useAutomationRuns({
    automationId,
    limit: 200,
  });
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const filteredRuns = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return runs.filter((run) => {
      if (statusFilter !== "all" && run.status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return [
        run.customer_name,
        run.customer_email,
        run.automation_name,
        run.status,
        JSON.stringify(run.trigger_data ?? {}),
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedSearch),
        );
    });
  }, [runs, search, statusFilter]);

  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(filteredRuns.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pagedRuns = filteredRuns.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const automationName = runs[0]?.automation_name ?? "Automation";

  const retrySelectedRun = async () => {
    if (!selectedRun) {
      return;
    }

    await pauseRunMutation.mutateAsync({
      runId: selectedRun.id,
      action: "resume",
    });
  };

  return (
    <PageContainer fullWidth sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
      <Stack spacing={2.5}>
        <Sheet
          variant="outlined"
          sx={{ p: { xs: 2, md: 2.5 }, borderRadius: "xl" }}
        >
          <Stack
            direction={{ xs: "column", lg: "row" }}
            spacing={2}
            justifyContent="space-between"
          >
            <Stack spacing={1.25}>
              <JoyButton
                component={Link}
                to={
                  automationId
                    ? `/crm/automations/${automationId}`
                    : "/crm/automations"
                }
                variant="plain"
                color="neutral"
                startDecorator={<ArrowLeft size={16} />}
                sx={{ alignSelf: "flex-start", px: 0 }}
              >
                Back to automation
              </JoyButton>
              <Stack direction="row" spacing={1.5} alignItems="flex-start">
                <Avatar variant="soft" color="primary">
                  <History size={18} />
                </Avatar>
                <Box>
                  <Typography level="h2">Execution history</Typography>
                  <Typography
                    level="body-sm"
                    sx={{ color: "neutral.600", mt: 0.5 }}
                  >
                    {automationName} run history, delivery status, and retry
                    controls.
                  </Typography>
                </Box>
              </Stack>
            </Stack>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={1}
              alignItems={{ xs: "stretch", md: "flex-end" }}
            >
              <JoyInput
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search customer, email, trigger data"
                label="Search"
                sx={{ minWidth: { md: 260 } }}
              />
              <JoySelect
                label="Status"
                value={statusFilter}
                options={STATUS_OPTIONS}
                onChange={(_event, value) => {
                  setStatusFilter(value ?? "all");
                  setPage(1);
                }}
                sx={{ minWidth: { md: 180 } }}
              />
            </Stack>
          </Stack>
        </Sheet>

        <Sheet
          variant="outlined"
          sx={{ borderRadius: "xl", overflow: "hidden" }}
        >
          {isLoading ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="center"
              sx={{ py: 8 }}
            >
              <CircularProgress size="sm" />
              <Typography level="body-sm">
                Loading execution history...
              </Typography>
            </Stack>
          ) : (
            <>
              <JoyTable hoverRow>
                <JoyTableHead>
                  <JoyTableRow>
                    <JoyTableHeaderCell>Customer</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Status</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Progress</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Started</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Completed</JoyTableHeaderCell>
                    <JoyTableHeaderCell>Error</JoyTableHeaderCell>
                  </JoyTableRow>
                </JoyTableHead>
                <JoyTableBody>
                  {pagedRuns.map((run) => (
                    <JoyTableRow
                      key={run.id}
                      clickable
                      onClick={() => setSelectedRun(run)}
                    >
                      <JoyTableCell>
                        <Stack spacing={0.25}>
                          <Typography level="title-sm">
                            {run.customer_name || "Unknown customer"}
                          </Typography>
                          <Typography
                            level="body-xs"
                            sx={{ color: "neutral.500" }}
                          >
                            {run.customer_email || "No email"}
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                      <JoyTableCell>
                        <Chip
                          variant="soft"
                          color={statusColor(run.status)}
                          size="sm"
                        >
                          {run.status}
                        </Chip>
                      </JoyTableCell>
                      <JoyTableCell>
                        <Typography level="body-sm">
                          {run.current_step_index}/{run.total_steps}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell>
                        <Typography level="body-sm">
                          {formatDateTime(run.started_at)}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell>
                        <Typography level="body-sm">
                          {run.completed_at
                            ? formatDateTime(run.completed_at)
                            : "In progress"}
                        </Typography>
                      </JoyTableCell>
                      <JoyTableCell>
                        <Typography
                          level="body-sm"
                          sx={{
                            color: run.error_message
                              ? "danger.600"
                              : "neutral.500",
                            maxWidth: 280,
                          }}
                        >
                          {run.error_message || "None"}
                        </Typography>
                      </JoyTableCell>
                    </JoyTableRow>
                  ))}
                  {pagedRuns.length === 0 ? (
                    <JoyTableRow>
                      <JoyTableCell colSpan={6}>
                        <Stack spacing={1} alignItems="center" sx={{ py: 6 }}>
                          <Typography level="title-sm">
                            No executions found
                          </Typography>
                          <Typography
                            level="body-sm"
                            sx={{ color: "neutral.600" }}
                          >
                            Adjust your filters or launch the automation to see
                            execution records here.
                          </Typography>
                        </Stack>
                      </JoyTableCell>
                    </JoyTableRow>
                  ) : null}
                </JoyTableBody>
              </JoyTable>
              <JoyTablePagination
                page={safePage}
                pageSize={pageSize}
                totalCount={filteredRuns.length}
                onPageChange={setPage}
                pageIndexBase={1}
              />
            </>
          )}
        </Sheet>
      </Stack>

      <JoyDrawer
        open={Boolean(selectedRun)}
        onClose={() => setSelectedRun(null)}
        title={selectedRun?.customer_name || "Execution detail"}
        description={
          selectedRun
            ? `Run ${selectedRun.id.slice(0, 8)} • ${selectedRun.status}`
            : undefined
        }
        startDecorator={<UserRound size={18} />}
        size="lg"
      >
        {selectedRun ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip variant="soft" color={statusColor(selectedRun.status)}>
                {selectedRun.status}
              </Chip>
              <Chip variant="soft" color="neutral">
                {selectedRun.current_step_index}/{selectedRun.total_steps} steps
              </Chip>
              <Chip variant="soft" color="neutral">
                Started {formatDateTime(selectedRun.started_at)}
              </Chip>
            </Stack>

            <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "lg" }}>
              <Typography level="title-sm">Step timeline</Typography>
              <Stack spacing={1} sx={{ mt: 1.25 }}>
                {buildTimeline(selectedRun).map((step) => (
                  <Sheet
                    key={step.index}
                    variant="soft"
                    color={step.color}
                    sx={{ p: 1.25, borderRadius: "md" }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.25}
                      alignItems="flex-start"
                    >
                      <Chip size="sm" color={step.color}>
                        {step.index + 1}
                      </Chip>
                      <Box>
                        <Typography level="title-sm">{step.title}</Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "neutral.600" }}
                        >
                          {step.detail}
                        </Typography>
                      </Box>
                    </Stack>
                  </Sheet>
                ))}
              </Stack>
            </Sheet>

            <Sheet variant="outlined" sx={{ p: 1.5, borderRadius: "lg" }}>
              <Typography level="title-sm">Trigger payload</Typography>
              <Typography
                component="pre"
                level="body-xs"
                sx={{
                  mt: 1,
                  p: 1.25,
                  borderRadius: "md",
                  backgroundColor: "neutral.50",
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {JSON.stringify(selectedRun.trigger_data ?? {}, null, 2)}
              </Typography>
            </Sheet>

            {selectedRun.error_message ? (
              <Sheet
                variant="soft"
                color="danger"
                sx={{ p: 1.5, borderRadius: "lg" }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <AlertTriangle size={16} />
                  <Box>
                    <Typography level="title-sm">Failure reason</Typography>
                    <Typography level="body-sm" sx={{ mt: 0.25 }}>
                      {selectedRun.error_message}
                    </Typography>
                  </Box>
                </Stack>
              </Sheet>
            ) : null}

            <Stack direction="row" spacing={1} justifyContent="flex-end">
              {selectedRun.status === "failed" ||
              selectedRun.status === "paused" ? (
                <JoyButton
                  variant="outlined"
                  color="primary"
                  startDecorator={<RefreshCw size={16} />}
                  onClick={() => void retrySelectedRun()}
                  loading={pauseRunMutation.isPending}
                >
                  Retry run
                </JoyButton>
              ) : null}
              <JoyButton
                variant="outlined"
                color="neutral"
                startDecorator={<Clock3 size={16} />}
                onClick={() =>
                  navigate(`/crm/automations/${selectedRun.automation_id}`)
                }
              >
                Open automation
              </JoyButton>
            </Stack>
          </Stack>
        ) : null}
      </JoyDrawer>
    </PageContainer>
  );
};

function statusColor(
  status: AutomationRun["status"],
): "success" | "warning" | "danger" | "neutral" | "primary" {
  switch (status) {
    case "completed":
      return "success";
    case "active":
      return "primary";
    case "paused":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function buildTimeline(run: AutomationRun) {
  const metadataSteps = Array.isArray(run.metadata?.steps)
    ? run.metadata.steps
    : null;

  if (metadataSteps) {
    return metadataSteps.map((step: Record<string, any>, index: number) => ({
      index,
      title: String(step.title || step.type || `Step ${index + 1}`),
      detail: String(step.detail || step.status || "Recorded in run metadata."),
      color:
        step.status === "failed"
          ? "danger"
          : index < run.current_step_index
            ? "success"
            : index === run.current_step_index
              ? "primary"
              : "neutral",
    }));
  }

  return Array.from({ length: Math.max(run.total_steps, 1) }, (_, index) => ({
    index,
    title: `Step ${index + 1}`,
    detail:
      run.status === "failed" && index === run.current_step_index
        ? "Execution failed on this step."
        : index < run.current_step_index
          ? "Completed"
          : index === run.current_step_index
            ? run.status === "completed"
              ? "Completed"
              : "Current step"
            : "Pending",
    color:
      run.status === "failed" && index === run.current_step_index
        ? "danger"
        : index < run.current_step_index || run.status === "completed"
          ? "success"
          : index === run.current_step_index && run.status === "active"
            ? "primary"
            : "neutral",
  }));
}
