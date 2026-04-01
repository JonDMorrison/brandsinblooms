import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import {
  formatMailchimpErrorMessages,
  formatMailchimpStageLabel,
  isMailchimpConnectionIssueMessage,
  resolveMailchimpSelectionName,
  summarizeMailchimpSelections,
} from "@/lib/mailchimpPresentation";

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 3000;
const MAILCHIMP_SYNC_LOGS_SELECT =
  "id, status, config, report, completed_at, created_at, updated_at, progress_percentage, current_stage, estimated_completion_at, error_details, batch_stats";

export type MailchimpSyncLogsStatusFilter =
  | "all"
  | "pending"
  | "running"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed";

export type MailchimpSyncLogsDatePreset = "7d" | "30d" | "all";

type MailchimpImportJobStatus =
  | "pending"
  | "running"
  | "paused"
  | "cancelled"
  | "completed"
  | "failed";

type MailchimpImportJobRow = {
  id: string;
  status: string | null;
  config: unknown;
  report: unknown;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  progress_percentage: number | null;
  current_stage: string | null;
  estimated_completion_at: string | null;
  error_details: unknown;
  batch_stats: unknown;
};

type MailchimpArtifactRow = {
  artifact_type: string;
  external_id: string;
  name: string | null;
  data: unknown;
};

type ResolvedSelection = {
  id: string;
  name: string;
};

type TimelineState = "complete" | "current" | "pending" | "failed";

export type MailchimpSyncLogTimelineEntry = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  state: TimelineState;
  derived: boolean;
};

export type MailchimpSyncLogEntry = {
  id: string;
  status: MailchimpImportJobStatus;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  progressPercentage: number;
  currentStage: string;
  estimatedCompletionAt: string | null;
  fetchedRows: number;
  insertedRows: number;
  skippedRows: number;
  failedRows: number;
  currentPage: number | null;
  totalPagesEstimate: number | null;
  listIds: string[];
  segmentIds: string[];
  scopeSummary: string;
  resolvedLists: ResolvedSelection[];
  resolvedSegments: ResolvedSelection[];
  configEntries: Array<{ key: string; value: string }>;
  batchStats: Record<string, unknown> | null;
  report: Record<string, unknown> | null;
  reportSummary: {
    contactsImported: number;
    contactsSkipped: number;
    contactsFailed: number;
    segmentsCreated: number;
    tagsCreated: number;
    consentsRecorded: number;
    batchesProcessed: number;
    errors: string[];
  };
  errorDetails: unknown;
  errorMessages: string[];
  errorCount: number;
  hasConnectionIssue: boolean;
  timeline: MailchimpSyncLogTimelineEntry[];
  hasExplicitBatchRows: boolean;
  explicitBatchRows: Array<{
    batchNumber: number;
    contactsProcessed: number | null;
    contactsInserted: number | null;
    contactsSkipped: number | null;
    contactsFailed: number | null;
  }>;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim().length > 0,
  );
}

