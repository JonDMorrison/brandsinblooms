import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Modal,
  ModalClose,
  ModalDialog,
  Sheet,
  Stack,
  Typography,
} from "@mui/joy";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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

    fetchJobStatus();

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  const getStatusTitle = () => {
    if (status === "completed") return "Import Completed";
    if (status === "failed") return "Import Failed";
    return "Importing Contacts";
  };

  const showStats =
    stats !== null || counts.fetchedRows > 0 || counts.insertedRows > 0;

  return (
    <Modal open={open} onClose={() => status !== "running" && onClose()}>
      <ModalDialog
        variant="outlined"
        sx={{ maxWidth: 520, borderRadius: "lg", p: 3, bgcolor: "background.surface" }}
      >
        {status !== "running" && <ModalClose />}

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.5 }}>
          {status === "completed" ? (
            <CheckCircle2 style={{ width: 22, height: 22, color: "var(--joy-palette-success-500)" }} />
          ) : status === "failed" ? (
            <XCircle style={{ width: 22, height: 22, color: "var(--joy-palette-danger-500)" }} />
          ) : (
            <CircularProgress size="sm" />
          )}
          <DialogTitle sx={{ p: 0 }}>{getStatusTitle()}</DialogTitle>
        </Stack>

        <DialogContent sx={{ mt: 1.5 }}>
          <Stack spacing={2}>
            {/* Progress bar */}
            <Box>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography level="body-xs" textColor="text.tertiary">{stage}</Typography>
                <Typography level="body-xs" fontWeight="md">{progress}%</Typography>
              </Stack>
              <LinearProgress
                determinate
                value={progress}
                color={
                  status === "completed"
                    ? "success"
                    : status === "failed"
                      ? "danger"
                      : "neutral"
                }
                size="lg"
              />
            </Box>

            {isStale && (
              <Alert color="warning" variant="soft" size="sm">
                <Box>
                  <Typography level="body-sm" fontWeight="md">
                    Progress updates look stale
                  </Typography>
                  <Typography level="body-xs" textColor="text.tertiary">
                    The import is still marked as running, but the last update
                    was{" "}
                    {formatDistanceToNow(lastUpdatedAt ?? new Date(), {
                      addSuffix: true,
                    })}
                    .
                  </Typography>
                </Box>
              </Alert>
            )}

            {/* Stats grid */}
            {showStats && (
              <Sheet
                variant="soft"
                color="neutral"
                sx={{ borderRadius: "lg", p: 2 }}
              >
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 1.5,
                  }}
                >
                  {[
                    { label: "Fetched", value: counts.fetchedRows },
                    { label: "Inserted", value: counts.insertedRows },
                    { label: "Skipped", value: counts.skippedRows },
                    { label: "Failed", value: counts.failedRows, danger: true },
                    { label: "Batches", value: stats?.completed_batches ?? 0 },
                    { label: "Scope", value: scopeProgressLabel ?? "—", raw: true },
                  ].map(({ label, value, danger, raw }) => (
                    <Box key={label} sx={{ textAlign: "center" }}>
                      <Typography
                        level="title-md"
                        fontWeight="xl"
                        textColor={danger && (value as number) > 0 ? "danger.500" : "text.primary"}
                      >
                        {raw ? value : (value as number).toLocaleString()}
                      </Typography>
                      <Typography level="body-xs" textColor="text.tertiary">
                        {label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Sheet>
            )}

            {/* Timing */}
            <Stack spacing={0.25} sx={{ textAlign: "center" }}>
              {estimatedCompletion && status === "running" && (
                <Typography level="body-xs" textColor="text.tertiary">
                  Estimated completion:{" "}
                  {formatDistanceToNow(estimatedCompletion, { addSuffix: true })}
                </Typography>
              )}
              {lastUpdatedAt && (
                <Typography level="body-xs" textColor="text.tertiary">
                  Last update{" "}
                  {formatDistanceToNow(lastUpdatedAt, { addSuffix: true })}
                </Typography>
              )}
            </Stack>

            {/* Errors */}
            {errors.length > 0 && (
              <Alert color="danger" variant="soft" size="sm">
                <Box>
                  <Typography level="body-sm" fontWeight="md" mb={0.5}>
                    {errors.length} Error{errors.length > 1 ? "s" : ""} Encountered
                  </Typography>
                  <Stack spacing={0.25}>
                    {errors.slice(0, 3).map((err, idx) => (
                      <Typography key={idx} level="body-xs" textColor="text.tertiary">
                        {err}
                      </Typography>
                    ))}
                    {errors.length > 3 && (
                      <Typography level="body-xs" textColor="text.tertiary">
                        …and {errors.length - 3} more
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Alert>
            )}
          </Stack>
        </DialogContent>

        {status !== "running" && (
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button variant="solid" color="neutral" onClick={onClose} sx={{ width: "100%" }}>
              Close
            </Button>
          </Box>
        )}
      </ModalDialog>
    </Modal>
  );
};
