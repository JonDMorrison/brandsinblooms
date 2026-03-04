import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { AlertTriangle, CheckCircle2, Clock, Info, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { retryFailedEmailMessages } from "@/lib/email/emailRetryService";
import { markEmailCampaignCompletedWithFailures } from "@/lib/email/emailCompletionService";
import { useCampaignGovernanceVisibility } from "@/hooks/useCampaignGovernanceVisibility";
import { parseEdgeFunctionError } from "@/utils/campaignSendingErrors";

type CampaignRow = {
  id: string;
  status: string | null;
  scheduled_at: string | null;
  send_started_at: string | null;
  sent_at: string | null;
  updated_at: string | null;
  send_error: string | null;
  send_blocked_reason: string | null;
  is_throttled?: boolean | null;
  throttle_reasons?: string[] | null;
  throttled_at?: string | null;
  throttle_last_evaluated_at?: string | null;
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
const THROTTLED_POLL_MS = 5000;

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
    a.send_blocked_reason === b.send_blocked_reason &&
    a.is_throttled === b.is_throttled &&
    a.throttled_at === b.throttled_at &&
    a.throttle_last_evaluated_at === b.throttle_last_evaluated_at
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

function formatThresholdCategory(category: string) {
  const value = (category || "").toLowerCase();
  if (value === "hard_bounce_rate") return "Hard bounce threshold";
  if (value === "soft_bounce_rate") return "Soft bounce threshold";
  if (value === "complaint_rate") return "Complaint threshold";
  if (value === "failed_delivery_rate") return "Failed delivery threshold";
  if (value === "rapid_negative_trend") return "Rapid negative trend";
  return "Deliverability threshold";
}

function formatPauseCategory(category: string | null | undefined) {
  const value = (category || "").toLowerCase();
  if (value === "paused_by_user" || value === "paused") {
    return "Campaign is currently paused.";
  }
  if (value === "account_under_review") {
    return "Campaign is paused while your account is under review.";
  }
  if (value === "reputation_restricted") {
    return "Campaign is paused due to current reputation restrictions.";
  }
  if (value === "reputation_critical") {
    return "Campaign is paused due to critical reputation risk.";
  }
  if (value === "deliverability_threshold") {
    return "Campaign is paused because a deliverability threshold was exceeded.";
  }
  return "Campaign is currently paused.";
}

function formatStatusLabel(status: string | null | undefined) {
  const raw = (status || "").trim();
  if (!raw) return "Unknown";

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function CampaignDeliveryStatusCard(props: {
  campaignId: string | null | undefined;
  timezone?: string;
}) {
  const { campaignId, timezone } = props;
  const { data: governanceVisibility } =
    useCampaignGovernanceVisibility(campaignId);

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [progress, setProgress] = useState<ProgressRow | null>(null);
  const [progressUnavailable, setProgressUnavailable] = useState(false);
  const [isStatusRpcMissing, setIsStatusRpcMissing] = useState(false);
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [showMarkCompletedDialog, setShowMarkCompletedDialog] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const effectivePollMs = campaign?.is_throttled ? THROTTLED_POLL_MS : POLL_MS;

  useEffect(() => {
    if (!campaignId) return;

    let cancelled = false;
    let intervalId: number | undefined;

    const load = async () => {
      // Prefer the SECURITY DEFINER RPC to avoid RLS drift breaking this UI.
      if (!isStatusRpcMissing) {
        try {
          const { data: rpcData, error: rpcError } = await supabase.rpc(
            "get_campaign_delivery_status_tenant_safe" as any,
            { p_campaign_id: campaignId },
          );

          if (cancelled) return;

          if (!rpcError) {
            const rpcRow = ((Array.isArray(rpcData) ? rpcData[0] : rpcData) ||
              null) as CampaignRow | null;

            if (rpcRow) {
              setCampaign((prev) =>
                isSameCampaign(prev, rpcRow) ? prev : rpcRow,
              );
              return;
            }
          } else {
            const message = (rpcError.message || "").toLowerCase();
            const code = (rpcError.code || "").toLowerCase();
            const isMissingFunction =
              code === "pgrst202" ||
              code === "42883" ||
              message.includes("could not find the function") ||
              message.includes("schema cache") ||
              message.includes("get_campaign_delivery_status_tenant_safe");

            if (isMissingFunction) {
              setIsStatusRpcMissing(true);
            } else if (import.meta.env.DEV) {
              console.warn("Failed to load campaign delivery status via RPC", {
                campaignId,
                error: rpcError,
              });
            }
          }
        } catch (e: any) {
          if (cancelled) return;
          const message = (e?.message || "").toLowerCase();
          if (
            message.includes("get_campaign_delivery_status_tenant_safe") ||
            message.includes("could not find the function")
          ) {
            setIsStatusRpcMissing(true);
          } else if (import.meta.env.DEV) {
            console.warn("Failed to load campaign delivery status via RPC", {
              campaignId,
              error: e,
            });
          }
        }
      }

      if (cancelled) return;

      // Fallback path when RPC is unavailable.
      const baseSelect =
        "id,status,scheduled_at,send_started_at,sent_at,updated_at,send_error,send_blocked_reason";

      // NOTE: Keep this fallback query restricted to stable columns only.
      // Some DB environments haven't deployed throttling columns on crm_campaigns yet,
      // and selecting unknown columns causes PostgREST to hard-fail with 42703.
      const { data: fallbackRows, error: fallbackError } = await supabase
        .from("crm_campaigns")
        .select(baseSelect)
        .eq("id", campaignId)
        .limit(1);

      if (cancelled) return;

      if (fallbackError) {
        if (import.meta.env.DEV) {
          console.warn("Failed to load campaign delivery status via fallback", {
            campaignId,
            error: fallbackError,
          });
        }
        return;
      }

      const normalizedFallbackRow = ((Array.isArray(fallbackRows)
        ? fallbackRows[0]
        : null) || null) as CampaignRow | null;
      setCampaign((prev) =>
        isSameCampaign(prev, normalizedFallbackRow)
          ? prev
          : normalizedFallbackRow,
      );

      if (cancelled) return;
    };

    load();
    intervalId = window.setInterval(load, effectivePollMs);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [campaignId, effectivePollMs, isStatusRpcMissing]);

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
    if (shouldPoll)
      intervalId = window.setInterval(loadProgress, effectivePollMs);

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [campaignId, campaign?.status, effectivePollMs]);

  const inferredStatusFromProgress = useMemo(() => {
    if (!progress) return null;

    const total = progress.total || 0;
    const queued = progress.queued || 0;
    const sending = progress.sending || 0;
    const sent = progress.sent || 0;
    const failed = progress.failed || 0;
    const skipped = progress.skipped || 0;

    if (sending > 0) return "sending";
    if (queued > 0) return "queued";

    if (total > 0 && sent + failed + skipped >= total) {
      return failed > 0 ? "sent_with_errors" : "sent";
    }

    return null;
  }, [progress]);

  const campaignStatus = (campaign?.status || "").toLowerCase();
  const status =
    campaignStatus && campaignStatus !== "draft"
      ? campaignStatus
      : inferredStatusFromProgress || campaignStatus || "draft";

  const failedCount = progress?.failed || 0;
  const canRetryFailed = failedCount > 0 && !progressUnavailable;
  const canMarkCompleted =
    failedCount > 0 &&
    !progressUnavailable &&
    (progress?.queued || 0) === 0 &&
    (progress?.sending || 0) === 0;

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
    const statusLabel = formatStatusLabel(status);

    if (status === "sent")
      return {
        label: statusLabel,
        variant: "default" as const,
        icon: CheckCircle2,
      };
    if (status === "sending")
      return {
        label: statusLabel,
        variant: "secondary" as const,
        icon: Clock,
      };
    if (status === "queued" || status === "partially_queued")
      return {
        label: statusLabel,
        variant: "secondary" as const,
        icon: Mail,
      };
    if (status === "failed" || status === "sent_with_errors")
      return {
        label: statusLabel,
        variant: "destructive" as const,
        icon: AlertTriangle,
      };
    return {
      label: statusLabel,
      variant: "secondary" as const,
      icon: Info,
    };
  }, [status]);

  const errorTextRaw =
    campaign?.send_error ||
    (campaign?.status === "paused" &&
    campaign?.send_blocked_reason === "paused_by_user"
      ? null
      : campaign?.send_blocked_reason) ||
    null;

  const throttleReasons = (campaign?.throttle_reasons || []).filter(
    (reason): reason is string =>
      typeof reason === "string" && reason.length > 0,
  );
  const throttleReasonLabels = throttleReasons.map((reason) =>
    formatThresholdCategory(reason),
  );

  const pausedReason = formatPauseCategory(
    campaign?.send_blocked_reason || campaign?.send_error,
  );

  const isPaused =
    status === "paused" ||
    (campaign?.send_blocked_reason || "").toLowerCase().includes("paused");

  const pausedNextSteps = useMemo(() => {
    const exceeded = governanceVisibility?.threshold_exceeded || [];

    if (exceeded.some((reason) => reason.includes("complaint_rate"))) {
      return [
        "Pause any high-risk lists and review recent complaint sources.",
        "Tighten segmentation and confirm sender/domain alignment.",
      ];
    }

    if (exceeded.some((reason) => reason.includes("hard_bounce_rate"))) {
      return [
        "Remove invalid recipients and suppress previously bounced contacts.",
        "Verify list import quality and opt-in provenance.",
      ];
    }

    if (exceeded.some((reason) => reason.includes("failed_delivery_rate"))) {
      return [
        "Check sender/domain infrastructure and provider response errors.",
        "Retry after delivery errors stabilize.",
      ];
    }

    return [
      "Review the campaign audience and recent delivery issues.",
      "Resolve the blocking condition, then resume sending.",
    ];
  }, [governanceVisibility?.threshold_exceeded]);

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
          description:
            "There are no failed recipients for this campaign right now.",
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

  const handleMarkCompleted = async () => {
    if (!campaignId) return;

    setShowMarkCompletedDialog(false);
    setIsMarkingCompleted(true);

    try {
      const result = await markEmailCampaignCompletedWithFailures(campaignId);

      if (!result.success) {
        toast.error("Couldn’t mark completed", {
          description: result.errorMessage || "Unknown error",
        });
        return;
      }

      const nowIso = new Date().toISOString();
      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              status: "sent",
              send_error: null,
              send_blocked_reason: null,
              sent_at: prev.sent_at || nowIso,
              updated_at: nowIso,
            }
          : prev,
      );

      toast.success("Marked campaign as completed", {
        description: `Kept ${failedCount} failed recipient(s) as failed.`,
      });
    } catch (e: any) {
      toast.error("Failed to mark completed", {
        description: e?.message || "Unknown error",
      });
    } finally {
      setIsMarkingCompleted(false);
    }
  };

  if (!campaignId) return null;
  if (!hasAnyDeliverySignals && status === "draft") return null;
  if (status === "scheduled") return null;

  return (
    <div className="space-y-4">
      {campaign?.is_throttled && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">Risk warning</AlertTitle>
          <AlertDescription className="text-amber-800">
            <div className="space-y-1">
              <p>
                Sending is temporarily slowed to protect deliverability. Batch
                size is reduced by 50% and delay between batches is increased.
              </p>
              {throttleReasons.length > 0 && (
                <p className="text-sm text-amber-700">
                  Triggered by: {throttleReasonLabels.join(", ")}
                </p>
              )}
              {campaign.throttled_at && (
                <p className="text-sm text-amber-700">
                  Throttled since {formatWhen(campaign.throttled_at, timezone)}.
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

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
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isRetryingFailed}
                      onClick={() => setShowRetryDialog(true)}
                      className="border-red-200 text-red-900 hover:bg-red-100"
                    >
                      Retry Failed Messages ({failedCount})
                    </Button>

                    {canMarkCompleted && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isMarkingCompleted}
                        onClick={() => setShowMarkCompletedDialog(true)}
                        className="border-red-200 text-red-900 hover:bg-red-100"
                      >
                        Mark Completed
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {isPaused && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-700" />
          <AlertTitle className="text-amber-900">Campaign paused</AlertTitle>
          <AlertDescription className="text-amber-800">
            <div className="space-y-1">
              <p>{pausedReason}</p>
              {governanceVisibility?.threshold_exceeded &&
                governanceVisibility.threshold_exceeded.length > 0 && (
                  <p className="text-sm">
                    Threshold exceeded:{" "}
                    {governanceVisibility.threshold_exceeded
                      .map((reason) => formatThresholdCategory(reason))
                      .join(", ")}
                  </p>
                )}
              <p className="text-sm">Next steps: {pausedNextSteps.join(" ")}</p>
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
              If sending fails again, this campaign may return to “Needs
              Review”.
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
              Your activity metrics (sent/total/last activity) will remain
              as-is.
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

      {hasAnyDeliverySignals && (
        <Card className="border-slate-200/70 bg-gradient-to-br from-white to-slate-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl">
                  Campaign Sending Status
                </CardTitle>
                <CardDescription>
                  {emailsLine
                    ? `Sent ${emailsLine.sent} of ${emailsLine.total} email(s).`
                    : lastScheduleRunAt
                      ? `Last activity ${lastScheduleRunAt}.`
                      : "This campaign has recent delivery activity."}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={badge.variant} className="gap-1">
                  <badge.icon className="h-3.5 w-3.5" />
                  {badge.label}
                </Badge>
              </div>
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
                    : campaign?.is_throttled
                      ? "Sending with protective throttling"
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
