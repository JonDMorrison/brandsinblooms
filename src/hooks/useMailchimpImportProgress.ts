import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  isMailchimpImportJobActivelyRunning,
  isMailchimpImportJobStale,
  normalizeMailchimpImportStatus,
  type MailchimpImportStatus,
} from "@/hooks/mailchimpImportState";
import { useTenant } from "@/hooks/useTenant";

const IMPORT_JOB_PROGRESS_SELECT =
  "id, status, progress_percentage, current_stage, estimated_completion_at, batch_stats, error_details, report, created_at, updated_at, completed_at";

type MailchimpImportJobRow = {
  id: string;
  status: string | null;
  progress_percentage: number | null;
  current_stage: string | null;
  estimated_completion_at: string | null;
  batch_stats: Record<string, unknown> | null;
  error_details: unknown;
  report: unknown;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getNumericValue(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function deriveCounts(job: MailchimpImportJobRow | null) {
  const report = asObject(job?.report);
  const batchStats = asObject(job?.batch_stats);
  const insertedRows =
    getNumericValue(report, "contacts_imported") ??
    getNumericValue(batchStats, "contacts_imported") ??
    0;
  const skippedRows =
    getNumericValue(report, "contacts_skipped") ??
    getNumericValue(batchStats, "contacts_skipped") ??
    0;
  const failedRows =
    getNumericValue(report, "contacts_failed") ??
    getNumericValue(batchStats, "contacts_failed") ??
    0;
  const fetchedRows =
    getNumericValue(batchStats, "estimated_total_rows") ??
    insertedRows + skippedRows + failedRows;

  return {
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
  };
}

export type MailchimpImportProgressState = {
  jobId: string | null;
  status: MailchimpImportStatus | null;
  progressPercentage: number;
  currentStage: string;
  fetchedRows: number;
  insertedRows: number;
  skippedRows: number;
  failedRows: number;
  estimatedCompletionAt: string | null;
  batchStats: Record<string, unknown> | null;
  errorDetails: unknown;
  report: unknown;
  isRunning: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isStale: boolean;
  lastUpdatedAt: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const POLL_INTERVAL_MS = 3000;
const HEARTBEAT_INTERVAL_MS = 5000;

function createEmptyState(
  refetch: () => Promise<void>,
): MailchimpImportProgressState {
  return {
    jobId: null,
    status: null,
    progressPercentage: 0,
    currentStage: "Waiting for import progress...",
    fetchedRows: 0,
    insertedRows: 0,
    skippedRows: 0,
    failedRows: 0,
    estimatedCompletionAt: null,
    batchStats: null,
    errorDetails: null,
    report: null,
    isRunning: false,
    isCompleted: false,
    isFailed: false,
    isStale: false,
    lastUpdatedAt: null,
    loading: false,
    refetch,
  };
}

function mapJobToState(
  job: MailchimpImportJobRow | null,
  loading: boolean,
  isStale: boolean,
  refetch: () => Promise<void>,
): MailchimpImportProgressState {
  if (!job) {
    return {
      ...createEmptyState(refetch),
      loading,
    };
  }

  const status = normalizeMailchimpImportStatus(job.status);
  const { fetchedRows, insertedRows, skippedRows, failedRows } =
    deriveCounts(job);
  const isRunning = isMailchimpImportJobActivelyRunning(job);

  return {
    jobId: job.id,
    status,
    progressPercentage: job.progress_percentage ?? 0,
    currentStage: job.current_stage?.trim() || "Processing import...",
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    estimatedCompletionAt: job.estimated_completion_at,
    batchStats: job.batch_stats,
    errorDetails: job.error_details,
    report: job.report,
    isRunning,
    isCompleted: status === "completed",
    isFailed: status === "failed",
    isStale,
    lastUpdatedAt: job.updated_at ?? job.created_at,
    loading,
    refetch,
  };
}

export function useMailchimpImportProgress(
  jobId?: string | null,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [discoveredJobId, setDiscoveredJobId] = useState<string | null>(null);
  const [job, setJob] = useState<MailchimpImportJobRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const enabled = options?.enabled ?? true;
  const resolvedJobId = enabled ? (jobId ?? discoveredJobId) : null;

  const fetchLatestRunningJob = useCallback(async () => {
    if (!enabled || !tenant?.id || !user?.id) {
      return null;
    }

    const { data, error } = await supabase
      .from("import_jobs")
      .select(IMPORT_JOB_PROGRESS_SELECT)
      .eq("tenant_id", tenant.id)
      .eq("provider", "mailchimp")
      .in("status", ["pending", "running"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return (data as MailchimpImportJobRow | null) ?? null;
  }, [enabled, tenant?.id, user?.id]);

  const refetch = useCallback(async () => {
    if (!enabled || !tenant?.id || !user?.id) {
      setDiscoveredJobId(null);
      setJob(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      if (!resolvedJobId) {
        const latestRunningJob = await fetchLatestRunningJob();

        if (latestRunningJob && isMailchimpImportJobActivelyRunning(latestRunningJob)) {
          setDiscoveredJobId(latestRunningJob.id);
          setJob(latestRunningJob);
        } else {
          setDiscoveredJobId(null);
          setJob(null);
        }

        return;
      }

      const { data, error } = await supabase
        .from("import_jobs")
        .select(IMPORT_JOB_PROGRESS_SELECT)
        .eq("id", resolvedJobId)
        .eq("tenant_id", tenant.id)
        .eq("provider", "mailchimp")
        .maybeSingle();

      if (error) {
        throw error;
      }

      setJob((data as MailchimpImportJobRow | null) ?? null);
    } catch (error) {
      console.error(
        "[useMailchimpImportProgress] Failed to fetch Mailchimp import progress",
        error,
      );
    } finally {
      setLoading(false);
    }
  }, [enabled, fetchLatestRunningJob, resolvedJobId, tenant?.id, user?.id]);

  useEffect(() => {
    if (!enabled || !tenant?.id || !user?.id) {
      setDiscoveredJobId(null);
      setJob(null);
      setLoading(false);
      return;
    }

    if (jobId) {
      setDiscoveredJobId(null);
    }

    void refetch();
  }, [enabled, jobId, refetch, tenant?.id, user?.id]);

  useEffect(() => {
    if (!enabled || !tenant?.id || !user?.id || !resolvedJobId) {
      return;
    }

    const channel = supabase
      .channel(`mailchimp-import-progress-${resolvedJobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "import_jobs",
          filter: `id=eq.${resolvedJobId}`,
        },
        (payload) => {
          setJob(payload.new as MailchimpImportJobRow);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, resolvedJobId, tenant?.id, user?.id]);

  useEffect(() => {
    if (!enabled || !tenant?.id || !user?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [enabled, refetch, tenant?.id, user?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const isStale = useMemo(() => {
    return isMailchimpImportJobStale(job, now);
  }, [job, now]);

  return mapJobToState(job, loading, isStale, refetch);
}
