import { 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Pause, 
  Play,
  Clock
} from 'lucide-react';
import { Card } from '@/components/ui-legacy/card';
import { Progress } from '@/components/ui-legacy/progress';
import { Button } from '@/components/ui-legacy/button';
import { Badge } from '@/components/ui-legacy/badge';
import { MigrationJob } from '@/hooks/useMigrationJobs';
import { formatDistanceToNow } from 'date-fns';

interface MigrationJobCardProps {
  job: MigrationJob;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
  isControlling?: boolean;
}

export const MigrationJobCard = ({
  job,
  onPause,
  onResume,
  onCancel,
  isControlling
}: MigrationJobCardProps) => {
  const getStatusIcon = () => {
    switch (job.status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-muted-foreground" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-warning" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (job.status) {
      case 'running':
        return 'default';
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'paused':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">
                {job.source_platform} {job.job_type}
              </span>
              <Badge variant={getStatusColor() as any}>
                {job.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Started {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>

        {job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled' && (
          <>
            <Progress value={job.progress_percentage} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{job.progress_current} / {job.progress_total} records</span>
              <span>{job.progress_percentage.toFixed(1)}%</span>
            </div>
          </>
        )}

        {job.error_message && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {job.error_message}
          </div>
        )}

        {job.completed_at && (
          <p className="text-xs text-muted-foreground">
            Completed {formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}
          </p>
        )}

        {(job.status === 'running' || job.status === 'paused') && (
          <div className="flex gap-2">
            {job.status === 'running' && onPause && (
              <Button
                size="sm"
                variant="outline"
                onClick={onPause}
                disabled={isControlling}
              >
                <Pause className="h-3 w-3 mr-1" />
                Pause
              </Button>
            )}
            {job.status === 'paused' && onResume && (
              <Button
                size="sm"
                variant="outline"
                onClick={onResume}
                disabled={isControlling}
              >
                <Play className="h-3 w-3 mr-1" />
                Resume
              </Button>
            )}
            {onCancel && (
              <Button
                size="sm"
                variant="destructive"
                onClick={onCancel}
                disabled={isControlling}
              >
                Cancel
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};
