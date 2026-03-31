import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Database,
  Download,
  KeyRound,
  Loader2,
  Mail,
  ShieldAlert,
  Users,
  XCircle,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

import { getUserFacingIntegrationError } from "@/components/integrations/integrationDetailModel";
import {
  DetailStatusBadge,
  SectionCard,
} from "@/components/integrations/shared/detailPrimitives";
import type { IntegrationDefinition } from "@/components/integrations/integrationsHubConfig";
import type { MarketingImportDetailData } from "@/hooks/useIntegrationDetailData";
import type { MailchimpImportProgressState } from "@/hooks/useMailchimpImportProgress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

function formatStageLabel(stage?: string | null) {
  if (!stage?.trim()) {
    return "Processing import...";
  }

  return stage;
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

  return Array.from(normalized);
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
    <div className="rounded-2xl border border-border/70 bg-white/80 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-950">{value}</div>
    </div>
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
    <Card className="rounded-[1.5rem] border border-border/70 bg-white/90 p-5 shadow-sm shadow-brand-navy/5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export function MailchimpIntegrationShell({
  item,
  marketingImportDetail,
  importProgress,
  canDisconnect,
  isDisconnecting,
  onDisconnect,
  onOpenConnectDialog,
  onOpenImportDialog,
  onOpenPreviewDialog,
  onDismissImportStatusCard,
}: {
  item: IntegrationDefinition;
  marketingImportDetail: MarketingImportDetailData;
  importProgress?: MailchimpImportProgressState | null;
  canDisconnect: boolean;
  isDisconnecting: boolean;
  onDisconnect: () => Promise<unknown>;
  onOpenConnectDialog: () => void;
  onOpenImportDialog: () => void;
  onOpenPreviewDialog: () => void;
  onDismissImportStatusCard?: (jobId: string) => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectError, setDisconnectError] = useState<string | null>(null);
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
        label: "Account ID",
        value: marketingImportDetail.accountId ?? "Not available",
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
      marketingImportDetail.accountId,
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
      <div className="space-y-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/integrations">Integrations</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Mailchimp</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col gap-4 rounded-[1.75rem] border border-border/70 bg-white/95 p-6 shadow-sm shadow-brand-navy/5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="rounded-[1.25rem] bg-amber-50 p-3 text-amber-700">
              <Icon className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-slate-950">
                Mailchimp
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Connection, import status, cached audience metadata, and
                imported Mailchimp CRM data live on this page.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <DetailStatusBadge
                  label={marketingImportDetail.connectionState.label}
                  tone={marketingImportDetail.connectionState.tone}
                />
                {marketingImportDetail.hasRunningImport ? (
                  <Badge
                    variant="outline"
                    className="gap-1.5 border-sky-200 bg-sky-50 text-sky-700"
                  >
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Syncing
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <div className="text-sm text-muted-foreground lg:text-right">
            <div>{marketingImportDetail.providerDescription}</div>
            <div className="mt-2 font-medium text-slate-700">
              {marketingImportDetail.accountName ??
                "No Mailchimp account connected yet"}
            </div>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={setTab} className="space-y-6">
          <TabsList className="grid h-auto w-full max-w-xl grid-cols-3 rounded-[1.25rem] border border-border/70 bg-white p-1.5 shadow-sm shadow-brand-navy/5">
            <TabsTrigger value="overview" className="rounded-xl">
              Overview
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-xl">
              Sync Logs
            </TabsTrigger>
            <TabsTrigger value="data" className="rounded-xl">
              Imported Data
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {shouldShowImportStatusCard ? (
              <Card className="rounded-[1.5rem] border border-border/70 bg-white/95 p-5 shadow-sm shadow-brand-navy/5">
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {importProgress.isCompleted ? (
                          <Badge className="gap-1.5 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Import Complete
                          </Badge>
                        ) : importProgress.isFailed ? (
                          <Badge className="gap-1.5 bg-rose-100 text-rose-800 hover:bg-rose-100">
                            <XCircle className="h-3.5 w-3.5" />
                            Import Failed
                          </Badge>
                        ) : (
                          <Badge className="gap-1.5 bg-sky-100 text-sky-800 hover:bg-sky-100">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Import Running
                          </Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          Job {importProgress.jobId.slice(0, 8)}
                        </span>
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-slate-950">
                          {importProgress.isCompleted
                            ? "Mailchimp import finished"
                            : importProgress.isFailed
                              ? "Mailchimp import needs attention"
                              : "Mailchimp import in progress"}
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {importProgress.isCompleted
                            ? "The latest Mailchimp import has completed and the final report is ready."
                            : importProgress.isFailed
                              ? "The latest Mailchimp import failed before completion. Review the reported issues or jump to Sync Logs for the focused job."
                              : formatStageLabel(importProgress.currentStage)}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          handleViewSyncLogs(importProgress.jobId!)
                        }
                      >
                        View Sync Logs
                      </Button>
                      {(importProgress.isCompleted ||
                        importProgress.isFailed) &&
                      importProgress.report ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleDownloadReport}
                        >
                          Download Report as JSON
                          <Download className="ml-2 h-4 w-4" />
                        </Button>
                      ) : null}
                      {importProgress.isCompleted || importProgress.isFailed ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleDismissImportCard}
                        >
                          Dismiss
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {!importProgress.isCompleted && !importProgress.isFailed ? (
                    <div className="space-y-3 rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span className="font-medium text-slate-950">
                          {formatStageLabel(importProgress.currentStage)}
                        </span>
                        <span className="font-semibold text-sky-900">
                          {Math.round(importProgress.progressPercentage)}%
                        </span>
                      </div>
                      <Progress
                        value={importProgress.progressPercentage}
                        className="h-2.5"
                      />
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span>
                          Last update{" "}
                          {formatRelativeTimestamp(
                            importProgress.lastUpdatedAt,
                          )}
                        </span>
                        {importProgress.estimatedCompletionAt ? (
                          <span>
                            ETA{" "}
                            {formatExactTimestamp(
                              importProgress.estimatedCompletionAt,
                            )}
                          </span>
                        ) : null}
                      </div>
                      {importProgress.isStale ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="mt-0.5 h-4 w-4" />
                            <div>
                              <p className="font-medium">
                                Progress updates look stale
                              </p>
                              <p>
                                The import is still marked as running, but no
                                update has arrived for over 60 seconds.
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
                  </div>

                  {importProgress.isCompleted ? (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <ImportSummaryStat
                        label="Segments Created"
                        value={formatCount(importReportSummary.segmentsCreated)}
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
                    </div>
                  ) : null}

                  {importErrors.length > 0 ? (
                    <Accordion type="single" collapsible>
                      <AccordionItem
                        value="mailchimp-import-errors"
                        className="rounded-2xl border border-border/70 px-4"
                      >
                        <AccordionTrigger className="text-sm font-medium text-slate-950">
                          Review import issues ({importErrors.length})
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pb-2 text-sm text-muted-foreground">
                            {importErrors.map((error) => (
                              <div
                                key={error}
                                className="rounded-xl border border-rose-100 bg-rose-50/70 px-3 py-2 text-rose-900"
                              >
                                {error}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  ) : null}
                </div>
              </Card>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-4">
              <MetricCard
                icon={Database}
                label="Lists Available"
                value={formatCount(marketingImportDetail.listCount)}
                subtitle={
                  marketingImportDetail.segmentCount > 0
                    ? `${formatCount(marketingImportDetail.segmentCount)} cached segments available`
                    : "Preview lists to refresh cached audience metadata"
                }
              />
              <MetricCard
                icon={Users}
                label="Contacts Imported"
                value={formatCount(
                  marketingImportDetail.contactsImportedAllTime,
                )}
                subtitle={`Across ${formatCount(marketingImportDetail.importJobCount)} completed import job${marketingImportDetail.importJobCount === 1 ? "" : "s"}`}
              />
              <MetricCard
                icon={Clock3}
                label="Last Import"
                value={lastImportValue}
                subtitle={lastImportSubtitle}
              />
              <MetricCard
                icon={KeyRound}
                label="Authorization"
                value={marketingImportDetail.connectionState.label}
                subtitle={marketingImportDetail.connectionState.subtitle}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
              <SectionCard
                title="Connection"
                description="Current Mailchimp authorization state and stored account metadata for this tenant."
              >
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-950">
                        Status
                      </span>
                      <DetailStatusBadge
                        label={marketingImportDetail.connectionState.label}
                        tone={marketingImportDetail.connectionState.tone}
                      />
                      {marketingImportDetail.hasRunningImport ? (
                        <Badge
                          variant="outline"
                          className="gap-1.5 border-sky-200 bg-sky-50 text-sky-700"
                        >
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Import running
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {marketingImportDetail.connectionState.subtitle}
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    {connectionDetails.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-2xl border border-border/70 bg-white/70 px-4 py-3"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                          {row.label}
                        </div>
                        <div className="mt-2 text-sm font-medium text-slate-950">
                          {row.value}
                        </div>
                        {row.description ? (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {row.description}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="Quick Actions"
                description="Mailchimp connection and import actions stay on this page. Use these controls to review cached audiences or start a one-time import without leaving the Mailchimp detail page."
              >
                <div className="space-y-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4">
                  {!isConnected ? (
                    <Button
                      type="button"
                      className="w-full justify-between"
                      onClick={onOpenConnectDialog}
                    >
                      Connect
                      <Mail className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      {marketingImportDetail.hasRunningImport ? (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block">
                                <Button
                                  type="button"
                                  className="w-full justify-between"
                                  disabled
                                >
                                  Import Running
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              An import is already in progress
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <Button
                          type="button"
                          className="w-full justify-between"
                          onClick={onOpenImportDialog}
                        >
                          Start Import
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full justify-between"
                        onClick={onOpenPreviewDialog}
                      >
                        Preview Lists
                        <Database className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </SectionCard>
            </div>

            <SectionCard
              title="Recent Import"
              description="Latest completed Mailchimp import recorded for this tenant."
            >
              {recentImportSummary ? (
                <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-slate-50/70 p-4 text-sm text-slate-950">
                  <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                    <Users className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">
                      {recentImportSummary.contactsImported.toLocaleString()}{" "}
                      contacts imported
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {formatRelativeTimestamp(recentImportSummary.completedAt)}
                      {recentImportSummary.durationSeconds
                        ? ` · ${formatDurationLabel(recentImportSummary.durationSeconds)}`
                        : ""}
                      {recentImportSummary.segmentsCreated > 0
                        ? ` · ${recentImportSummary.segmentsCreated} segments created`
                        : ""}
                      {recentImportSummary.errorCount > 0
                        ? ` · ${recentImportSummary.errorCount} error${recentImportSummary.errorCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">
                  No imports yet
                </p>
              )}
            </SectionCard>

            <SectionCard
              title="Danger Zone"
              description={marketingImportDetail.dangerZone.description}
            >
              <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-rose-900">
                      <ShieldAlert className="h-4 w-4" />
                      {marketingImportDetail.dangerZone.title}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-rose-800/80">
                      {marketingImportDetail.dangerZone.confirmDescription}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
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
                </div>

                <ul className="mt-4 space-y-2 rounded-xl border border-red-100 bg-red-50/40 p-4 text-sm text-slate-900">
                  {marketingImportDetail.dangerZone.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {marketingImportDetail.dangerZone.safetyNote}
                </p>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="logs">
            <SyncLogsTabView
              focusedJobId={focusedJobId}
              isConnected={isConnected}
              onOpenConnectDialog={onOpenConnectDialog}
              onOpenImportDialog={onOpenImportDialog}
            />
          </TabsContent>

          <TabsContent value="data">
            <ImportedDataTabView
              isConnected={isConnected}
              onOpenConnectDialog={onOpenConnectDialog}
              onOpenImportDialog={onOpenImportDialog}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Disconnect {marketingImportDetail.providerLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {marketingImportDetail.dangerZone.confirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <ul className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-4 text-sm text-slate-900">
              {marketingImportDetail.dangerZone.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm leading-6 text-muted-foreground">
              {marketingImportDetail.dangerZone.safetyNote}
            </p>
            {disconnectError ? (
              <p className="text-sm text-destructive">{disconnectError}</p>
            ) : null}
          </div>
          <AlertDialogFooter className="gap-2 sm:justify-between">
            <AlertDialogCancel disabled={isDisconnecting}>
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500"
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
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
