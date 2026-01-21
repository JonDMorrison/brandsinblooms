import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { useMigrationJobs } from '@/hooks/useMigrationJobs';
import { formatDistanceToNow } from 'date-fns';

interface MailchimpStatusBadgeProps {
  onRetry: () => void;
}

export const MailchimpStatusBadge: React.FC<MailchimpStatusBadgeProps> = ({ onRetry }) => {
  const { jobs, isLoading } = useMigrationJobs();
  
  // Find the most recent Mailchimp job
  const mailchimpJob = jobs.find(j => j.source_platform === 'mailchimp');
  
  if (isLoading || !mailchimpJob) {
    return null;
  }

  const getStatusDisplay = () => {
    switch (mailchimpJob.status) {
      case 'completed':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: 'Connected',
          variant: 'default' as const,
          className: 'bg-green-500/10 text-green-600 border-green-500/20',
          showRetry: false,
        };
      case 'failed':
        return {
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: 'Failed',
          variant: 'destructive' as const,
          className: 'bg-destructive/10 text-destructive border-destructive/20',
          showRetry: true,
        };
      case 'running':
        return {
          icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
          label: 'Syncing...',
          variant: 'secondary' as const,
          className: 'bg-primary/10 text-primary border-primary/20',
          showRetry: false,
        };
      case 'pending':
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Pending',
          variant: 'secondary' as const,
          className: 'bg-muted text-muted-foreground',
          showRetry: false,
        };
      case 'paused':
        return {
          icon: <Clock className="w-3.5 h-3.5" />,
          label: 'Paused',
          variant: 'secondary' as const,
          className: 'bg-warning/10 text-warning border-warning/20',
          showRetry: true,
        };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();
  if (!statusDisplay) return null;

  const lastUpdated = mailchimpJob.updated_at 
    ? formatDistanceToNow(new Date(mailchimpJob.updated_at), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Badge 
          variant="outline" 
          className={`flex items-center gap-1.5 ${statusDisplay.className}`}
        >
          {statusDisplay.icon}
          {statusDisplay.label}
        </Badge>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">{lastUpdated}</span>
        )}
      </div>
      
      {statusDisplay.showRetry && (
        <div className="flex flex-col gap-1">
          {mailchimpJob.error_message && (
            <p className="text-xs text-destructive">
              {mailchimpJob.error_message}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="w-fit"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Retry Connection
          </Button>
        </div>
      )}
    </div>
  );
};
