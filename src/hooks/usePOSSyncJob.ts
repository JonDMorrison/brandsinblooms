import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface POSSyncJob {
  id: string;
  tenant_id: string;
  connection_id: string;
  connection_type: "square" | "clover" | "lightspeed";
  sync_type: "customers" | "sales" | "products" | "full";
  status: "pending" | "in_progress" | "completed" | "failed";
  cursor?: string;
  page_offset: number;
  page_size: number;
  total_fetched: number;
  total_synced: number;
  total_failed: number;
  current_page: number;
  is_first_page: boolean;
  has_more_pages: boolean;
  attempts: number;
  max_attempts: number;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

interface UsePOSSyncJobOptions {
  connectionId?: string;
  connectionType: "square" | "clover" | "lightspeed";
  syncType?: "customers" | "sales" | "products" | "full";
  pollInterval?: number;
}

export const usePOSSyncJob = ({
  connectionId,
  connectionType,
  syncType = "customers",
  pollInterval = 2000,
}: UsePOSSyncJobOptions) => {
  const [activeJob, setActiveJob] = useState<POSSyncJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Check if job is stuck (in_progress for > 5 minutes without updates)
  const isJobStuck = useCallback((job: POSSyncJob | null): boolean => {
    if (!job || job.status !== "in_progress") return false;
    const updatedAt = new Date(job.updated_at).getTime();
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    return updatedAt < fiveMinutesAgo;
  }, []);

  // Fetch active job for this connection
  const fetchActiveJob = useCallback(async () => {
    if (!connectionId) return null;

    const { data, error } = await supabase
      .from("pos_sync_jobs")
      .select("*")
      .eq("connection_id", connectionId)
      .eq("sync_type", syncType)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[usePOSSyncJob] Error fetching job:", error);
      return null;
    }

    return data as POSSyncJob | null;
  }, [connectionId, syncType]);

  // Reset a stuck job by marking it as failed
  const resetStuckJob = useCallback(async () => {
    if (!activeJob) return false;

    const { error } = await supabase
      .from("pos_sync_jobs")
      .update({
        status: "failed",
        error_message:
          "Job reset by user - chain interrupted. Please retry sync.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", activeJob.id);

    if (error) {
      console.error("[usePOSSyncJob] Error resetting job:", error);
      return false;
    }

    setActiveJob(null);
    setIsPolling(false);
    return true;
  }, [activeJob]);

  // Start polling when there's an active job
  useEffect(() => {
    if (!connectionId) return;

    let intervalId: NodeJS.Timeout | null = null;

    const startPolling = async () => {
      const job = await fetchActiveJob();
      setActiveJob(job);

      if (job && (job.status === "pending" || job.status === "in_progress")) {
        setIsPolling(true);
        intervalId = setInterval(async () => {
          const updatedJob = await fetchActiveJob();
          setActiveJob(updatedJob);

          // Stop polling if job is complete or failed
          if (
            !updatedJob ||
            updatedJob.status === "completed" ||
            updatedJob.status === "failed"
          ) {
            setIsPolling(false);
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        }, pollInterval);
      }
    };

    startPolling();

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [connectionId, fetchActiveJob, pollInterval]);

  // Start a new sync job
  const startSync = useCallback(async () => {
    if (!connectionId) return null;

    // Check if sync is already in progress
    const existingJob = await fetchActiveJob();
    if (
      existingJob &&
      (existingJob.status === "pending" || existingJob.status === "in_progress")
    ) {
      // Check if job is stuck - if so, reset it first
      if (isJobStuck(existingJob)) {
        await supabase
          .from("pos_sync_jobs")
          .update({
            status: "failed",
            error_message: "Job auto-reset - chain interrupted",
            completed_at: new Date().toISOString(),
          })
          .eq("id", existingJob.id);
      } else {
        setActiveJob(existingJob);
        setIsPolling(true);
        return existingJob;
      }
    }

    // Invoke the sync function based on connection type
    const functionName = `${connectionType}-sync-customers`;
    const { data, error } = await supabase.functions.invoke(functionName);

    if (error) {
      console.error("[usePOSSyncJob] Error starting sync:", error);
      throw error;
    }

    // Start polling for the new job
    if (data?.jobId) {
      setIsPolling(true);
      const newJob = await fetchActiveJob();
      setActiveJob(newJob);
      return newJob;
    }

    return null;
  }, [connectionId, connectionType, fetchActiveJob, isJobStuck]);

  // Refresh job status
  const refreshJob = useCallback(async () => {
    const job = await fetchActiveJob();
    setActiveJob(job);
    return job;
  }, [fetchActiveJob]);

  // Get progress percentage
  const getProgress = useCallback(() => {
    if (!activeJob) return 0;
    if (activeJob.status === "completed") return 100;
    if (activeJob.total_fetched === 0) return 0;

    // Estimate based on pages processed
    // Since we don't know total, show indeterminate progress
    return Math.min(95, activeJob.current_page * 10);
  }, [activeJob]);

  return {
    activeJob,
    isPolling,
    isSyncing:
      activeJob?.status === "in_progress" || activeJob?.status === "pending",
    isCompleted: activeJob?.status === "completed",
    isFailed: activeJob?.status === "failed",
    isStuck: isJobStuck(activeJob),
    progress: getProgress(),
    startSync,
    refreshJob,
    resetStuckJob,
  };
};
