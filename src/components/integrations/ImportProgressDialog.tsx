import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

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
  onComplete 
}: ImportProgressDialogProps) => {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Initializing...");
  const [status, setStatus] = useState<'running' | 'completed' | 'failed'>('running');
  const [stats, setStats] = useState<any>(null);
  const [estimatedCompletion, setEstimatedCompletion] = useState<Date | null>(null);
  const [errors, setErrors] = useState<any[]>([]);

  useEffect(() => {
    if (!jobId || !open) return;

    // Initial fetch
    fetchJobStatus();

    // Subscribe to real-time updates
    const channelId = `${jobId}-${Date.now()}`;
    const channel = supabase
      .channel(`import-job-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'import_jobs',
          filter: `id=eq.${jobId}`
        },
        (payload) => {
          console.log('[ImportProgress] Real-time update:', payload);
          updateFromPayload(payload.new);
        }
      )
      .subscribe();

    // Poll every 2 seconds as fallback
    const pollInterval = setInterval(fetchJobStatus, 2000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [jobId, open]);

  const fetchJobStatus = async () => {
    if (!jobId) return;

    const { data, error } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('[ImportProgress] Error fetching job:', error);
      return;
    }

    updateFromPayload(data);
  };

  const updateFromPayload = (data: any) => {
    setProgress(data.progress_percentage || 0);
    setStage(data.current_stage || 'Processing...');
    setStatus(data.status);
    setStats(data.batch_stats);
    setErrors(data.error_details || []);

    if (data.estimated_completion_at) {
      setEstimatedCompletion(new Date(data.estimated_completion_at));
    }

    if (data.status === 'completed' && onComplete) {
      setTimeout(() => {
        onComplete();
      }, 1500);
    }
  };

  const getStatusIcon = () => {
    if (status === 'completed') {
      return <CheckCircle2 className="h-12 w-12 text-green-500" />;
    }
    if (status === 'failed') {
      return <XCircle className="h-12 w-12 text-destructive" />;
    }
    return <Loader2 className="h-12 w-12 text-primary animate-spin" />;
  };

  const getStatusText = () => {
    if (status === 'completed') return 'Import Completed!';
    if (status === 'failed') return 'Import Failed';
    return 'Importing Contacts...';
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-center">{getStatusText()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            {getStatusIcon()}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{stage}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/50 p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {stats.contacts_imported || 0}
                </p>
                <p className="text-xs text-muted-foreground">Contacts Imported</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">
                  {stats.completed_batches || 0}
                </p>
                <p className="text-xs text-muted-foreground">Batches Processed</p>
              </div>
            </div>
          )}

          {/* Estimated Time */}
          {estimatedCompletion && status === 'running' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>
                Estimated completion: {formatDistanceToNow(estimatedCompletion, { addSuffix: true })}
              </span>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm font-medium text-destructive mb-2">
                {errors.length} Error(s) Encountered
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {errors.slice(0, 3).map((err: any, idx: number) => (
                  <p key={idx} className="text-xs text-muted-foreground">
                    Batch {err.batch}: {err.error}
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
          {status !== 'running' && (
            <Button onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
