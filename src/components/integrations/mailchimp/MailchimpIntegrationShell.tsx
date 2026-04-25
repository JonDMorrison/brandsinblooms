import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Clock3,
  Database,
  Download,
  KeyRound,
  Mail,
  Pause,
  Play,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";

import Accordion from "@mui/joy/Accordion";
import AccordionDetails from "@mui/joy/AccordionDetails";
import AccordionGroup from "@mui/joy/AccordionGroup";
import AccordionSummary from "@mui/joy/AccordionSummary";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Breadcrumbs from "@mui/joy/Breadcrumbs";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Link from "@mui/joy/Link";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tab from "@mui/joy/Tab";
import { tabClasses } from "@mui/joy/Tab";
import TabList from "@mui/joy/TabList";
import TabPanel from "@mui/joy/TabPanel";
import Tabs from "@mui/joy/Tabs";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";

import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import {
  CardSkeleton,
  SectionCard,
} from "@/components/integrations/shared/detailPrimitives";
import type { IntegrationDefinition } from "@/components/integrations/integrationsHubConfig";
import type { MarketingImportDetailData } from "@/hooks/useIntegrationDetailData";
import type { MailchimpImportProgressState } from "@/hooks/useMailchimpImportProgress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  formatMailchimpErrorMessages,
  formatMailchimpStageLabel,
} from "@/lib/mailchimpPresentation";
import { SyncLogsTabView } from "@/components/integrations/mailchimp/SyncLogsTabView";
import { ImportedDataTabView } from "@/components/integrations/mailchimp/ImportedDataTabView";

type MailchimpShellTab = "overview" | "logs" | "data";

const VALID_TABS: MailchimpShellTab[] = ["overview", "logs", "data"];

function formatRelativeTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return "Not available";
  }

  try {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
  } catch {
    return "Not available";
  }
}

function formatExactTimestamp(timestamp?: string | null) {
  if (!timestamp) {
    return null;
  }

  try {
    return format(new Date(timestamp), "MMM d, yyyy 'at' h:mm a");
  } catch {
    return null;
  }
}

function formatCount(value?: number | null) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "0";
  }

  return value.toLocaleString();
}

