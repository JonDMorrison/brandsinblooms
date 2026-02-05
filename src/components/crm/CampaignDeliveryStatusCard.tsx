import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
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
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { AlertTriangle, CheckCircle2, Clock, Info, Mail } from "lucide-react";
import { parseEdgeFunctionError } from "@/utils/campaignSendingErrors";
import { toast } from "sonner";
import { retryFailedEmailMessages } from "@/lib/email/emailRetryService";

type CampaignRow = {
  id: string;
  status: string | null;
  scheduled_at: string | null;
  send_started_at: string | null;
  sent_at: string | null;
  updated_at: string | null;
  send_error: string | null;
  send_blocked_reason: string | null;
};

type ProgressRow = {
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
};

const POLL_MS = 15000;

function isSameCampaign(a: CampaignRow | null, b: CampaignRow | null) {
  if (!a || !b) return false;
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.scheduled_at === b.scheduled_at &&
    a.send_started_at === b.send_started_at &&
    a.sent_at === b.sent_at &&
    a.updated_at === b.updated_at &&
    a.send_error === b.send_error &&
    a.send_blocked_reason === b.send_blocked_reason
  );
}

function isSameProgress(a: ProgressRow | null, b: ProgressRow | null) {
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
}

function formatWhen(iso: string | null | undefined, timezone?: string) {
  if (!iso) return null;
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const local = toZonedTime(new Date(iso), tz);
    return `${format(local, "MMM d, yyyy 'at' h:mm a")} (${tz})`;
  } catch {
    return iso;
  }
}

function sanitizeUserMessage(message?: string | null) {
  const m = (message || "").toLowerCase();
  if (!m) return null;
  if (
    m.includes("schema cache") ||
    m.includes("postgrest") ||
    m.includes("could not find the function")
  ) {
    return "We couldn’t load delivery details right now. Please try again shortly.";
  }
  if (m.includes("permission") || m.includes("rls") || m.includes("jwt")) {
    return "We couldn’t load delivery details for this campaign.";
  }
  return null;
}

