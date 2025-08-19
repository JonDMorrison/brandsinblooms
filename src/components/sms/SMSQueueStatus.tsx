import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Play, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SMSQueueStatusProps {
  queuedMessages: number;
  onRefresh: () => void;
}

export const SMSQueueStatus: React.FC<SMSQueueStatusProps> = ({ 
  queuedMessages, 
  onRefresh 
}) => {
  const [processing, setProcessing] = React.useState(false);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('sms-queue-worker');
      
      if (error) throw error;
      
      toast.success('Queue processing initiated');
      setTimeout(() => {
        onRefresh();
      }, 2000);
    } catch (error) {
      console.error('Error processing queue:', error);
      toast.error('Failed to process queue');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card id="queue">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Message Queue</CardTitle>
          <CardDescription>SMS messages waiting to be sent</CardDescription>
        </div>
        {queuedMessages > 0 && (
          <Button 
            onClick={handleProcessQueue}
            disabled={processing}
            size="sm"
          >
            <Play className="h-4 w-4 mr-2" />
            {processing ? 'Processing...' : 'Process Now'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              {queuedMessages > 0 ? (
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-orange-600" />
                </div>
              ) : (
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold">{queuedMessages}</span>
                {queuedMessages > 0 ? (
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Pending
                  </Badge>
                ) : (
                  <Badge className="bg-green-100 text-green-800">
                    Clear
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {queuedMessages > 0 
                  ? `${queuedMessages} messages waiting`
                  : 'No messages in queue'
                }
              </p>
            </div>
          </div>

          {queuedMessages > 10 && (
            <div className="flex items-center text-orange-600">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-sm">High volume</span>
            </div>
          )}
        </div>

        {queuedMessages > 0 && (
          <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <p className="text-sm text-orange-800">
              Messages are processed automatically every 5 minutes, or you can trigger processing manually.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};