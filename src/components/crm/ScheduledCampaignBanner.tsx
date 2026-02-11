import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, Send, Lock, AlertTriangle, X } from "lucide-react";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import {
  ensureQueuedEmailMessagesHaveJobs,
  retryFailedEmailMessages,
} from "@/lib/email/emailRetryService";
import { markEmailCampaignCompletedWithFailures } from "@/lib/email/emailCompletionService";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScheduleSelector, ScheduleOption } from "./ScheduleSelector";

interface ScheduledCampaignBannerProps {
  campaignId?: string | null;
  status: string;
  scheduledAt: string | null;
  timezone?: string;
  onEditSchedule: (newSchedule: ScheduleOption) => void;
  onSendNow: () => void;
  onUnschedule: () => void;
  isProcessing?: boolean;
}

export const ScheduledCampaignBanner: React.FC<
  ScheduledCampaignBannerProps
> = ({
  campaignId,
  status,
  scheduledAt,
  timezone,
  onEditSchedule,
  onSendNow,
  onUnschedule,
  isProcessing = false,
}) => {
  const { toast } = useToast();
  const [showUnscheduleDialog, setShowUnscheduleDialog] = useState(false);
  const [showSendNowDialog, setShowSendNowDialog] = useState(false);

  const [progress, setProgress] = useState<null | {
    campaign_id: string;
    total: number;
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
    last_message_updated_at: string | null;
    last_attempt_at: string | null;
    last_sent_at: string | null;
    is_stuck: boolean;
    stuck_reason: string | null;
  }>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [isRetryingWorker, setIsRetryingWorker] = useState(false);
  const [showRetryFailedDialog, setShowRetryFailedDialog] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [showMarkCompletedDialog, setShowMarkCompletedDialog] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [suppressAttentionUntil, setSuppressAttentionUntil] = useState<
    number | null
  >(null);

  const PROGRESS_POLL_INTERVAL_MS = 15000;

  type RpcFunctionName = keyof Database["public"]["Functions"];

  const hasErrorMessage = (e: unknown): e is { message: string } => {
    if (typeof e !== "object" || e === null) return false;
    if (!("message" in e)) return false;
    return typeof (e as Record<string, unknown>).message === "string";
  };

  const getErrorMessage = (e: unknown) => {
    if (hasErrorMessage(e)) return e.message;
    return "Please try again.";
  };

  const toUserFriendlyProgressMessage = (rawMessage?: string | null) => {
    const m = (rawMessage || "").toLowerCase();
    if (!m) return "Delivery progress is temporarily unavailable.";
    if (
      m.includes("schema cache") ||
      m.includes("could not find the function")
    ) {
      return "Delivery progress is temporarily unavailable.";
    }
    if (
      m.includes("permission") ||
      m.includes("rls") ||
      m.includes("forbidden")
    ) {
      return "Delivery progress is temporarily unavailable.";
    }
    if (m.includes("timeout") || m.includes("network") || m.includes("fetch")) {
      return "Delivery progress is temporarily unavailable.";
    }
    return "Delivery progress is temporarily unavailable.";
  };

  const isSameProgress = useCallback(
    (a: typeof progress, b: typeof progress) => {
      if (!a || !b) return false;
      return (
        a.campaign_id === b.campaign_id &&
        a.total === b.total &&
        a.queued === b.queued &&
        a.sending === b.sending &&
        a.sent === b.sent &&
        a.failed === b.failed &&
        a.skipped === b.skipped &&
        a.last_message_updated_at === b.last_message_updated_at &&
        a.last_attempt_at === b.last_attempt_at &&
        a.last_sent_at === b.last_sent_at &&
        a.is_stuck === b.is_stuck &&
        a.stuck_reason === b.stuck_reason
      );
    },
    [],
  );

  const effectiveStatus = status;
  const isRelevantEffective =
    effectiveStatus === "scheduled" || effectiveStatus === "sending";

  const userTimezone =
    timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const isPastDue = scheduledAt && new Date(scheduledAt) < new Date();
  const isSending = effectiveStatus === "sending";

  const processedCount = useMemo(() => {
    if (!progress) return null;
    return (
      (progress.sent || 0) + (progress.failed || 0) + (progress.skipped || 0)
    );
  }, [progress]);

  const percentComplete = useMemo(() => {
    if (!progress || !progress.total) return null;
    const done = processedCount ?? 0;
    return Math.min(
      100,
      Math.max(0, Math.round((done / progress.total) * 100)),
    );
  }, [progress, processedCount]);

  useEffect(() => {
    if (!isSending || !campaignId) return;

    let cancelled = false;

    const fetchProgress = async () => {
      try {
        const { data, error } = await supabase.rpc(
          "get_email_campaign_progress" as RpcFunctionName,
          { p_campaign_id: campaignId },
        );

        if (cancelled) return;
        if (error) {
          console.warn("Failed to load campaign delivery progress", {
            campaignId,
            error,
          });
          setProgressError((prev) => {
            const next = toUserFriendlyProgressMessage(error.message);
            return prev === next ? prev : next;
          });
          return;
        }

        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          const typed = row as NonNullable<typeof progress>;
          setProgressError(null);
          setProgress((prev) => (isSameProgress(prev, typed) ? prev : typed));
        }
      } catch (e: unknown) {
        if (cancelled) return;
        console.warn("Failed to load campaign delivery progress", {
          campaignId,
          error: e,
        });
        setProgressError((prev) => {
          const next = toUserFriendlyProgressMessage(
            hasErrorMessage(e) ? e.message : undefined,
          );
          return prev === next ? prev : next;
        });
      }
    };

    fetchProgress();
    const intervalId = window.setInterval(
      fetchProgress,
      PROGRESS_POLL_INTERVAL_MS,
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isSending, campaignId, isSameProgress]);

  const handleRetryWorker = async () => {
    if (isRetryingWorker) return;
    setIsRetryingWorker(true);
    try {
      if (campaignId) {
        try {
          const ensured = await ensureQueuedEmailMessagesHaveJobs(campaignId);
          if (ensured.jobsCreated > 0) {
            toast({
              title: "Queued pending work",
              description: `Created ${ensured.jobsCreated} job(s) for ${ensured.queuedCount} queued email(s).`,
            });
          }
        } catch {
          // Non-fatal; we can still try invoking the worker.
        }
      }

      const { error } = await supabase.functions.invoke(
        "process-email-send-queue",
        {
          body: {},
        },
      );
      if (error) throw error;
      toast({ title: "Triggered a retry. Progress should update shortly." });
    } catch (e: unknown) {
      console.warn("Failed to trigger process-email-send-queue", { error: e });
      toast({
        title: "Couldn't trigger a retry. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRetryingWorker(false);
    }
  };

  const failedCount = progress?.failed || 0;
  const canMarkCompleted =
    failedCount > 0 &&
    (progress?.queued || 0) === 0 &&
    (progress?.sending || 0) === 0;

  const handleMarkCompleted = async () => {
    if (!campaignId || isMarkingCompleted) return;
    setShowMarkCompletedDialog(false);
    setIsMarkingCompleted(true);
    try {
      const result = await markEmailCampaignCompletedWithFailures(campaignId);
      if (!result.success) {
        toast({
          title: "Couldn't mark completed",
          description: result.errorMessage || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Marked campaign as completed",
        description: `Kept ${failedCount} failed recipient(s) as failed.`,
      });
    } catch (e: unknown) {
      console.warn("Failed to mark campaign completed", { error: e });
      toast({
        title: "Couldn't mark completed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingCompleted(false);
    }
  };
  const handleRetryFailed = async () => {
    if (!campaignId || isRetryingFailed) return;
    setShowRetryFailedDialog(false);
    setIsRetryingFailed(true);

    try {
      const result = await retryFailedEmailMessages(campaignId);

      if (result.countReset > 0) {
        toast({
          title: `Retrying ${result.countReset} failed email(s)`,
          description:
            result.jobsCreated > 0
              ? `Queued ${result.jobsCreated} retry batch job(s).`
              : undefined,
        });

        // Optimistically clear failed/stuck so the banner doesn't keep showing "Needs Attention".
        const now = Date.now();
        setSuppressAttentionUntil(now + 2 * 60 * 1000);
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                failed: 0,
                queued: (prev.queued || 0) + result.countReset,
                is_stuck: false,
                stuck_reason: null,
                last_message_updated_at: new Date().toISOString(),
              }
            : prev,
        );

        // Kick the worker once so the retry starts immediately.
        try {
          await supabase.functions.invoke("process-email-send-queue", {
            body: {},
          });
        } catch {
          // Non-fatal; scheduler will pick it up.
        }
      } else {
        toast({
          title: "No failed emails to retry",
          description: "There are no failed recipients right now.",
        });
      }
    } catch (e: unknown) {
      toast({
        title: "Failed to retry emails",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    } finally {
      setIsRetryingFailed(false);
    }
  };

  const formatScheduledTime = () => {
    if (!scheduledAt) return "Unknown time";
    try {
      const localDate = toZonedTime(new Date(scheduledAt), userTimezone);
      return format(localDate, "MMMM d, yyyy 'at' h:mm a");
    } catch {
      return scheduledAt;
    }
  };

  // Return null only after hooks run (avoids hook order mismatch when status changes)
  if (!isRelevantEffective) return null;

  const getTimezoneName = () => {
    const timezoneLabels: Record<string, string> = {
      "America/New_York": "ET",
      "America/Chicago": "CT",
      "America/Denver": "MT",
      "America/Los_Angeles": "PT",
      UTC: "UTC",
      "Europe/London": "GMT",
    };
    return timezoneLabels[userTimezone] || userTimezone;
  };

  const handleUnscheduleConfirm = () => {
    setShowUnscheduleDialog(false);
    onUnschedule();
  };

  const handleSendNowConfirm = () => {
    setShowSendNowDialog(false);
    onSendNow();
  };

  // Create current schedule for the selector
  const currentSchedule: ScheduleOption = {
    type: "scheduled",
    date: scheduledAt ? new Date(scheduledAt) : undefined,
    timezone: userTimezone,
  };

  if (isSending) {
    const stuckRaw = !!progress?.is_stuck;
    const isStuck =
      stuckRaw &&
      !(suppressAttentionUntil && Date.now() < suppressAttentionUntil);
    const needsAttention = isStuck || failedCount > 0;
    return (
      <Alert
        className={`mb-6 ${needsAttention ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-200"}`}
      >
        <Clock
          className={`h-4 w-4 animate-pulse ${needsAttention ? "text-amber-600" : "text-blue-600"}`}
        />
        <AlertTitle
          className={`${needsAttention ? "text-amber-800" : "text-blue-800"} flex items-center gap-2`}
        >
          Campaign Sending
          <Badge
            variant="default"
            className={needsAttention ? "bg-amber-600" : "bg-blue-600"}
          >
            {needsAttention ? "Needs Attention" : "In Progress"}
          </Badge>
        </AlertTitle>
        <AlertDescription
          className={`${needsAttention ? "text-amber-700" : "text-blue-700"} mt-2`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              {progress && progress.total > 0 ? (
                <>
                  <p className="font-medium">
                    Sent {progress.sent} of {progress.total}
                    {percentComplete !== null
                      ? ` (${percentComplete}% processed)`
                      : ""}
                  </p>
                  <p className="text-sm mt-1">
                    Sent: {progress.sent} • Failed: {progress.failed} • Queued:{" "}
                    {progress.queued} • Sending: {progress.sending}
                  </p>
                  {failedCount > 0 && (
                    <p className="text-sm mt-1">
                      {failedCount} recipient(s) failed. You can retry failed
                      messages.
                    </p>
                  )}
                  {isStuck && (
                    <p className="text-sm mt-1">
                      {progress.stuck_reason || "Sending appears to be stuck."}{" "}
                      The worker runs every minute; you can also retry now.
                    </p>
                  )}
                </>
              ) : (
                <p>
                  This campaign is currently being sent. Please wait for the
                  process to complete.
                </p>
              )}

              {progressError && (
                <p className="text-sm mt-2 text-muted-foreground">
                  {progressError} Retrying automatically.
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {failedCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRetryFailedDialog(true)}
                  disabled={isRetryingFailed}
                >
                  Retry Failed ({failedCount})
                </Button>
              )}

              {canMarkCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMarkCompletedDialog(true)}
                  disabled={isMarkingCompleted}
                >
                  Mark Completed
                </Button>
              )}

              {isStuck && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryWorker}
                  disabled={isRetryingWorker}
                >
                  Retry Now
                </Button>
              )}
            </div>
          </div>
        </AlertDescription>

        <AlertDialog
          open={showRetryFailedDialog}
          onOpenChange={setShowRetryFailedDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Retry Failed Messages</AlertDialogTitle>
              <AlertDialogDescription>
                This will re-queue {failedCount} failed email(s) to be sent
                again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRetryingFailed}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRetryFailed}
                disabled={isRetryingFailed}
              >
                {isRetryingFailed ? "Retrying…" : "Retry Messages"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={showMarkCompletedDialog}
          onOpenChange={setShowMarkCompletedDialog}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark Campaign as Completed?</AlertDialogTitle>
              <AlertDialogDescription>
                This will mark the campaign as completed while keeping the{" "}
                {failedCount} failed recipient(s) as failed.
                <br />
                <br />
                Your activity metrics will remain as-is.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isMarkingCompleted}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleMarkCompleted}
                disabled={isMarkingCompleted}
              >
                {isMarkingCompleted ? "Marking…" : "Mark Completed"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Alert>
    );
  }

  return (
    <>
      <Alert
        className={`mb-6 ${isPastDue ? "bg-amber-50 border-amber-200" : "bg-primary/5 border-primary/20"}`}
      >
        <Calendar
          className={`h-4 w-4 ${isPastDue ? "text-amber-600" : "text-primary"}`}
        />
        <AlertTitle
          className={`${isPastDue ? "text-amber-800" : "text-primary"} flex items-center gap-2`}
        >
          {isPastDue ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              Past Due - Will Send Soon
            </>
          ) : (
            "Scheduled to Send"
          )}
          <Badge
            variant={isPastDue ? "outline" : "default"}
            className={isPastDue ? "border-amber-600 text-amber-700" : ""}
          >
            <Lock className="h-3 w-3 mr-1" />
            Locked
          </Badge>
        </AlertTitle>
        <AlertDescription
          className={`${isPastDue ? "text-amber-700" : "text-muted-foreground"} mt-2`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="font-medium">
                {formatScheduledTime()} {getTimezoneName()}
              </p>
              {isPastDue && (
                <p className="text-sm mt-1">
                  This campaign will be sent on the next processing run.
                </p>
              )}
              <p className="text-sm mt-1 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                Content editing is locked. Unschedule to make changes.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ScheduleSelector
                schedule={currentSchedule}
                onScheduleChange={onEditSchedule}
                disabled={isProcessing}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSendNowDialog(true)}
                disabled={isProcessing}
              >
                <Send className="h-4 w-4 mr-1" />
                Send Now
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnscheduleDialog(true)}
                disabled={isProcessing}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Unschedule
              </Button>
            </div>
          </div>
        </AlertDescription>
      </Alert>

      {/* Unschedule Confirmation Dialog */}
      <AlertDialog
        open={showUnscheduleDialog}
        onOpenChange={setShowUnscheduleDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unschedule Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This campaign will not send automatically. It will be returned to
              draft status and you can edit the content or reschedule it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnscheduleConfirm}>
              Unschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Now Confirmation Dialog */}
      <AlertDialog open={showSendNowDialog} onOpenChange={setShowSendNowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send Campaign Now?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately start sending the campaign to your audience.
              The scheduled time will be cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSendNowConfirm}
              className="bg-primary"
            >
              <Send className="h-4 w-4 mr-1" />
              Send Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
