import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-legacy/card';
import { Button } from '@/components/ui-legacy/button';
import { Badge } from '@/components/ui-legacy/badge';
import { Skeleton } from '@/components/ui-legacy/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui-legacy/collapsible';
import { 
  useNodeExecutionStats, 
  useNodeFailedExecutions,
  useRetryAutomationEmailNode 
} from '@/hooks/useAutomationEmailExecutions';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  ChevronDown,
  ChevronUp,
  Mail,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface EmailNodeExecutionPanelProps {
  automationId: string;
  nodeId: string;
  className?: string;
}

export const EmailNodeExecutionPanel: React.FC<EmailNodeExecutionPanelProps> = ({
  automationId,
  nodeId,
  className = ''
}) => {
  const [failuresOpen, setFailuresOpen] = useState(false);
  
  const { data: stats, isLoading: statsLoading } = useNodeExecutionStats(automationId, nodeId);
  const { data: failures, isLoading: failuresLoading } = useNodeFailedExecutions(automationId, nodeId);
  const retryMutation = useRetryAutomationEmailNode();

  const hasData = stats && (stats.sent > 0 || stats.skipped > 0 || stats.failed > 0);
  const hasRetryableFailures = failures && failures.length > 0 && 
    failures.some(f => !['suppressed', 'opt_out', 'unsubscribed', 'bounced', 'complained'].includes(f.reason || ''));

  if (statsLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Delivery Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!hasData) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Delivery Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No emails have been sent from this node yet. Stats will appear after the automation runs.
          </p>
        </CardContent>
      </Card>
    );
  }

  const getReasonLabel = (reason: string) => {
    const labels: Record<string, string> = {
      suppressed: 'Suppressed',
      opt_out: 'Opted Out',
      unsubscribed: 'Unsubscribed',
      bounced: 'Bounced',
      complained: 'Complaint',
      missing_email: 'No Email',
      invalid_email: 'Invalid Email',
      render_error: 'Render Error',
      send_error: 'Send Error',
      already_sent: 'Already Sent',
    };
    return labels[reason] || reason;
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Delivery Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold text-green-700 dark:text-green-400">{stats.sent}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </div>
          
          <div className="text-center p-2 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-amber-600 mb-1">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold text-amber-700 dark:text-amber-400">{stats.skipped}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </div>
          
          <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div className="flex items-center justify-center gap-1 text-red-600 mb-1">
              <XCircle className="h-4 w-4" />
            </div>
            <div className="text-lg font-bold text-red-700 dark:text-red-400">{stats.failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Reason Breakdown */}
        {Object.keys(stats.byReason).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.byReason).map(([reason, count]) => (
              <Badge key={reason} variant="outline" className="text-xs">
                {getReasonLabel(reason)}: {count}
              </Badge>
            ))}
          </div>
        )}

        {/* Retry Button */}
        {hasRetryableFailures && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => retryMutation.mutate({ automationId, nodeId })}
            disabled={retryMutation.isPending}
          >
            {retryMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry Failed ({failures?.filter(f => 
                  !['suppressed', 'opt_out', 'unsubscribed', 'bounced', 'complained'].includes(f.reason || '')
                ).length})
              </>
            )}
          </Button>
        )}

        {/* Failed Executions List */}
        {failures && failures.length > 0 && (
          <Collapsible open={failuresOpen} onOpenChange={setFailuresOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-xs">View failed recipients</span>
                {failuresOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="max-h-48 overflow-y-auto space-y-2">
                {failures.slice(0, 10).map((failure) => (
                  <div key={failure.id} className="text-xs p-2 bg-muted/50 rounded flex justify-between items-start">
                    <div>
                      <div className="font-medium">{failure.email}</div>
                      <div className="text-muted-foreground">
                        {failure.reason ? getReasonLabel(failure.reason) : failure.error || 'Unknown error'}
                      </div>
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(failure.created_at), 'MMM d, HH:mm')}
                    </div>
                  </div>
                ))}
                {failures.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{failures.length - 10} more failures
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
};
