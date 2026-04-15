import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-legacy/card";
import { Button } from "@/components/ui-legacy/button";
import { Badge } from "@/components/ui-legacy/badge";
import { Clock, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SMSQueueStatusProps {
  queuedMessages: number;
  onRefresh: () => void;
}

export const SMSQueueStatus: React.FC<SMSQueueStatusProps> = ({
  queuedMessages,
  onRefresh,
}) => {
  const [processing, setProcessing] = React.useState(false);

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase.functions.invoke("sms-queue-worker");

      if (error) throw error;

      toast.success("Queue processing initiated");
      window.setTimeout(() => {
        void onRefresh();
      }, 2000);
    } catch (error) {
      console.error("Error processing queue:", error);
      toast.error("Failed to process queue");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card
      id="queue"
      className="rounded-[24px] border border-gray-100 bg-white shadow-sm"
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl ${queuedMessages > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"}`}
            >
              <Clock className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Message Queue
                </CardTitle>
                {queuedMessages > 0 ? (
                  <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50">
                    Pending
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                    Clear
                  </Badge>
                )}
              </div>
              <CardDescription className="mt-1 text-sm text-gray-500">
                {queuedMessages > 0
                  ? `${queuedMessages} messages waiting to be processed`
                  : "0 messages in queue"}
              </CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <span className="text-2xl font-bold tracking-tight text-gray-900">
              {queuedMessages}
            </span>
            {queuedMessages > 0 ? (
              <Button
                onClick={handleProcessQueue}
                disabled={processing}
                size="sm"
                className="h-10 rounded-xl bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700"
              >
                <Play className="h-4 w-4 mr-2" />
                {processing ? "Processing..." : "Process Now"}
              </Button>
            ) : null}
          </div>
        </div>

        {queuedMessages > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            <div className="flex flex-wrap items-center gap-2">
              {queuedMessages > 10 ? <AlertCircle className="h-4 w-4" /> : null}
              Messages are processed automatically every 5 minutes. You can also
              run them manually from here.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
