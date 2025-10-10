import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Clock, Send, Pause, AlertCircle, CheckCircle2 } from 'lucide-react';

interface BulkEmailQueueProps {
  campaignId: string;
  totalRecipients: number;
  onComplete?: () => void;
}

export const BulkEmailQueue = ({ campaignId, totalRecipients, onComplete }: BulkEmailQueueProps) => {
  const [status, setStatus] = useState<'idle' | 'sending' | 'paused' | 'completed' | 'error'>('idle');
  const [sent, setSent] = useState(0);
  const [failed, setFailed] = useState(0);
  const [estimatedTimeMinutes, setEstimatedTimeMinutes] = useState(0);
  const { toast } = useToast();

  // Calculate sending rate based on plan limits
  const EMAILS_PER_MINUTE = 20; // Adjust based on Resend plan
  const BATCH_SIZE = 50;

  useEffect(() => {
    if (totalRecipients > 0) {
      const minutes = Math.ceil(totalRecipients / EMAILS_PER_MINUTE);
      setEstimatedTimeMinutes(minutes);
    }
  }, [totalRecipients]);

  const startSending = async () => {
    setStatus('sending');
    
    try {
      // Call edge function to process campaign in background
      const { data, error } = await supabase.functions.invoke('send-bulk-campaign', {
        body: { 
          campaignId,
          batchSize: BATCH_SIZE,
          rateLimit: EMAILS_PER_MINUTE 
        }
      });

      if (error) throw error;

      // Poll for progress
      const interval = setInterval(async () => {
        const { data: campaign } = await supabase
          .from('crm_campaigns')
          .select('metrics')
          .eq('id', campaignId)
          .single();

        if (campaign?.metrics) {
          const sentCount = (campaign.metrics as any).sent || 0;
          setSent(sentCount);

          if (sentCount >= totalRecipients) {
            clearInterval(interval);
            setStatus('completed');
            onComplete?.();
            toast({
              title: 'Campaign sent!',
              description: `Successfully sent to ${sentCount} recipients`,
            });
          }
        }
      }, 5000); // Poll every 5 seconds

    } catch (error: any) {
      setStatus('error');
      toast({
        title: 'Sending failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = () => {
    const badges = {
      idle: <Badge variant="secondary">Ready to Send</Badge>,
      sending: <Badge variant="default" className="animate-pulse">Sending...</Badge>,
      paused: <Badge variant="outline">Paused</Badge>,
      completed: <Badge className="bg-green-500">Completed</Badge>,
      error: <Badge variant="destructive">Error</Badge>,
    };
    return badges[status];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Bulk Email Queue
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Large list warning */}
        {totalRecipients > 5000 && status === 'idle' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Large campaign detected ({totalRecipients.toLocaleString()} recipients). 
              Estimated time: ~{estimatedTimeMinutes} minutes. Sending will happen in background.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Progress</span>
            <span>{sent.toLocaleString()} / {totalRecipients.toLocaleString()}</span>
          </div>
          <Progress value={(sent / totalRecipients) * 100} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{sent.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{failed}</div>
            <div className="text-xs text-muted-foreground">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {totalRecipients - sent - failed}
            </div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </div>
        </div>

        {/* Estimated time */}
        {status === 'sending' && estimatedTimeMinutes > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Estimated time remaining: ~{Math.ceil((totalRecipients - sent) / EMAILS_PER_MINUTE)} min
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {status === 'idle' && (
            <Button onClick={startSending} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Start Sending
            </Button>
          )}
          {status === 'sending' && (
            <Button variant="outline" onClick={() => setStatus('paused')} className="w-full">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {status === 'completed' && (
            <div className="flex items-center justify-center gap-2 w-full py-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-semibold">Campaign sent successfully!</span>
            </div>
          )}
        </div>

        {/* Rate limit info */}
        <Alert variant="default">
          <AlertDescription className="text-xs">
            Sending rate: {EMAILS_PER_MINUTE} emails/minute. 
            {totalRecipients > 1000 && ' Large campaigns are processed in the background to ensure reliability.'}
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};