export function CampaignDeliveryStatusCard(props: {
  campaignId: string | null | undefined;
  timezone?: string;
}) {
  const { campaignId, timezone } = props;

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [progressUnavailable, setProgressUnavailable] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);

  useEffect(() => {
    if (!campaignId) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const load = async () => {
      // Prefer the SECURITY DEFINER RPC to avoid RLS drift breaking this UI.
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_campaign_delivery_status" as any,
          { p_campaign_id: campaignId },
        );

        if (cancelled) return;

        if (!rpcError) {
          const rpcRow = ((Array.isArray(rpcData) ? rpcData[0] : rpcData) ||
            null) as CampaignRow | null;

          // If RPC returns nothing (unauthorized/not found), we still attempt direct select
          // because some environments may not yet have the RPC.
          if (rpcRow) {
            setCampaign((prev) =>
              isSameCampaign(prev, rpcRow) ? prev : rpcRow,
            );
            return;
          }
        } else {
          if (import.meta.env.DEV) {
            console.warn("Failed to load campaign delivery status via RPC", {
              campaignId,
              error: rpcError,
            });
          }
        }
      } catch (e: any) {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn("Failed to load campaign delivery status via RPC", {
            campaignId,
            error: e,
          });
        }
      }

      const { data, error } = await supabase
        .from("crm_campaigns")
        .select(
          "id,status,scheduled_at,send_started_at,sent_at,updated_at,send_error,send_blocked_reason",
        )
        .eq("id", campaignId)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        if (import.meta.env.DEV) {
          console.warn("Failed to load campaign delivery status", {
            campaignId,
            error,
          });
        }
        return;
      }

      const row = (data || null) as CampaignRow | null;
      setCampaign((prev) => (isSameCampaign(prev, row) ? prev : row));
    };

    load();
    intervalId = window.setInterval(load, POLL_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [campaignId]);

  useEffect(() => {
    if (!campaignId) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const loadProgress = async () => {
      try {
        const { data, error } = await supabase.rpc(
          "get_email_campaign_progress" as any,
          { p_campaign_id: campaignId },
        );

        if (cancelled) return;
        if (error) {
          if (import.meta.env.DEV) {
            console.warn("Failed to load campaign delivery progress", {
              campaignId,
              error,
            });
          }
          setProgressUnavailable(true);
          return;
        }

        const row = (
          Array.isArray(data) ? data[0] : data
        ) as ProgressRow | null;
        if (!row) {
          setProgress((prev) => (prev === null ? prev : null));
          return;
        }

        setProgressUnavailable(false);
        setProgress((prev) => (isSameProgress(prev, row) ? prev : row));
      } catch (e: any) {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn("Failed to load campaign delivery progress", {
            campaignId,
            error: e,
          });
        }
        setProgressUnavailable(true);
      }
    };

    loadProgress();

    // Only poll progress when it’s relevant (sending/queued/etc). For sent/draft it’s stable.
    const status = (campaign?.status || "").toLowerCase();
    const shouldPoll = [
      "sending",
      "queued",
      "partially_queued",
      "sent",
      "sent_with_errors",
      "failed",
    ].includes(status);
    if (shouldPoll) intervalId = window.setInterval(loadProgress, POLL_MS);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [campaignId, campaign?.status]);

  const status = (campaign?.status || "draft").toLowerCase();

  const failedCount = progress?.failed || 0;
  const canRetryFailed = failedCount > 0 && !progressUnavailable;

  const hasAnyScheduleHistory =
    !!campaign?.scheduled_at ||
    !!campaign?.send_started_at ||
    !!campaign?.sent_at;

  const hasAnyProgressSignals = !!progress && (progress.total || 0) > 0;

  const hasAnyDeliverySignals = hasAnyScheduleHistory || hasAnyProgressSignals;

  const lastScheduleRunAtIso =
    campaign?.send_started_at ||
    campaign?.sent_at ||
    progress?.last_attempt_at ||
    progress?.last_sent_at ||
    progress?.last_message_updated_at ||
    campaign?.updated_at ||
    null;

  const lastScheduleRunAt = formatWhen(lastScheduleRunAtIso, timezone);

  const emailsLine = useMemo(() => {
    if (!progress || !progress.total) return null;
    return {
      sent: progress.sent || 0,
      total: progress.total || 0,
      failed: progress.failed || 0,
      skipped: progress.skipped || 0,
    };
  }, [progress]);

  const badge = useMemo(() => {
    if (status === "sent")
      return {
        label: "Completed",
        variant: "default" as const,
        icon: CheckCircle2,
      };
    if (status === "sending")
      return { label: "Sending", variant: "secondary" as const, icon: Clock };
    if (status === "queued" || status === "partially_queued")
      return { label: "Queued", variant: "secondary" as const, icon: Mail };
    if (status === "failed" || status === "sent_with_errors")
      return {
        label: "Needs Review",
        variant: "destructive" as const,
        icon: AlertTriangle,
      };
    return { label: "Status", variant: "secondary" as const, icon: Info };
  }, [status]);

  const errorTextRaw =
    campaign?.send_error || campaign?.send_blocked_reason || null;

  const userError = useMemo(() => {
    if (!errorTextRaw) return null;

    const override = sanitizeUserMessage(errorTextRaw);
    if (override) {
      return {
        title: "Delivery issue",
        description: override,
        action: "Please try again shortly.",
      };
    }

    const parsed = parseEdgeFunctionError({ message: errorTextRaw });

    // Don’t surface raw unknown/technical messages.
    if (parsed.code === "UNKNOWN_ERROR") {
      return {
        title: "Delivery issue",
        description:
          "We couldn’t complete sending this campaign. Please try again.",
        action: parsed.action || "If this keeps happening, contact support.",
      };
    }

    return {
      title: parsed.title,
      description: parsed.description,
      action: parsed.action,
    };
  }, [errorTextRaw]);

  const handleRetryFailed = async () => {
    if (!campaignId) return;

    setShowRetryDialog(false);
    setIsRetryingFailed(true);

    try {
      const result = await retryFailedEmailMessages(campaignId);

      if (result.countReset > 0) {
        toast.success(`Retrying ${result.countReset} failed email(s)`, {
          description:
            result.jobsCreated > 0
              ? `Queued ${result.jobsCreated} retry batch job(s).`
              : undefined,
        });

        // Hide the Delivery issue immediately once retry has started.
        const nowIso = new Date().toISOString();
        setCampaign((prev) =>
          prev
            ? {
                ...prev,
                status: "sending",
                send_error: null,
                send_blocked_reason: null,
                send_started_at: prev.send_started_at || nowIso,
                sent_at: null,
                updated_at: nowIso,
              }
            : prev,
        );
      } else {
        toast.info("No failed emails to retry", {
          description: "There are no failed recipients for this campaign right now.",
        });
      }
    } catch (e: any) {
      toast.error("Failed to retry emails", {
        description: e?.message || "Unknown error",
      });
    } finally {
      setIsRetryingFailed(false);
    }
  };

  if (!campaignId) return null;
  if (!hasAnyDeliverySignals && status === "draft") return null;
  if (status === "scheduled") return null;

  return (
    <div className="space-y-4">
      {(userError || status === "failed" || status === "sent_with_errors") && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-900">
            {userError?.title || "Delivery issue"}
          </AlertTitle>
          <AlertDescription className="text-red-800">
            <div className="space-y-1">
              <p>
                {userError?.description ||
                  "We couldn’t complete sending this campaign."}
              </p>
              {userError?.action && (
                <p className="text-sm text-red-700">{userError.action}</p>
              )}

              {canRetryFailed && (
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isRetryingFailed}
                    onClick={() => setShowRetryDialog(true)}
                    className="border-red-200 text-red-900 hover:bg-red-100"
                  >
                    Retry Failed Messages ({failedCount})
                  </Button>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retry Failed Messages</AlertDialogTitle>
            <AlertDialogDescription>
              This will re-queue {failedCount} failed email(s) to be sent again.
              <br />
              <br />
              If sending fails again, this campaign may return to “Needs Review”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRetryingFailed}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRetryFailed} disabled={isRetryingFailed}>
              {isRetryingFailed ? "Retrying…" : "Retry Messages"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {hasAnyScheduleHistory && (
        <Card className="border-slate-200/70 bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Last Schedule Run</CardTitle>
                <CardDescription>
                  {lastScheduleRunAt
                    ? `Your schedule was last processed ${lastScheduleRunAt}.`
                    : "This campaign has recent delivery activity."}
                </CardDescription>
              </div>
              <Badge variant={badge.variant} className="gap-1">
                <badge.icon className="h-3.5 w-3.5" />
                {badge.label}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-md border bg-white/70 p-3">
                <p className="text-xs text-muted-foreground">Emails</p>
                <p className="text-base font-semibold">
                  {emailsLine
                    ? `${emailsLine.sent} / ${emailsLine.total}`
                    : "—"}
                </p>
                {emailsLine && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Failed {emailsLine.failed} • Skipped {emailsLine.skipped}
                  </p>
                )}
              </div>

              <div className="rounded-md border bg-white/70 p-3">
                <p className="text-xs text-muted-foreground">Last Activity</p>
                <p className="text-base font-semibold">
                  {formatWhen(progress?.last_message_updated_at, timezone) ||
                    "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Updates from recipient delivery events
                </p>
              </div>

              <div className="rounded-md border bg-white/70 p-3">
                <p className="text-xs text-muted-foreground">Details</p>
                <p className="text-sm">
                  {progressUnavailable
                    ? "Delivery details temporarily unavailable"
                    : status === "scheduled"
                      ? "Scheduled"
                      : status === "sending"
                        ? "Sending"
                        : status === "queued" || status === "partially_queued"
                          ? "Queued for sending"
                          : status === "sent"
                            ? "Completed"
                            : status === "failed"
                              ? "Failed"
                              : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Scheduler runs every minute
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
