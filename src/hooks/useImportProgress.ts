import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ImportJobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress_percentage: number;
  current_stage: string;
  estimated_completion_at: string | null;
  batch_stats: {
    total_batches: number;
    completed_batches: number;
    failed_batches: number;
    contacts_per_batch: number;
    contacts_imported?: number;
  };
  error_details: any[];
  report: any;
  created_at: string;
  completed_at: string | null;
}

export const useImportProgress = (jobId: string | null) => {
  const [job, setJob] = useState<ImportJobStatus | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jobId) return;

    setLoading(true);

    // Initial fetch
    fetchJob();

    // Subscribe to real-time updates
    const channel = supabase
      .channel(`import-job-progress-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('[useImportProgress] Real-time update:', payload);
          setJob(payload.new as ImportJobStatus);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  const fetchJob = async () => {
    if (!jobId) return;

    try {
      const { data, error } = await supabase
        .from('import_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;

      setJob(data as unknown as ImportJobStatus);
    } catch (error) {
      console.error('[useImportProgress] Error fetching job:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    job,
    loading,
    isRunning: job?.status === 'running',
    isCompleted: job?.status === 'completed',
    isFailed: job?.status === 'failed',
    progress: job?.progress_percentage || 0,
    stage: job?.current_stage || 'Initializing...',
    refetch: fetchJob
  };
};
