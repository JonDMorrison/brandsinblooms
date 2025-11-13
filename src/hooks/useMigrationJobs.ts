import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffect } from 'react';

export interface MigrationJob {
  id: string;
  tenant_id: string;
  user_id: string;
  source_platform: string;
  job_type: 'import' | 'export' | 'sync';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress_current: number;
  progress_total: number;
  progress_percentage: number;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  error_message?: string;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export const useMigrationJobs = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all migration jobs
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ['migration-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('migration_jobs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MigrationJob[];
    }
  });

  // Subscribe to real-time updates
  useEffect(() => {
    const channel = supabase
      .channel('migration-jobs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'migration_jobs'
        },
        (payload) => {
          console.log('📡 Migration job update:', payload);
          queryClient.invalidateQueries({ queryKey: ['migration-jobs'] });
          
          // Show toast notifications for status changes
          if (payload.eventType === 'UPDATE') {
            const job = payload.new as MigrationJob;
            if (job.status === 'completed') {
              toast({
                title: 'Migration Complete',
                description: `Successfully imported from ${job.source_platform}`,
              });
            } else if (job.status === 'failed') {
              toast({
                title: 'Migration Failed',
                description: job.error_message || 'An error occurred',
                variant: 'destructive',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, toast]);

  // Control mutations
  const controlMutation = useMutation({
    mutationFn: async ({ jobId, action }: { jobId: string; action: 'pause' | 'resume' | 'cancel' }) => {
      const { data, error } = await supabase.functions.invoke('migration-control', {
        body: { job_id: jobId, action }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['migration-jobs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Action Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  return {
    jobs,
    isLoading,
    activeJobs: jobs.filter(j => j.status === 'running'),
    pauseJob: (jobId: string) => controlMutation.mutate({ jobId, action: 'pause' }),
    resumeJob: (jobId: string) => controlMutation.mutate({ jobId, action: 'resume' }),
    cancelJob: (jobId: string) => controlMutation.mutate({ jobId, action: 'cancel' }),
    isControlling: controlMutation.isPending,
  };
};