function getNumberValue(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeJobStatus(
  value: string | null | undefined,
): MailchimpImportJobStatus {
  switch (value?.trim().toLowerCase()) {
    case "cancelled":
      return "cancelled";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "paused":
      return "paused";
    case "running":
      return "running";
    default:
      return "pending";
  }
}

function orderedUnique(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function parseConfig(value: unknown) {
  const config = asObject(value);

  return {
    raw: config,
    listIds: orderedUnique(asStringArray(config?.listIds)),
    segmentIds: orderedUnique(asStringArray(config?.segmentIds)),
  };
}

function getDateThreshold(datePreset: MailchimpSyncLogsDatePreset) {
  if (datePreset === "all") {
    return null;
  }

  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (datePreset === "7d" ? 7 : 30));
  return date.toISOString();
}

function matchesFilters(
  row: MailchimpImportJobRow,
  statusFilter: MailchimpSyncLogsStatusFilter,
  datePreset: MailchimpSyncLogsDatePreset,
) {
  const normalizedStatus = normalizeJobStatus(row.status);
  if (statusFilter !== "all" && normalizedStatus !== statusFilter) {
    return false;
  }

  const threshold = getDateThreshold(datePreset);
  if (!threshold) {
    return true;
  }

  return row.created_at >= threshold;
}

function normalizeReport(report: unknown) {
  const source = asObject(report);
  const rawErrors = source?.errors;

  return {
    source,
    contactsImported: getNumberValue(source, "contacts_imported") ?? 0,
    contactsSkipped: getNumberValue(source, "contacts_skipped") ?? 0,
    contactsFailed: getNumberValue(source, "contacts_failed") ?? 0,
    segmentsCreated: getNumberValue(source, "segments_created") ?? 0,
    tagsCreated: getNumberValue(source, "tags_created") ?? 0,
    consentsRecorded: getNumberValue(source, "consents_recorded") ?? 0,
    batchesProcessed: getNumberValue(source, "batches_processed") ?? 0,
    errors: Array.isArray(rawErrors)
      ? rawErrors.filter(
          (entry): entry is string =>
            typeof entry === "string" && entry.trim().length > 0,
        )
      : [],
  };
}

function collectErrorMessages(
  errorDetails: unknown,
  batchStats: Record<string, unknown> | null,
  reportErrors: string[],
) {
  const normalized = new Set<string>(reportErrors);

  if (typeof errorDetails === "string" && errorDetails.trim()) {
    normalized.add(errorDetails);
  }

  if (Array.isArray(errorDetails)) {
    for (const detail of errorDetails) {
      if (typeof detail === "string" && detail.trim()) {
        normalized.add(detail);
        continue;
      }

      const objectDetail = asObject(detail);
      if (!objectDetail) {
        continue;
      }

      const message =
        typeof objectDetail.message === "string"
          ? objectDetail.message
          : typeof objectDetail.error === "string"
            ? objectDetail.error
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

function buildLookupMaps(artifacts: MailchimpArtifactRow[]) {
  const listNames = new Map<string, string>();
  const segmentNames = new Map<string, string>();

  for (const artifact of artifacts) {
    if (artifact.artifact_type === "list" && artifact.name?.trim()) {
      listNames.set(artifact.external_id, artifact.name);
    }

    if (artifact.artifact_type === "segment" && artifact.name?.trim()) {
      segmentNames.set(artifact.external_id, artifact.name);
    }
  }

  return { listNames, segmentNames };
}

function formatConfigValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "—";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "number") {
    return value.toLocaleString();
  }

  if (typeof value === "string") {
    return value.trim().length > 0 ? value : "—";
  }

  if (!value) {
    return "—";
  }

  return JSON.stringify(value);
}

function buildConfigEntries(config: Record<string, unknown> | null) {
  if (!config) {
    return [] as Array<{ key: string; value: string }>;
  }

  return Object.entries(config).map(([key, value]) => ({
    key,
    value: formatConfigValue(value),
  }));
}

function buildResolvedSelections(
  ids: string[],
  lookupMap: Map<string, string>,
  kind: "list" | "segment",
) {
  return ids.map((id, index) => ({
    id,
    name: resolveMailchimpSelectionName(lookupMap.get(id), kind, index),
  }));
}

function getActiveScopeLabel(
  batchStats: Record<string, unknown> | null,
  listNames: Map<string, string>,
  segmentNames: Map<string, string>,
) {
  const activeSegmentId =
    typeof batchStats?.active_segment_id === "string"
      ? batchStats.active_segment_id
      : null;
  if (activeSegmentId) {
    return resolveMailchimpSelectionName(
      segmentNames.get(activeSegmentId),
      "segment",
    );
  }

  const activeListId =
    typeof batchStats?.active_list_id === "string"
      ? batchStats.active_list_id
      : null;
  if (activeListId) {
    return resolveMailchimpSelectionName(listNames.get(activeListId), "list");
  }

  return null;
}

function buildTimeline(
  row: MailchimpImportJobRow,
  {
    activeScopeLabel,
    currentStageLabel,
    hasConnectionIssue,
    selectionSummary,
  }: {
    activeScopeLabel: string | null;
    currentStageLabel: string;
    hasConnectionIssue: boolean;
    selectionSummary: string;
  },
) {
  const status = normalizeJobStatus(row.status);
  const timeline: MailchimpSyncLogTimelineEntry[] = [
    {
      id: `${row.id}-requested`,
      label: "Import requested",
      description:
        "BloomSuite saved your selected Mailchimp audience and queued the import.",
      timestamp: row.created_at,
      state: "complete",
      derived: false,
    },
  ];

  const hasStarted =
    status !== "pending" ||
    Boolean(row.current_stage) ||
    (row.progress_percentage ?? 0) > 0 ||
    getNumberValue(batchStats, "estimated_total_rows") !== null;

  if (hasStarted) {
    timeline.push({
      id: `${row.id}-started`,
      label: "Import started",
      description: activeScopeLabel
        ? `BloomSuite started importing contacts from ${activeScopeLabel}.`
        : "BloomSuite started importing your selected Mailchimp audience.",
      timestamp: null,
      state: status === "pending" ? "pending" : "complete",
      derived: false,
    });
  }

  if (status === "running") {
    timeline.push({
      id: `${row.id}-current`,
      label: "In progress",
      description: currentStageLabel,
      timestamp: row.updated_at,
      state: "current",
      derived: false,
    });
  }

  if (status === "paused") {
    timeline.push({
      id: `${row.id}-paused`,
      label: "Import paused",
      description: "The import was paused and can be resumed from this page.",
      timestamp: row.updated_at,
      state: "pending",
      derived: false,
    });
  }

  if (status === "cancelled") {
    timeline.push({
      id: `${row.id}-cancelled`,
      label: "Import cancelled",
      description: "The import was cancelled before it finished.",
      timestamp: row.completed_at ?? row.updated_at,
      state: "pending",
      derived: false,
    });
  }

  if (status === "completed") {
    timeline.push({
      id: `${row.id}-completed`,
      label: "Import completed",
      description: `BloomSuite finished importing ${selectionSummary}.`,
      timestamp: row.completed_at ?? row.updated_at,
      state: "complete",
      derived: false,
    });
  }

  if (status === "failed") {
    timeline.push({
      id: `${row.id}-failed`,
      label: "Import needs attention",
      description: hasConnectionIssue
        ? "Reconnect Mailchimp, then retry this import."
        : "The import stopped before it finished. Retry it when you are ready.",
      timestamp: row.completed_at ?? row.updated_at,
      state: "failed",
      derived: false,
    });
  }

  return timeline;
}

function buildExplicitBatchRows(batchStats: Record<string, unknown> | null) {
  const rawRows = batchStats?.batches;
  if (!Array.isArray(rawRows)) {
    return [] as MailchimpSyncLogEntry["explicitBatchRows"];
  }

  return rawRows
    .map((entry, index) => {
      const batch = asObject(entry);
      return {
        batchNumber: getNumberValue(batch, "batch_number") ?? index + 1,
        contactsProcessed: getNumberValue(batch, "contacts_processed"),
        contactsInserted: getNumberValue(batch, "contacts_inserted"),
        contactsSkipped: getNumberValue(batch, "contacts_skipped"),
        contactsFailed: getNumberValue(batch, "contacts_failed"),
      };
    })
    .filter((entry) => entry.batchNumber > 0);
}

function deriveCounts(
  batchStats: Record<string, unknown> | null,
  normalizedReport: ReturnType<typeof normalizeReport>,
) {
  const insertedRows =
    normalizedReport.contactsImported ||
    getNumberValue(batchStats, "contacts_imported") ||
    0;
  const skippedRows =
    normalizedReport.contactsSkipped ||
    getNumberValue(batchStats, "contacts_skipped") ||
    0;
  const failedRows =
    normalizedReport.contactsFailed ||
    getNumberValue(batchStats, "contacts_failed") ||
    0;
  const fetchedRows =
    getNumberValue(batchStats, "estimated_total_rows") ||
    insertedRows + skippedRows + failedRows;

  return {
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
  };
}

function derivePagination(batchStats: Record<string, unknown> | null) {
  return {
    currentPage: getNumberValue(batchStats, "completed_batches"),
    totalPagesEstimate: getNumberValue(batchStats, "total_batches"),
  };
}

function isConnectionIssue(errorMessages: string[]) {
  return errorMessages.some((message) =>
    isMailchimpConnectionIssueMessage(message),
  );
}

function normalizeEntry(
  row: MailchimpImportJobRow,
  lookups: ReturnType<typeof buildLookupMaps>,
): MailchimpSyncLogEntry {
  const parsedConfig = parseConfig(row.config);
  const batchStats = asObject(row.batch_stats);
  const normalizedReport = normalizeReport(row.report);
  const resolvedLists = buildResolvedSelections(
    parsedConfig.listIds,
    lookups.listNames,
    "list",
  );
  const resolvedSegments = buildResolvedSelections(
    parsedConfig.segmentIds,
    lookups.segmentNames,
    "segment",
  );
  const rawErrorMessages = collectErrorMessages(
    row.error_details,
    batchStats,
    normalizedReport.errors,
  );
  const hasConnectionIssue = isConnectionIssue(rawErrorMessages);
  const errorMessages = formatMailchimpErrorMessages(rawErrorMessages);
  const { fetchedRows, insertedRows, skippedRows, failedRows } = deriveCounts(
    batchStats,
    normalizedReport,
  );
  const { currentPage, totalPagesEstimate } = derivePagination(batchStats);
  const activeScopeLabel = getActiveScopeLabel(
    batchStats,
    lookups.listNames,
    lookups.segmentNames,
  );
  const explicitBatchRows = buildExplicitBatchRows(batchStats);
  const scopeSummary = summarizeMailchimpSelections([
    ...resolvedLists.map((entry) => entry.name),
    ...resolvedSegments.map((entry) => entry.name),
  ]);
  const currentStage = formatMailchimpStageLabel(row.current_stage);

  return {
    id: row.id,
    status: normalizeJobStatus(row.status),
    createdAt: row.created_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at,
    progressPercentage: row.progress_percentage ?? 0,
    currentStage,
    estimatedCompletionAt: row.estimated_completion_at,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    currentPage,
    totalPagesEstimate,
    listIds: parsedConfig.listIds,
    segmentIds: parsedConfig.segmentIds,
    scopeSummary,
    resolvedLists,
    resolvedSegments,
    configEntries: buildConfigEntries(parsedConfig.raw),
    batchStats,
    report: normalizedReport.source,
    reportSummary: {
      contactsImported: normalizedReport.contactsImported,
      contactsSkipped: normalizedReport.contactsSkipped,
      contactsFailed: normalizedReport.contactsFailed,
      segmentsCreated: normalizedReport.segmentsCreated,
      tagsCreated: normalizedReport.tagsCreated,
      consentsRecorded: normalizedReport.consentsRecorded,
      batchesProcessed: normalizedReport.batchesProcessed,
      errors: normalizedReport.errors,
    },
    errorDetails: row.error_details,
    errorMessages,
    errorCount: errorMessages.length,
    hasConnectionIssue,
    timeline: buildTimeline(row, {
      activeScopeLabel,
      currentStageLabel: currentStage,
      hasConnectionIssue,
      selectionSummary: scopeSummary,
    }),
    hasExplicitBatchRows: explicitBatchRows.length > 0,
    explicitBatchRows,
  };
}

async function fetchJobsPage({
  tenantId,
  statusFilter,
  datePreset,
  start,
  end,
}: {
  tenantId: string;
  statusFilter: MailchimpSyncLogsStatusFilter;
  datePreset: MailchimpSyncLogsDatePreset;
  start: number;
  end: number;
}) {
  let query = supabase
    .from("import_jobs")
    .select(MAILCHIMP_SYNC_LOGS_SELECT, { count: "exact" })
    .eq("tenant_id", tenantId)
    .eq("provider", "mailchimp")
    .order("created_at", { ascending: false })
    .range(start, end);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const threshold = getDateThreshold(datePreset);
  if (threshold) {
    query = query.gte("created_at", threshold);
  }

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  return {
    rows: (data ?? []) as MailchimpImportJobRow[],
    totalCount: count ?? 0,
  };
}

export function useMailchimpSyncLogs({
  statusFilter,
  datePreset,
  focusedJobId,
}: {
  statusFilter: MailchimpSyncLogsStatusFilter;
  datePreset: MailchimpSyncLogsDatePreset;
  focusedJobId?: string | null;
}) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [artifactRows, setArtifactRows] = useState<MailchimpArtifactRow[]>([]);
  const [jobRows, setJobRows] = useState<MailchimpImportJobRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedJobExcluded, setFocusedJobExcluded] = useState(false);

  const lookupMaps = useMemo(
    () => buildLookupMaps(artifactRows),
    [artifactRows],
  );

  const normalizedRows = useMemo(
    () => jobRows.map((row) => normalizeEntry(row, lookupMaps)),
    [jobRows, lookupMaps],
  );

  const loadArtifacts = useCallback(async () => {
    if (!tenant?.id || !user?.id) {
      setArtifactRows([]);
      return;
    }

    const { data, error } = await supabase
      .from("provider_artifacts")
      .select("artifact_type, external_id, name, data")
      .eq("tenant_id", tenant.id)
      .eq("provider", "mailchimp")
      .in("artifact_type", ["list", "segment"]);

    if (error) {
      throw error;
    }

    setArtifactRows((data ?? []) as MailchimpArtifactRow[]);
  }, [tenant?.id, user?.id]);

  const loadPage = useCallback(
    async ({ offset, append }: { offset: number; append: boolean }) => {
      if (!tenant?.id || !user?.id) {
        setJobRows([]);
        setTotalCount(0);
        setNextOffset(0);
        return;
      }

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const { rows, totalCount: nextTotalCount } = await fetchJobsPage({
          tenantId: tenant.id,
          statusFilter,
          datePreset,
          start: offset,
          end: offset + PAGE_SIZE - 1,
        });

        setJobRows((current) => {
          const merged = append ? [...current, ...rows] : rows;
          const deduped = new Map<string, MailchimpImportJobRow>();

          for (const row of merged) {
            deduped.set(row.id, row);
          }

          return Array.from(deduped.values()).sort((left, right) =>
            right.created_at.localeCompare(left.created_at),
          );
        });
        setTotalCount(nextTotalCount);
        setNextOffset(offset + rows.length);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Mailchimp sync logs could not be loaded.",
        );
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [datePreset, statusFilter, tenant?.id, user?.id],
  );

  const refresh = useCallback(async () => {
    await loadPage({ offset: 0, append: false });
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || nextOffset >= totalCount) {
      return;
    }

    await loadPage({ offset: nextOffset, append: true });
  }, [loadPage, loading, loadingMore, nextOffset, totalCount]);

  useEffect(() => {
    if (!tenant?.id || !user?.id) {
      setArtifactRows([]);
      setJobRows([]);
      setTotalCount(0);
      setNextOffset(0);
      setFocusedJobExcluded(false);
      return;
    }

    void loadArtifacts().catch((loadError) => {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Mailchimp artifacts could not be loaded.",
      );
    });
    void loadPage({ offset: 0, append: false });
  }, [datePreset, loadArtifacts, loadPage, statusFilter, tenant?.id, user?.id]);

  useEffect(() => {
    if (!tenant?.id || !user?.id || !focusedJobId) {
      setFocusedJobExcluded(false);
      return;
    }

    if (jobRows.some((row) => row.id === focusedJobId)) {
      setFocusedJobExcluded(false);
      return;
    }

    void (async () => {
      const { data, error } = await supabase
        .from("import_jobs")
        .select(MAILCHIMP_SYNC_LOGS_SELECT)
        .eq("id", focusedJobId)
        .eq("tenant_id", tenant.id)
        .eq("provider", "mailchimp")
        .maybeSingle();

      if (error || !data) {
        setFocusedJobExcluded(false);
        return;
      }

      const row = data as MailchimpImportJobRow;
      if (!matchesFilters(row, statusFilter, datePreset)) {
        setFocusedJobExcluded(true);
        return;
      }

      setFocusedJobExcluded(false);
      setJobRows((current) => {
        const existingWithoutFocused = current.filter(
          (entry) => entry.id !== focusedJobId,
        );
        return [row, ...existingWithoutFocused].sort((left, right) =>
          right.created_at.localeCompare(left.created_at),
        );
      });
    })();
  }, [datePreset, focusedJobId, jobRows, statusFilter, tenant?.id, user?.id]);

  useEffect(() => {
    if (!tenant?.id || !user?.id) {
      return;
    }

    const channel = supabase
      .channel(`mailchimp-sync-logs-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "import_jobs",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        (payload) => {
          const nextRow = payload.new as MailchimpImportJobRow | undefined;
          const previousRow = payload.old as MailchimpImportJobRow | undefined;

          const provider =
            typeof (nextRow as Record<string, unknown> | undefined)
              ?.provider === "string"
              ? ((nextRow as Record<string, unknown>).provider as string)
              : typeof (previousRow as Record<string, unknown> | undefined)
                    ?.provider === "string"
                ? ((previousRow as Record<string, unknown>).provider as string)
                : null;

          if (provider !== "mailchimp") {
            return;
          }

          if (payload.eventType === "INSERT" && nextRow) {
            if (!matchesFilters(nextRow, statusFilter, datePreset)) {
              return;
            }

            setJobRows((current) => {
              const filteredCurrent = current.filter(
                (row) => row.id !== nextRow.id,
              );
              return [nextRow, ...filteredCurrent].sort((left, right) =>
                right.created_at.localeCompare(left.created_at),
              );
            });
            setTotalCount((current) => current + 1);
            return;
          }

          if (payload.eventType === "UPDATE" && nextRow) {
            const nextMatches = matchesFilters(
              nextRow,
              statusFilter,
              datePreset,
            );
            const previousMatches = previousRow
              ? matchesFilters(previousRow, statusFilter, datePreset)
              : false;

            setJobRows((current) => {
              const exists = current.some((row) => row.id === nextRow.id);

              if (!nextMatches) {
                return current.filter((row) => row.id !== nextRow.id);
              }

              if (!exists) {
                return [nextRow, ...current].sort((left, right) =>
                  right.created_at.localeCompare(left.created_at),
                );
              }

              return current
                .map((row) => (row.id === nextRow.id ? nextRow : row))
                .sort((left, right) =>
                  right.created_at.localeCompare(left.created_at),
                );
            });

            if (!previousMatches && nextMatches) {
              setTotalCount((current) => current + 1);
            }

            if (previousMatches && !nextMatches) {
              setTotalCount((current) => Math.max(0, current - 1));
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [datePreset, statusFilter, tenant?.id, user?.id]);

  useEffect(() => {
    if (!tenant?.id || !user?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      const activeIds = jobRows
        .filter((row) => {
          const status = normalizeJobStatus(row.status);
          return status === "running" || status === "pending";
        })
        .map((row) => row.id);

      if (activeIds.length === 0) {
        return;
      }

      void (async () => {
        const { data, error } = await supabase
          .from("import_jobs")
          .select(MAILCHIMP_SYNC_LOGS_SELECT)
          .in("id", activeIds)
          .eq("tenant_id", tenant.id)
          .eq("provider", "mailchimp");

        if (error) {
          return;
        }

        const nextRows = (data ?? []) as MailchimpImportJobRow[];
        if (nextRows.length === 0) {
          return;
        }

        setJobRows((current) => {
          const nextById = new Map(nextRows.map((row) => [row.id, row]));
          return current.map((row) => nextById.get(row.id) ?? row);
        });
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [jobRows, tenant?.id, user?.id]);

  return {
    rows: normalizedRows,
    loading,
    loadingMore,
    error,
    hasMore: nextOffset < totalCount,
    totalCount,
    loadMore,
    refresh,
    focusedJobExcluded,
  };
}
