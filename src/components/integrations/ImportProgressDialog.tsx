import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-legacy/dialog";
import { Progress } from "@/components/ui-legacy/progress";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui-legacy/button";

interface BatchStats {
  total_batches?: number;
  completed_batches?: number;
  failed_batches?: number;
  contacts_imported?: number;
  contacts_skipped?: number;
  contacts_failed?: number;
  consents_recorded?: number;
  tags_created?: number;
  segments_created?: number;
  total_scopes?: number;
  active_scope_index?: number;
  estimated_total_rows?: number;
  errors?: string[];
}

interface ImportCounts {
  fetchedRows: number;
  insertedRows: number;
  skippedRows: number;
  failedRows: number;
}

interface ImportProgressDialogProps {
  jobId: string | null;
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export const ImportProgressDialog = ({
  jobId,
  open,
  onClose,
  onComplete,
}: ImportProgressDialogProps) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Initializing...");
  const [status, setStatus] = useState<"running" | "completed" | "failed">(
    "running",
  );
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [counts, setCounts] = useState<ImportCounts>({
    fetchedRows: 0,
    insertedRows: 0,
    skippedRows: 0,
    failedRows: 0,
  });
  const [estimatedCompletion, setEstimatedCompletion] = useState<Date | null>(
    null,
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());
  const [errors, setErrors] = useState<string[]>([]);
  const completionNotifiedRef = useRef(false);

  const staleMilliseconds = lastUpdatedAt ? now - lastUpdatedAt.getTime() : 0;
  const isStale = status === "running" && staleMilliseconds > 45000;
  const scopeProgressLabel = useMemo(() => {
    if (!stats?.total_scopes || stats.total_scopes <= 0) {
      return null;
    }

    return `${Math.min((stats.active_scope_index ?? 0) + 1, stats.total_scopes)} of ${stats.total_scopes}`;
  }, [stats]);

  useEffect(() => {
    if (!jobId || !open) return;

    completionNotifiedRef.current = false;

    // Initial fetch
    fetchJobStatus();

    // Subscribe to real-time updates
    const channelId = `${jobId}-${Date.now()}`;
    const channel = supabase
      .channel(`import-job-${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "import_jobs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          updateFromPayload(payload.new);
        },
      )
      .subscribe();

    // Poll every 2 seconds as fallback
    const pollInterval = setInterval(fetchJobStatus, 2000);
    const heartbeatInterval = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
      clearInterval(heartbeatInterval);
    };
  }, [jobId, open]);

  const fetchJobStatus = async () => {
    if (!jobId) return;

    const { data, error } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) {
      console.error("[ImportProgress] Error fetching job:", error);
      return;
    }

    updateFromPayload(data);
  };

  const updateFromPayload = (data: any) => {
    setProgress(data.progress_percentage || 0);
    setStage(data.current_stage || "Processing...");
    setStatus(data.status);
    setStats((data.batch_stats ?? null) as BatchStats | null);
    setCounts({
      fetchedRows: data.fetched_rows || 0,
      insertedRows: data.inserted_rows || 0,
      skippedRows: data.skipped_rows || 0,
      failedRows: data.failed_rows || 0,
    });
    setLastUpdatedAt(
      data.updated_at || data.created_at
        ? new Date(data.updated_at || data.created_at)
        : null,
    );
    setErrors(normalizeErrors(data.error_details, data.batch_stats));

    if (data.estimated_completion_at) {
      setEstimatedCompletion(new Date(data.estimated_completion_at));
    }

    if (
      data.status === "completed" &&
      onComplete &&
      !completionNotifiedRef.current
    ) {
      completionNotifiedRef.current = true;
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };

  const normalizeErrors = (errorDetails: any, batchStats: any) => {
    const normalized = new Set<string>();

    if (Array.isArray(errorDetails)) {
      for (const detail of errorDetails) {
        if (!detail || typeof detail !== "object") {
          continue;
        }

        const message =
          typeof detail.message === "string"
            ? detail.message
            : typeof detail.error === "string"
              ? detail.error
              : null;

        if (message) {
          normalized.add(message);
        }
      }
    }

    const statsErrors = batchStats?.errors;
    if (Array.isArray(statsErrors)) {
      for (const error of statsErrors) {
        if (typeof error === "string" && error.length > 0) {
          normalized.add(error);
        }
      }
    }

    return Array.from(normalized);
  };

  const getStatusIcon = () => {
    if (status === "completed") {
      return <CheckCircle2 className="h-12 w-12 text-green-500" />;
    }
    if (status === "failed") {
      return <XCircle className="h-12 w-12 text-destructive" />;
    }
    return <Loader2 className="h-12 w-12 text-primary animate-spin" />;
  };

  const getStatusText = () => {
    if (status === "completed") return "Import Completed!";
    if (status === "failed") return "Import Failed";
    return "Importing Contacts...";
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center">{getStatusText()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Icon */}
          <div className="flex justify-center">{getStatusIcon()}</div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{stage}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {isStale && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <div>
                  <p className="font-medium">Progress updates look stale</p>
                  <p>
                    The import is still marked as running, but the last update
                    was{" "}
                    {formatDistanceToNow(lastUpdatedAt ?? new Date(), {
                      addSuffix: true,
                    })}
                    .
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          {(stats || counts.fetchedRows > 0 || counts.insertedRows > 0) && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/50 p-4 md:grid-cols-3">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {counts.fetchedRows.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Fetched Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {counts.insertedRows.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Inserted Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {counts.skippedRows.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Skipped Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-destructive">
                  {counts.failedRows.toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">Failed Rows</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {stats?.completed_batches || 0}
                </p>
                <p className="text-xs text-muted-foreground">
                  Completed Batches
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {scopeProgressLabel ?? "—"}
                </p>
                <p className="text-xs text-muted-foreground">Active Scope</p>
              </div>
            </div>
          )}

          <div className="space-y-1 text-center text-sm text-muted-foreground">
            {estimatedCompletion && status === "running" && (
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>
                  Estimated completion:{" "}
                  {formatDistanceToNow(estimatedCompletion, {
                    addSuffix: true,
                  })}
                </span>
              </div>
            )}
            {lastUpdatedAt && (
              <p>
                Last update{" "}
                {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}
              </p>
            )}
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive mb-2">
                {errors.length} Error(s) Encountered
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {errors.slice(0, 3).map((err: string, idx: number) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    {err}
                  </p>
                ))}
                {errors.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    ...and {errors.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Close Button */}
          {status !== "running" && (
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