function formatDurationLabel(durationSeconds?: number | null) {
  if (typeof durationSeconds !== "number" || Number.isNaN(durationSeconds)) {
    return null;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  if (minutes <= 0) {
    return `${seconds}s`;
  }

  if (seconds === 0) {
    return `${minutes}m`;
  }

  return `${minutes}m ${seconds}s`;
}

function getNumericRecord(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function normalizeReportSummary(report: unknown) {
  const source =
    report && typeof report === "object"
      ? (report as Record<string, unknown>)
      : null;

  return {
    contactsImported: getNumericRecord(source, "contacts_imported"),
    contactsSkipped: getNumericRecord(source, "contacts_skipped"),
    contactsFailed: getNumericRecord(source, "contacts_failed"),
    segmentsCreated: getNumericRecord(source, "segments_created"),
    tagsCreated: getNumericRecord(source, "tags_created"),
    consentsRecorded: getNumericRecord(source, "consents_recorded"),
    batchesProcessed: getNumericRecord(source, "batches_processed"),
  };
}

function normalizeErrorMessages(
  errorDetails: unknown,
  batchStats: Record<string, unknown> | null,
) {
  const normalized = new Set<string>();

  if (typeof errorDetails === "string" && errorDetails.trim()) {
    normalized.add(errorDetails);
  }

  if (Array.isArray(errorDetails)) {
    for (const detail of errorDetails) {
      if (typeof detail === "string" && detail.trim()) {
        normalized.add(detail);
        continue;
      }

      if (!detail || typeof detail !== "object") {
        continue;
      }

      const message =
        typeof (detail as Record<string, unknown>).message === "string"
          ? ((detail as Record<string, unknown>).message as string)
          : typeof (detail as Record<string, unknown>).error === "string"
            ? ((detail as Record<string, unknown>).error as string)
            : null;

      if (message?.trim()) {
        normalized.add(message);
      }
    }
  }

  const batchErrors = batchStats?.errors;
  if (Array.isArray(batchErrors)) {
    for (const entry of batchErrors) {
      if (typeof entry === "string" && entry.trim()) {
        normalized.add(entry);
      }
    }
  }

  return formatMailchimpErrorMessages(Array.from(normalized));
}

function downloadImportReport(progress: MailchimpImportProgressState) {
  if (!progress.jobId) {
    return;
  }

  const reportData = {
    jobId: progress.jobId,
    status: progress.status,
    generatedAt: new Date().toISOString(),
    lastUpdatedAt: progress.lastUpdatedAt,
    report: progress.report,
    batchStats: progress.batchStats,
    errorDetails: progress.errorDetails,
  };

  const blob = new Blob([JSON.stringify(reportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mailchimp-import-report-${progress.jobId}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function ImportSummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <Sheet
      variant="soft"
      color="neutral"
      sx={{ borderRadius: "lg", px: 2, py: 1.5 }}
    >
      <Typography
        level="body-xs"
        sx={{
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "text.tertiary",
          mb: 0.5,
        }}
      >
        {label}
      </Typography>
      <Typography level="title-md">{value}</Typography>
    </Sheet>
  );
}

function isValidTab(value: string | null): value is MailchimpShellTab {
  return VALID_TABS.includes(value as MailchimpShellTab);
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subtitle,
}: {
  icon: typeof Database;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Sheet variant="soft" color="neutral" sx={{ borderRadius: "xl", p: 2.5 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
      >
        <Box>
          <Typography
            level="body-xs"
            sx={{
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "text.tertiary",
            }}
          >
            {label}
          </Typography>
          <Typography level="h4" sx={{ mt: 1 }}>
            {value}
          </Typography>
          <Typography level="body-xs" sx={{ color: "text.secondary", mt: 0.5 }}>
            {subtitle}
          </Typography>
        </Box>
        <Sheet
          variant="plain"
          sx={{
            borderRadius: "lg",
            p: 1,
            background: "transparent",
            color: "text.secondary",
          }}
        >
          <Icon size={20} />
        </Sheet>
      </Stack>
    </Sheet>
  );
}

export function MailchimpIntegrationShell({
  item,
  marketingImportDetail,
  importProgress,
  isRefreshingOverview = false,
  canDisconnect,
  isDisconnecting,
  onDisconnect,
  onOpenConnectDialog,
  onOpenImportDialog,
  onOpenPreviewDialog,
  onRefreshImportState,
  onDismissImportStatusCard,
}: {
  item: IntegrationDefinition;
  marketingImportDetail: MarketingImportDetailData;
  importProgress?: MailchimpImportProgressState | null;
  isRefreshingOverview?: boolean;
  canDisconnect: boolean;
  isDisconnecting: boolean;
  onDisconnect: () => Promise<unknown>;
  onOpenConnectDialog: () => void;
  onOpenImportDialog: () => void;
  onOpenPreviewDialog: () => void;
  onRefreshImportState?: (jobId?: string | null) => Promise<void>;
  onDismissImportStatusCard?: (jobId: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
  const [isControllingImport, setIsControllingImport] = useState(false);
  const [cancelImportOpen, setCancelImportOpen] = useState(false);
  const { toast } = useToast();
  const currentTab = isValidTab(searchParams.get("tab"))
    ? (searchParams.get("tab") as MailchimpShellTab)
    : "overview";
  const focusedJobId = searchParams.get("job");
  const Icon = item.icon;
  const isConnected = marketingImportDetail.connectionStatus === "connected";
  const connectionDetails = useMemo(
    () => [
      {
        label: "Mailchimp account",
        value: marketingImportDetail.accountName ?? "Not available",
      },
      {
        label: "Connected",
        value: isConnected
          ? formatRelativeTimestamp(marketingImportDetail.connectedAt)
          : "Not connected",
        description: isConnected
          ? formatExactTimestamp(marketingImportDetail.connectedAt)
          : undefined,
      },
    ],
    [
      isConnected,
      marketingImportDetail.accountName,
      marketingImportDetail.connectedAt,
    ],
  );
  const recentImportSummary = marketingImportDetail.latestCompletedImport;
  const lastImportValue = marketingImportDetail.latestImportCompletedAt
    ? formatRelativeTimestamp(marketingImportDetail.latestImportCompletedAt)
    : "Not started";
  const lastImportSubtitle = marketingImportDetail.latestImportCompletedAt
    ? marketingImportDetail.latestImportSummary
    : marketingImportDetail.hasRunningImport
      ? "A Mailchimp import is currently running"
      : "No completed import recorded yet";
  const importReportSummary = useMemo(
    () => normalizeReportSummary(importProgress?.report),
    [importProgress?.report],
  );
  const shouldShowImportStatusCard = Boolean(
    importProgress?.jobId &&
    (importProgress.isRunning ||
      importProgress.isPaused ||
      importProgress.isCompleted ||
      importProgress.isFailed),
  );
  const importErrors = useMemo(
    () =>
      normalizeErrorMessages(
        importProgress?.errorDetails,
        importProgress?.batchStats ?? null,
      ),
    [importProgress?.batchStats, importProgress?.errorDetails],
  );

  useEffect(() => {
    if (!disconnectOpen) {
      setDisconnectError(null);
    }
  }, [disconnectOpen]);

  const setTab = (nextTab: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", nextTab);
    setSearchParams(nextParams);
  };
  const handleViewSyncLogs = useCallback(
    (jobId: string) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("tab", "logs");
      nextParams.set("job", jobId);
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams],
  );
  const handleDownloadReport = useCallback(() => {
    if (importProgress?.jobId) {
      downloadImportReport(importProgress);
    }
  }, [importProgress]);
  const handleDismissImportCard = useCallback(() => {
    if (importProgress?.jobId) {
      onDismissImportStatusCard?.(importProgress.jobId);
    }
  }, [importProgress, onDismissImportStatusCard]);
  const refreshMailchimpImportState = useCallback(
    async (jobId?: string | null) => {
      await importProgress?.refetch?.();

      if (onRefreshImportState) {
        await onRefreshImportState(jobId ?? importProgress?.jobId ?? null);
      }
    },
    [importProgress, onRefreshImportState],
  );
  const handlePauseImport = useCallback(async () => {
    if (!importProgress?.jobId || isControllingImport) {
      return;
    }

    setIsControllingImport(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-import",
        {
          body: { jobId: importProgress.jobId, action: "pause" },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      await refreshMailchimpImportState(importProgress.jobId);
      toast({
        title: "Mailchimp import paused",
        description:
          "The current import will stop after the active batch checkpoint.",
      });
    } catch (error) {
      toast({
        title: "Could not pause Mailchimp import",
        description: getUserFacingIntegrationError(
          error,
          "Mailchimp import could not be paused. Try again in a moment.",
        ),
        variant: "destructive",
      });
    } finally {
      setIsControllingImport(false);
    }
  }, [importProgress, isControllingImport, refreshMailchimpImportState, toast]);
  const handleResumeImport = useCallback(async () => {
    if (!importProgress?.jobId || isControllingImport) {
      return;
    }

    setIsControllingImport(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-import",
        {
          body: { jobId: importProgress.jobId },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      await refreshMailchimpImportState(importProgress.jobId);
      toast({
        title: "Mailchimp import resumed",
        description: "The paused import is running again.",
      });
    } catch (error) {
      toast({
        title: "Could not resume Mailchimp import",
        description: getUserFacingIntegrationError(
          error,
          "Mailchimp import could not be resumed. Try again in a moment.",
        ),
        variant: "destructive",
      });
    } finally {
      setIsControllingImport(false);
    }
  }, [importProgress, isControllingImport, refreshMailchimpImportState, toast]);
  const handleCancelImport = useCallback(async () => {
    if (!importProgress?.jobId || isControllingImport) {
      return;
    }

    setIsControllingImport(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "mailchimp-import",
        {
          body: { jobId: importProgress.jobId, action: "cancel" },
        },
      );

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      setCancelImportOpen(false);
      await refreshMailchimpImportState(importProgress.jobId);
      toast({
        title: "Mailchimp import cancelled",
        description:
          "The active Mailchimp import has been cleared from the running queue.",
      });
    } catch (error) {
      toast({
        title: "Could not cancel Mailchimp import",
        description: getUserFacingIntegrationError(
          error,
          "Mailchimp import could not be cancelled. Try again in a moment.",
        ),
        variant: "destructive",
      });
    } finally {
      setIsControllingImport(false);
    }
  }, [importProgress, isControllingImport, refreshMailchimpImportState, toast]);

  const handleDisconnectConfirm = async () => {
    setDisconnectError(null);

    try {
      await onDisconnect();
      setDisconnectOpen(false);
    } catch (error) {
      setDisconnectError(
        getUserFacingIntegrationError(
          error,
          "Mailchimp could not be disconnected. Retry or cancel and try again later.",
        ),
      );
    }
  };

  return (
    <>
      <Stack spacing={3}>
        <Breadcrumbs aria-label="breadcrumbs" size="sm" sx={{ px: 0 }}>
          <Link component={RouterLink} to="/integrations" level="body-sm">
            Integrations
          </Link>
          <Typography level="body-sm">Mailchimp</Typography>
        </Breadcrumbs>

        <Sheet
          variant="outlined"
          sx={{
            borderRadius: "xl",
            p: { xs: 2.5, md: 3 },
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { md: "flex-start" },
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Stack direction="row" spacing={2} alignItems="flex-start">
            <Sheet
              variant="soft"
              color="warning"
              sx={{
                borderRadius: "lg",
                p: 1.25,
                display: "inline-flex",
                flexShrink: 0,
              }}
            >
              <Icon style={{ width: 28, height: 28 }} />
            </Sheet>
            <Box>
              <Typography level="h4">Mailchimp</Typography>
              <Typography
                level="body-sm"
                sx={{ color: "text.secondary", mt: 0.5, maxWidth: 480 }}
              >
                Connect Mailchimp, review import progress, and manage the
                contacts you have already brought into BloomSuite.
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ mt: 1.5, flexWrap: "wrap" }}
              >
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    marketingImportDetail.connectionState.tone === "success"
                      ? "success"
                      : marketingImportDetail.connectionState.tone === "danger"
                        ? "danger"
                        : marketingImportDetail.connectionState.tone ===
                            "warning"
                          ? "warning"
                          : "neutral"
                  }
                >
                  {marketingImportDetail.connectionState.label}
                </Chip>
              </Stack>
            </Box>
          </Stack>
          <Box sx={{ textAlign: { md: "right" } }}>
            <Typography level="body-sm" sx={{ color: "text.secondary" }}>
              {marketingImportDetail.providerDescription}
            </Typography>
            <Typography
              level="body-sm"
              fontWeight="lg"
              sx={{ color: "text.primary", mt: 0.5 }}
            >
              {marketingImportDetail.accountName ??
                "No Mailchimp account connected yet"}
            </Typography>
          </Box>
        </Sheet>

        <Tabs
          value={currentTab}
          onChange={(_, val) => val && setTab(val as string)}
          sx={{ bgcolor: "transparent" }}
        >
          <TabList
            disableUnderline
            sx={{
              p: 0.5,
              gap: 0.5,
              borderRadius: "xl",
              bgcolor: "background.level1",
              maxWidth: "max-content",
              [`& .${tabClasses.root}[aria-selected=\"true\"]`]: {
                boxShadow: "sm",
                bgcolor: "background.surface",
              },
            }}
          >
            <Tab
              disableIndicator
              value="overview"
              sx={{
                fontWeight: "md",
                fontSize: "sm",
                px: 2,
                py: 0.75,
                borderRadius: "lg",
                color: "text.tertiary",
                [`&.${tabClasses.selected}`]: {
                  color: "text.primary",
                  fontWeight: "lg",
                },
              }}
            >
              Overview
            </Tab>
            <Tab
              disableIndicator
              value="logs"
              sx={{
                fontWeight: "md",
                fontSize: "sm",
                px: 2,
                py: 0.75,
                borderRadius: "lg",
                color: "text.tertiary",
                [`&.${tabClasses.selected}`]: {
                  color: "text.primary",
                  fontWeight: "lg",
                },
              }}
            >
              Sync Logs
            </Tab>
            <Tab
              disableIndicator
              value="data"
              sx={{
                fontWeight: "md",
                fontSize: "sm",
                px: 2,
                py: 0.75,
                borderRadius: "lg",
                color: "text.tertiary",
                [`&.${tabClasses.selected}`]: {
                  color: "text.primary",
                  fontWeight: "lg",
                },
              }}
            >
              Imported Data
            </Tab>
          </TabList>

          <TabPanel value="overview" sx={{ px: 0, pt: 3 }}>
            <Stack spacing={2.5}>
              {shouldShowImportStatusCard ? (
                <Sheet
                  variant="outlined"
                  sx={{ borderRadius: "xl", p: { xs: 2, md: 2.5 } }}
                >
                  <Stack spacing={2.5}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      justifyContent="space-between"
                      alignItems={{ md: "flex-start" }}
                    >
                      <Stack spacing={1}>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{ flexWrap: "wrap" }}
                        >
                          {importProgress.isCompleted ? (
                            <Chip size="sm" variant="soft" color="success">
                              Import Complete
                            </Chip>
                          ) : importProgress.isPaused ? (
                            <Chip size="sm" variant="soft" color="neutral">
                              Import Paused
                            </Chip>
                          ) : importProgress.isFailed ? (
                            <Chip size="sm" variant="soft" color="danger">
                              Import Failed
                            </Chip>
                          ) : (
                            <Chip size="sm" variant="soft" color="primary">
                              Import Running
                            </Chip>
                          )}
                        </Stack>
                        <Typography level="title-lg">
                          {importProgress.isCompleted
                            ? "Mailchimp import finished"
                            : importProgress.isPaused
                              ? "Mailchimp import paused"
                              : importProgress.isFailed
                                ? "Mailchimp import needs attention"
                                : "Mailchimp import in progress"}
                        </Typography>
                        <Typography
                          level="body-sm"
                          sx={{ color: "text.secondary" }}
                        >
                          {importProgress.isCompleted
                            ? "The latest Mailchimp import has completed and the final report is ready."
                            : importProgress.isPaused
                              ? "The latest Mailchimp import is paused. Resume it when you are ready or cancel it to clear the active run."
                              : importProgress.isFailed
                                ? "The latest Mailchimp import failed before completion. Review the reported issues or jump to Sync Logs for the focused job."
                                : formatMailchimpStageLabel(
                                    importProgress.currentStage,
                                  )}
                        </Typography>
                      </Stack>

                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flexWrap: "wrap" }}
                      >
                        <Button
                          size="sm"
                          variant="outlined"
                          color="neutral"
                          onClick={() =>
                            handleViewSyncLogs(importProgress.jobId!)
                          }
                        >
                          View Sync Logs
                        </Button>
                        {importProgress.isPaused ? (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={() => void handleResumeImport()}
                            disabled={isControllingImport}
                            startDecorator={
                              isControllingImport ? (
                                <CircularProgress size="sm" />
                              ) : (
                                <Play size={14} />
                              )
                            }
                          >
                            Resume Import
                          </Button>
                        ) : null}
                        {importProgress.isRunning ? (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={() => void handlePauseImport()}
                            disabled={isControllingImport}
                            startDecorator={
                              isControllingImport ? (
                                <CircularProgress size="sm" />
                              ) : (
                                <Pause size={14} />
                              )
                            }
                          >
                            Pause Import
                          </Button>
                        ) : null}
                        {importProgress.isRunning || importProgress.isPaused ? (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={() => setCancelImportOpen(true)}
                            disabled={isControllingImport}
                            startDecorator={<Trash2 size={14} />}
                          >
                            Cancel Import
                          </Button>
                        ) : null}
                        {(importProgress.isCompleted ||
                          importProgress.isFailed) &&
                        importProgress.report ? (
                          <Button
                            size="sm"
                            variant="outlined"
                            color="neutral"
                            onClick={handleDownloadReport}
                            endDecorator={<Download size={14} />}
                          >
                            Download Report
                          </Button>
                        ) : null}
                        {importProgress.isCompleted ||
                        importProgress.isFailed ? (
                          <Button
                            size="sm"
                            variant="plain"
                            color="neutral"
                            onClick={handleDismissImportCard}
                          >
                            Dismiss
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>

                    {!importProgress.isCompleted &&
                    !importProgress.isFailed &&
                    !importProgress.isPaused ? (
                      <Sheet
                        variant="soft"
                        color="primary"
                        sx={{ borderRadius: "lg", p: 2 }}
                      >
                        <Stack spacing={1.5}>
                          <Stack
                            direction="row"
                            justifyContent="space-between"
                            alignItems="center"
                          >
                            <Typography level="body-sm" fontWeight="lg">
                              {formatMailchimpStageLabel(
                                importProgress.currentStage,
                              )}
                            </Typography>
                            <Typography level="body-sm" fontWeight="lg">
                              {Math.round(importProgress.progressPercentage)}%
                            </Typography>
                          </Stack>
                          <LinearProgress
                            determinate
                            value={importProgress.progressPercentage}
                            size="lg"
                            sx={{ borderRadius: "sm" }}
                          />
                          <Stack
                            direction="row"
                            spacing={2}
                            sx={{ flexWrap: "wrap" }}
                          >
                            <Typography
                              level="body-xs"
                              sx={{ color: "text.secondary" }}
                            >
                              Updated{" "}
                              {formatRelativeTimestamp(
                                importProgress.lastUpdatedAt,
                              )}
                            </Typography>
                            {importProgress.estimatedCompletionAt ? (
                              <Typography
                                level="body-xs"
                                sx={{ color: "text.secondary" }}
                              >
                                ETA{" "}
                                {formatExactTimestamp(
                                  importProgress.estimatedCompletionAt,
                                )}
                              </Typography>
                            ) : null}
                          </Stack>
                          {importProgress.isStale ? (
                            <Alert
                              size="sm"
                              color="warning"
                              variant="soft"
                              startDecorator={<AlertTriangle size={16} />}
                            >
                              Progress updates look stale — the import is still
                              marked as running but no update has arrived for
                              over 60 seconds.
                            </Alert>
                          ) : null}
                        </Stack>
                      </Sheet>
                    ) : null}

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: {
                          xs: "1fr 1fr",
                          md: "repeat(4, 1fr)",
                        },
                        gap: 1.5,
                      }}
                    >
                      <ImportSummaryStat
                        label="Fetched"
                        value={formatCount(importProgress.fetchedRows)}
                      />
                      <ImportSummaryStat
                        label="Imported"
                        value={formatCount(
                          importProgress.isCompleted || importProgress.isFailed
                            ? importReportSummary.contactsImported ||
                                importProgress.insertedRows
                            : importProgress.insertedRows,
                        )}
                      />
                      <ImportSummaryStat
                        label="Skipped"
                        value={formatCount(
                          importProgress.isCompleted || importProgress.isFailed
                            ? importReportSummary.contactsSkipped ||
                                importProgress.skippedRows
                            : importProgress.skippedRows,
                        )}
                      />
                      <ImportSummaryStat
                        label="Failed"
                        value={formatCount(
                          importProgress.isCompleted || importProgress.isFailed
                            ? importReportSummary.contactsFailed ||
                                importProgress.failedRows
                            : importProgress.failedRows,
                        )}
                      />
                    </Box>

                    {importProgress.isCompleted ? (
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: {
                            xs: "1fr 1fr",
                            md: "repeat(4, 1fr)",
                          },
                          gap: 1.5,
                        }}
                      >
                        <ImportSummaryStat
                          label="Segments Created"
                          value={formatCount(
                            importReportSummary.segmentsCreated,
                          )}
                        />
                        <ImportSummaryStat
                          label="Tags Created"
                          value={formatCount(importReportSummary.tagsCreated)}
                        />
                        <ImportSummaryStat
                          label="Consents Recorded"
                          value={formatCount(
                            importReportSummary.consentsRecorded,
                          )}
                        />
                        <ImportSummaryStat
                          label="Batches Processed"
                          value={formatCount(
                            importReportSummary.batchesProcessed,
                          )}
                        />
                      </Box>
                    ) : null}

                    {importErrors.length > 0 ? (
                      <AccordionGroup>
                        <Accordion>
                          <AccordionSummary>
                            <Typography level="body-sm" fontWeight="lg">
                              Review import issues ({importErrors.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1} sx={{ pt: 1 }}>
                              {importErrors.map((error) => (
                                <Alert
                                  key={error}
                                  size="sm"
                                  color="danger"
                                  variant="soft"
                                >
                                  {error}
                                </Alert>
                              ))}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      </AccordionGroup>
                    ) : null}
                  </Stack>
                </Sheet>
              ) : null}

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
                  gap: 2,
                }}
              >
                {isRefreshingOverview ? (
                  <>
                    <CardSkeleton titleWidth="120px" rows={2} />
                    <CardSkeleton titleWidth="150px" rows={2} />
                    <CardSkeleton titleWidth="110px" rows={2} />
                    <CardSkeleton titleWidth="100px" rows={2} />
                  </>
                ) : (
                  <>
                    <MetricCard
                      icon={Database}
                      label="Lists Available"
                      value={formatCount(marketingImportDetail.listCount)}
                      subtitle={
                        marketingImportDetail.segmentCount > 0
                          ? `${formatCount(marketingImportDetail.segmentCount)} audience segments available`
                          : "Preview lists to refresh available Mailchimp audiences"
                      }
                    />
                    <MetricCard
                      icon={Users}
                      label="Contacts Imported"
                      value={formatCount(
                        marketingImportDetail.contactsImportedAllTime,
                      )}
                      subtitle={`Across ${formatCount(marketingImportDetail.importJobCount)} completed import${marketingImportDetail.importJobCount === 1 ? "" : "s"}`}
                    />
                    <MetricCard
                      icon={Clock3}
                      label="Last Import"
                      value={lastImportValue}
                      subtitle={lastImportSubtitle}
                    />
                    <MetricCard
                      icon={KeyRound}
                      label="Connection"
                      value={marketingImportDetail.connectionState.label}
                      subtitle={marketingImportDetail.connectionState.subtitle}
                    />
                  </>
                )}
              </Box>

              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: {
                    xs: "1fr",
                    xl: "minmax(0,1.1fr) minmax(320px,0.9fr)",
                  },
                  gap: 3,
                }}
              >
                <SectionCard
                  title="Connection"
                  description="Current Mailchimp connection status for this workspace."
                >
                  {isRefreshingOverview ? (
                    <Stack spacing={1.5}>
                      <CardSkeleton titleWidth="88px" rows={2} />
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: 1.5,
                        }}
                      >
                        <CardSkeleton titleWidth="140px" rows={2} />
                        <CardSkeleton titleWidth="120px" rows={2} />
                      </Box>
                    </Stack>
                  ) : (
                    <Stack spacing={2}>
                      <Sheet
                        variant="soft"
                        color="neutral"
                        sx={{ borderRadius: "lg", p: 2 }}
                      >
                        <Stack
                          direction="row"
                          spacing={1}
                          alignItems="center"
                          sx={{ flexWrap: "wrap" }}
                        >
                          <Typography level="body-sm" fontWeight="lg">
                            Status
                          </Typography>
                          <Chip
                            size="sm"
                            variant="soft"
                            color={
                              marketingImportDetail.connectionState.tone ===
                              "success"
                                ? "success"
                                : marketingImportDetail.connectionState.tone ===
                                    "danger"
                                  ? "danger"
                                  : marketingImportDetail.connectionState
                                        .tone === "warning"
                                    ? "warning"
                                    : "neutral"
                            }
                          >
                            {marketingImportDetail.connectionState.label}
                          </Chip>
                        </Stack>
                        <Typography
                          level="body-sm"
                          sx={{ color: "text.secondary", mt: 1 }}
                        >
                          {marketingImportDetail.connectionState.subtitle}
                        </Typography>
                      </Sheet>

                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                          gap: 1.5,
                        }}
                      >
                        {connectionDetails.map((row) => (
                          <Sheet
                            key={row.label}
                            variant="outlined"
                            sx={{ borderRadius: "lg", px: 2, py: 1.5 }}
                          >
                            <Typography
                              level="body-xs"
                              fontWeight="lg"
                              sx={{
                                textTransform: "uppercase",
                                letterSpacing: "0.12em",
                                color: "text.tertiary",
                              }}
                            >
                              {row.label}
                            </Typography>
                            <Typography
                              level="body-sm"
                              fontWeight="lg"
                              sx={{ mt: 0.5, color: "text.primary" }}
                            >
                              {row.value}
                            </Typography>
                            {row.description ? (
                              <Typography
                                level="body-xs"
                                sx={{ mt: 0.5, color: "text.secondary" }}
                              >
                                {row.description}
                              </Typography>
                            ) : null}
                          </Sheet>
                        ))}
                      </Box>
                    </Stack>
                  )}
                </SectionCard>

                <SectionCard
                  title="Quick Actions"
                  description="Mailchimp connection and import actions stay on this page. Use these controls to review cached audiences or start a one-time import without leaving the Mailchimp detail page."
                >
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{ borderRadius: "lg", p: 2 }}
                  >
                    <Stack spacing={1}>
                      {!isConnected ? (
                        <Button
                          fullWidth
                          onClick={onOpenConnectDialog}
                          endDecorator={<Mail size={16} />}
                        >
                          Connect
                        </Button>
                      ) : (
                        <>
                          {marketingImportDetail.hasRunningImport ? (
                            <Tooltip title="An import is already in progress">
                              <span style={{ display: "block" }}>
                                <Button
                                  fullWidth
                                  disabled
                                  endDecorator={<CircularProgress size="sm" />}
                                >
                                  Import Running
                                </Button>
                              </span>
                            </Tooltip>
                          ) : (
                            <Button
                              fullWidth
                              onClick={onOpenImportDialog}
                              endDecorator={<Users size={16} />}
                            >
                              Start Import
                            </Button>
                          )}
                          <Button
                            fullWidth
                            variant="outlined"
                            color="neutral"
                            onClick={onOpenPreviewDialog}
                            endDecorator={<Database size={16} />}
                          >
                            Preview Lists
                          </Button>
                        </>
                      )}
                    </Stack>
                  </Sheet>
                </SectionCard>
              </Box>

              <SectionCard
                title="Recent Import"
                description="Summary of the most recent completed Mailchimp import."
              >
                {isRefreshingOverview ? (
                  <CardSkeleton titleWidth="130px" rows={3} />
                ) : recentImportSummary ? (
                  <Sheet
                    variant="soft"
                    color="neutral"
                    sx={{ borderRadius: "lg", p: 2 }}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                    >
                      <Sheet
                        variant="soft"
                        color="success"
                        sx={{
                          borderRadius: "50%",
                          p: 1,
                          display: "inline-flex",
                          flexShrink: 0,
                        }}
                      >
                        <Users size={16} />
                      </Sheet>
                      <Box>
                        <Typography level="body-sm" fontWeight="lg">
                          {recentImportSummary.contactsImported.toLocaleString()}{" "}
                          contacts imported
                        </Typography>
                        <Typography
                          level="body-xs"
                          sx={{ color: "text.secondary", mt: 0.5 }}
                        >
                          {formatRelativeTimestamp(
                            recentImportSummary.completedAt,
                          )}
                          {recentImportSummary.durationSeconds
                            ? ` · ${formatDurationLabel(recentImportSummary.durationSeconds)}`
                            : ""}
                          {recentImportSummary.segmentsCreated > 0
                            ? ` · ${recentImportSummary.segmentsCreated} segments created`
                            : ""}
                          {recentImportSummary.errorCount > 0
                            ? ` · ${recentImportSummary.errorCount} error${recentImportSummary.errorCount === 1 ? "" : "s"}`
                            : ""}
                        </Typography>
                      </Box>
                    </Stack>
                  </Sheet>
                ) : (
                  <Typography
                    level="body-sm"
                    sx={{ fontStyle: "italic", color: "text.secondary" }}
                  >
                    No imports yet
                  </Typography>
                )}
              </SectionCard>

              <SectionCard
                title="Danger Zone"
                description={marketingImportDetail.dangerZone.description}
              >
                <Alert
                  color="danger"
                  variant="soft"
                  sx={{
                    borderRadius: "lg",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 2,
                  }}
                >
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    justifyContent="space-between"
                    alignItems={{ md: "flex-start" }}
                    sx={{ width: "100%" }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <ShieldAlert size={16} />
                        <Typography
                          level="body-sm"
                          fontWeight="lg"
                          color="danger"
                        >
                          {marketingImportDetail.dangerZone.title}
                        </Typography>
                      </Stack>
                      <Typography
                        level="body-sm"
                        sx={{ mt: 1, color: "danger.700" }}
                      >
                        {marketingImportDetail.dangerZone.confirmDescription}
                      </Typography>
                    </Box>
                    <Button
                      color="danger"
                      variant="outlined"
                      size="sm"
                      disabled={
                        !marketingImportDetail.connectionId ||
                        !canDisconnect ||
                        isDisconnecting
                      }
                      onClick={() => setDisconnectOpen(true)}
                    >
                      {isDisconnecting
                        ? "Disconnecting..."
                        : marketingImportDetail.dangerZone.title}
                    </Button>
                  </Stack>

                  <Stack
                    component="ul"
                    spacing={1}
                    sx={{ m: 0, pl: 0, listStyle: "none", width: "100%" }}
                  >
                    {marketingImportDetail.dangerZone.bullets.map((bullet) => (
                      <Stack
                        component="li"
                        key={bullet}
                        direction="row"
                        spacing={1}
                        alignItems="flex-start"
                      >
                        <AlertTriangle
                          size={14}
                          style={{ marginTop: 3, flexShrink: 0 }}
                        />
                        <Typography level="body-xs">{bullet}</Typography>
                      </Stack>
                    ))}
                  </Stack>

                  <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                    {marketingImportDetail.dangerZone.safetyNote}
                  </Typography>
                </Alert>
              </SectionCard>
            </Stack>
          </TabPanel>

          <TabPanel value="logs" sx={{ px: 0, pt: 3 }}>
            <SyncLogsTabView
              focusedJobId={focusedJobId}
              isConnected={isConnected}
              onOpenConnectDialog={onOpenConnectDialog}
              onOpenImportDialog={onOpenImportDialog}
            />
          </TabPanel>

          <TabPanel value="data" sx={{ px: 0, pt: 3 }}>
            <ImportedDataTabView
              isConnected={isConnected}
              onOpenConnectDialog={onOpenConnectDialog}
              onOpenImportDialog={onOpenImportDialog}
            />
          </TabPanel>
        </Tabs>
      </Stack>

      <Modal open={disconnectOpen} onClose={() => setDisconnectOpen(false)}>
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{ maxWidth: 480 }}
        >
          <DialogTitle>
            Disconnect {marketingImportDetail.providerLabel}?
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Typography level="body-sm">
                {marketingImportDetail.dangerZone.confirmDescription}
              </Typography>
              <Stack
                component="ul"
                spacing={1}
                sx={{ m: 0, pl: 0, listStyle: "none" }}
              >
                {marketingImportDetail.dangerZone.bullets.map((bullet) => (
                  <Stack
                    component="li"
                    key={bullet}
                    direction="row"
                    spacing={1}
                    alignItems="flex-start"
                  >
                    <AlertTriangle
                      size={14}
                      style={{ marginTop: 3, flexShrink: 0 }}
                    />
                    <Typography level="body-xs">{bullet}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Typography level="body-xs" sx={{ color: "text.secondary" }}>
                {marketingImportDetail.dangerZone.safetyNote}
              </Typography>
              {disconnectError ? (
                <Alert size="sm" color="danger" variant="soft">
                  {disconnectError}
                </Alert>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              color="neutral"
              disabled={isDisconnecting}
              onClick={() => setDisconnectOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              disabled={
                isDisconnecting ||
                !marketingImportDetail.connectionId ||
                !canDisconnect
              }
              onClick={() => void handleDisconnectConfirm()}
            >
              {isDisconnecting
                ? "Disconnecting..."
                : disconnectError
                  ? "Retry"
                  : marketingImportDetail.dangerZone.title}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      <Modal open={cancelImportOpen} onClose={() => setCancelImportOpen(false)}>
        <ModalDialog
          variant="outlined"
          role="alertdialog"
          sx={{ maxWidth: 440 }}
        >
          <DialogTitle>Cancel Mailchimp import?</DialogTitle>
          <DialogContent>
            <Typography level="body-sm">
              This stops the current Mailchimp import and clears it from the
              active progress card. Completed rows stay imported; unfinished
              batches will not continue.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button
              variant="outlined"
              color="neutral"
              disabled={isControllingImport}
              onClick={() => setCancelImportOpen(false)}
            >
              Keep Import
            </Button>
            <Button
              color="danger"
              disabled={isControllingImport}
              onClick={(event) => {
                event.preventDefault();
                void handleCancelImport();
              }}
            >
              {isControllingImport ? "Cancelling..." : "Cancel Import"}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
}
