import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import DialogActions from "@mui/joy/DialogActions";
import DialogContent from "@mui/joy/DialogContent";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Modal from "@mui/joy/Modal";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Copy,
  Eye,
  MailCheck,
  Pause,
  Play,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import {
  type CampaignActivationResult,
  useCampaignEditor,
} from "@/components/crm/campaign-editor/CampaignEditorContext";
import {
  CAMPAIGN_STATUS,
  isCampaignStatus,
  type CampaignStatus,
} from "@/constants/campaignStatuses";
import { useTenant } from "@/hooks/useTenant";
import { useCampaignCloning } from "@/hooks/useCampaignCloning";
import { useCampaignDerivedMetrics } from "@/hooks/analytics/useCampaignDerivedMetrics";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { retryFailedEmailMessages } from "@/lib/email/emailRetryService";
import { updateCampaignStatus } from "@/lib/crm/campaignEditor";
import { unscheduleCampaign } from "@/utils/crmCampaignService";

type CampaignRow = Database["public"]["Tables"]["crm_campaigns"]["Row"];
type DialogKind =
  | "resume"
  | "retry"
  | "resend"
  | "edit"
  | "send-now"
  | "unschedule";

type CampaignStateSnapshot = {
  id: string;
  tenantId: string | null;
  name: string;
  subjectLine: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  status: CampaignStatus;
  scheduledAt: string | null;
  queuedAt: string | null;
  sendCompletedAt: string | null;
  sentAt: string | null;
  totalRecipients: number;
  messagesSent: number;
  messagesFailed: number;
  messagesSkipped: number;
  workerHeartbeatAt: string | null;
  sendBlockedReason: string | null;
  sendError: string | null;
};

function asNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function getMetadataString(row: CampaignRow, key: string) {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function normalizeCampaignRow(row: CampaignRow): CampaignStateSnapshot {
  const status = isCampaignStatus(row.status)
    ? row.status
    : CAMPAIGN_STATUS.DRAFT;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name || "Untitled Campaign",
    subjectLine: row.subject_line || "",
    senderName:
      row.sender_display_name ||
      row.sender_name ||
      getMetadataString(row, "senderName"),
    senderEmail: row.actual_sender_email || row.sender_email || "",
    replyTo: getMetadataString(row, "replyTo") || row.sender_email || "",
    status,
    scheduledAt: row.scheduled_at,
    queuedAt: row.queued_at,
    sendCompletedAt: row.send_completed_at,
    sentAt: row.sent_at,
    totalRecipients: asNumber(row.total_recipients ?? row.total_sent),
    messagesSent: asNumber(row.messages_sent ?? row.total_sent),
    messagesFailed: asNumber(row.messages_failed),
    messagesSkipped: asNumber(row.messages_skipped),
    workerHeartbeatAt: row.worker_heartbeat_at,
    sendBlockedReason: row.send_blocked_reason,
    sendError: row.send_error,
  };
}

function buildFallbackSnapshot(input: {
  campaignId: string;
  tenantId?: string | null;
  status: CampaignStatus;
  name: string;
  subjectLine: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  audienceCount: number | null;
  sendAt: Date | null;
  sendBlockedReason: string | null;
}): CampaignStateSnapshot {
  return {
    id: input.campaignId,
    tenantId: input.tenantId ?? null,
    name: input.name || "Untitled Campaign",
    subjectLine: input.subjectLine,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    replyTo: input.replyTo || input.senderEmail,
    status: input.status,
    scheduledAt: input.sendAt?.toISOString() ?? null,
    queuedAt: null,
    sendCompletedAt: null,
    sentAt: null,
    totalRecipients: input.audienceCount ?? 0,
    messagesSent: 0,
    messagesFailed: 0,
    messagesSkipped: 0,
    workerHeartbeatAt: null,
    sendBlockedReason: input.sendBlockedReason,
    sendError: null,
  };
}

async function fetchCampaignStateSnapshot(
  campaignId: string,
  tenantId: string,
) {
  const { data, error } = await supabase
    .from("crm_campaigns")
    .select("*")
    .eq("id", campaignId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) throw error;
  return normalizeCampaignRow(data as CampaignRow);
}

function formatCount(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString();
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return `${value.toFixed(1)}%`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function formatRelativeActivity(value: string | null) {
  if (!value) return "Last activity: Not recorded";
  return `Last activity: ${formatDistanceToNow(new Date(value), {
    addSuffix: true,
  })}`;
}

function formatScheduleDisplay(value: string | null) {
  if (!value) return "Sending time not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sending time not set";

  const remainingMs = date.getTime() - Date.now();
  if (remainingMs > 0 && remainingMs < 24 * 60 * 60 * 1000) {
    const totalMinutes = Math.max(1, Math.round(remainingMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hourText = hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : "";
    const minuteText =
      minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "";
    return `Sending in ${[hourText, minuteText].filter(Boolean).join(" ")}`;
  }

  return `Sending on ${format(date, "MMMM d, yyyy 'at' h:mm a")}`;
}

function humanizeReason(value: string | null | undefined) {
  if (!value) return null;
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function getSystemPauseCopy(snapshot: CampaignStateSnapshot) {
  const raw =
    `${snapshot.sendBlockedReason || ""} ${snapshot.sendError || ""}`.toLowerCase();
  if (!raw.trim() || raw.includes("paused_by_user")) return null;

  if (
    raw.includes("intervention") ||
    raw.includes("admin") ||
    raw.includes("force")
  ) {
    return "Sending was paused by the system due to a policy intervention. Contact support for details.";
  }

  if (raw.includes("reputation") || raw.includes("threshold")) {
    return "Sending was paused because your sender reputation dropped below the safe threshold.";
  }

  if (
    raw.includes("domain") ||
    raw.includes("deliverability") ||
    raw.includes("sender")
  ) {
    return "Sending was paused because your email domain encountered a deliverability issue.";
  }

  return "Sending was paused by the system. Review the campaign status before resuming.";
}

function getProgress(snapshot: CampaignStateSnapshot) {
  if (snapshot.totalRecipients <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, (snapshot.messagesSent / snapshot.totalRecipients) * 100),
  );
}

function getRemaining(snapshot: CampaignStateSnapshot) {
  return Math.max(
    0,
    snapshot.totalRecipients -
      snapshot.messagesSent -
      snapshot.messagesFailed -
      snapshot.messagesSkipped,
  );
}

function StateShell({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        animation: "campaign-state-enter 220ms ease-out",
        "@keyframes campaign-state-enter": {
          from: { opacity: 0, transform: "translateY(8px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
      }}
    >
      <Sheet
        className="bg-card"
        variant="outlined"
        sx={{
          maxWidth: 920,
          mx: "auto",
          borderRadius: "lg",
          p: { xs: 2.25, md: 3.5 },
          backgroundColor: "background.surface",
        }}
      >
        <Stack spacing={3} alignItems="stretch">
          <Stack spacing={1.25} alignItems="center" textAlign="center">
            {icon}
            {children}
          </Stack>
        </Stack>
      </Sheet>
    </Box>
  );
}

function SnapshotChip({ label, value }: { label: string; value: number }) {
  return (
    <JoyChip variant="soft" color="neutral" size="sm">
      {label}: {value.toLocaleString()}
    </JoyChip>
  );
}

function MetricCard({
  label,
  value,
  percent,
  color = "neutral",
}: {
  label: string;
  value: number | null | undefined;
  percent?: number | null;
  color?: "neutral" | "success" | "warning";
}) {
  return (
    <Sheet
      variant="soft"
      color={color}
      sx={{ borderRadius: "md", p: 1.75, minWidth: 0, flex: 1 }}
    >
      <Stack spacing={0.5}>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {label}
        </Typography>
        <Typography level="title-lg" fontWeight="xl">
          {formatCount(value)}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {formatPercent(percent)}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function SummaryRows({
  snapshot,
  onPreview,
}: {
  snapshot: CampaignStateSnapshot;
  onPreview: () => void;
}) {
  return (
    <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2, width: "100%" }}>
      <Stack spacing={1.4}>
        <Stack direction="row" justifyContent="space-between" spacing={1.5}>
          <Typography level="title-sm">Campaign Summary</Typography>
          <JoyButton
            variant="plain"
            color="neutral"
            size="sm"
            startDecorator={<Eye size={15} />}
            onClick={onPreview}
          >
            Preview Email
          </JoyButton>
        </Stack>
        <Divider />
        {[
          ["Subject", snapshot.subjectLine || "No subject line"],
          [
            "From",
            snapshot.senderName
              ? `${snapshot.senderName} <${snapshot.senderEmail}>`
              : snapshot.senderEmail || "No sender",
          ],
          [
            "Reply-to",
            snapshot.replyTo || snapshot.senderEmail || "No reply-to",
          ],
        ].map(([label, value]) => (
          <Stack
            key={label}
            direction={{ xs: "column", sm: "row" }}
            spacing={{ xs: 0.25, sm: 2 }}
            justifyContent="space-between"
          >
            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
              {label}
            </Typography>
            <Typography
              level="body-sm"
              sx={{ textAlign: { sm: "right" }, wordBreak: "break-word" }}
            >
              {value}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Sheet>
  );
}

function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  color = "primary",
  loading,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  color?: "primary" | "danger" | "warning";
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={() => !loading && onClose()}>
      <ModalDialog variant="outlined" size="sm">
        <DialogTitle>{title}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography level="body-sm">{description}</Typography>
            {error ? (
              <Alert variant="soft" color="danger">
                {error}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <JoyButton
            variant="plain"
            color="neutral"
            disabled={loading}
            onClick={onClose}
          >
            Back
          </JoyButton>
          <JoyButton color={color} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </JoyButton>
        </DialogActions>
      </ModalDialog>
    </Modal>
  );
}

function useCampaignStateMetrics(campaignId: string | null) {
  const metrics = useCampaignDerivedMetrics(campaignId ?? undefined);
  const refreshRef = React.useRef(metrics.refresh);

  React.useEffect(() => {
    refreshRef.current = metrics.refresh;
  }, [metrics.refresh]);

  React.useEffect(() => {
    if (!campaignId) return;

    let timeout: number | null = null;
    const channel = supabase
      .channel(`campaign-state-metrics-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "email_tracking_events",
          filter: `campaign_id=eq.${campaignId}`,
        },
        () => {
          if (timeout) window.clearTimeout(timeout);
          timeout = window.setTimeout(() => {
            void refreshRef.current();
          }, 1200);
        },
      )
      .subscribe();

    return () => {
      if (timeout) window.clearTimeout(timeout);
      void supabase.removeChannel(channel);
    };
  }, [campaignId]);

  return metrics;
}

export function CampaignLockedView({
  onPreview,
  onReschedule,
}: {
  onPreview: () => void;
  onReschedule: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { cloneCampaign, isCloning } = useCampaignCloning();
  const {
    campaignId,
    status,
    name,
    subjectLine,
    senderName,
    senderEmail,
    replyTo,
    audienceCount,
    sendAt,
    sendBlockedReason,
    activate,
    resume,
    syncLiveCampaign,
  } = useCampaignEditor();
  const [dialogKind, setDialogKind] = React.useState<DialogKind | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);
  const tenantId = tenant?.id;
  const snapshotQueryKey = React.useMemo(
    () => ["campaign-state-layout", tenantId, campaignId] as const,
    [campaignId, tenantId],
  );

  const snapshotQuery = useQuery({
    queryKey: snapshotQueryKey,
    enabled: Boolean(campaignId && tenantId),
    queryFn: () =>
      fetchCampaignStateSnapshot(campaignId as string, tenantId as string),
  });
  const metrics = useCampaignStateMetrics(campaignId);

  const snapshot =
    snapshotQuery.data ??
    (campaignId
      ? buildFallbackSnapshot({
          campaignId,
          tenantId,
          status,
          name,
          subjectLine,
          senderName,
          senderEmail,
          replyTo,
          audienceCount,
          sendAt,
          sendBlockedReason,
        })
      : null);

  React.useEffect(() => {
    if (!campaignId || !tenantId) return;

    const channel = supabase
      .channel(`campaign-state-layout-${tenantId}-${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "crm_campaigns",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const row = payload.new as CampaignRow | null;
          if (!row || row.id !== campaignId) return;

          const nextSnapshot = normalizeCampaignRow(row);
          queryClient.setQueryData(snapshotQueryKey, nextSnapshot);
          if (nextSnapshot.status !== status) {
            syncLiveCampaign({
              campaignId: nextSnapshot.id,
              status: nextSnapshot.status,
              sendBlockedReason: nextSnapshot.sendBlockedReason,
            });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    campaignId,
    queryClient,
    snapshotQueryKey,
    status,
    syncLiveCampaign,
    tenantId,
  ]);

  React.useEffect(() => {
    if (snapshotQuery.data && snapshotQuery.data.status !== status) {
      syncLiveCampaign({
        campaignId: snapshotQuery.data.id,
        status: snapshotQuery.data.status,
        sendBlockedReason: snapshotQuery.data.sendBlockedReason,
      });
    }
  }, [snapshotQuery.data, status, syncLiveCampaign]);

  if (!snapshot || !campaignId) {
    return null;
  }

  const totalRecipients = snapshot.totalRecipients || audienceCount || 0;
  const normalizedSnapshot = { ...snapshot, totalRecipients };
  const remaining = getRemaining(normalizedSnapshot);
  const failedCount = snapshot.messagesFailed;
  const deliveredMetrics = metrics.metrics;
  const deliveredCount = deliveredMetrics?.totals.delivered ?? null;
  const openedCount = deliveredMetrics?.totals.opens ?? null;
  const clickedCount = deliveredMetrics?.totals.clicks ?? null;
  const bouncedCount = deliveredMetrics?.totals.bounces ?? null;
  const deliveredRate = deliveredMetrics?.rates.delivery ?? null;
  const openedRate = deliveredMetrics?.rates.open_reported ?? null;
  const clickedRate = deliveredMetrics?.rates.click ?? null;
  const bouncedRate = deliveredMetrics?.rates.bounce ?? null;
  const failedRate =
    totalRecipients > 0 ? (failedCount / totalRecipients) * 100 : 0;

  const closeDialog = () => {
    if (!actionLoading) {
      setDialogKind(null);
      setActionError(null);
    }
  };

  const finishAction = async () => {
    const [snapshotResult] = await Promise.all([
      snapshotQuery.refetch(),
      metrics.refresh(),
    ]);

    if (snapshotResult.data) {
      syncLiveCampaign({
        campaignId: snapshotResult.data.id,
        status: snapshotResult.data.status,
        sendBlockedReason: snapshotResult.data.sendBlockedReason,
      });
    }
  };

  const handleDuplicate = async () => {
    if (!campaignId) return;
    const clonedId = await cloneCampaign(campaignId, {
      clearScheduling: true,
      newName: `${snapshot.name} (Copy)`,
    });
    if (clonedId) {
      navigate(`/crm/campaigns/${clonedId}`);
    }
  };

  const handleConfirmedAction = async () => {
    if (!dialogKind || !campaignId) return;

    setActionLoading(true);
    setActionError(null);
    try {
      if (dialogKind === "resume") {
        await resume();
        await finishAction();
      }

      if (dialogKind === "retry") {
        const result = await retryFailedEmailMessages(campaignId);
        toast.success(
          `Retry queued for ${result.countReset.toLocaleString()} recipients`,
        );
        await finishAction();
      }

      if (dialogKind === "resend") {
        const { data, error } = await supabase.functions.invoke(
          "resend-missed-recipients",
          {
            body: { campaignId, dryRun: false },
          },
        );
        if (error) throw error;
        if (data?.error) throw new Error(String(data.error));
        const queued = Number(data?.queued || data?.missed || 0);
        if (queued > 0) {
          await updateCampaignStatus(campaignId, CAMPAIGN_STATUS.SENDING, {
            send_blocked_reason: null,
            send_error: null,
          });
        }
        toast.success(
          queued > 0
            ? `Queued ${queued.toLocaleString()} missed recipients`
            : "No missed recipients found",
        );
        await finishAction();
      }

      if (dialogKind === "edit" || dialogKind === "unschedule") {
        const ok = await unscheduleCampaign(campaignId, { silent: true });
        if (!ok)
          throw new Error("The campaign could not be returned to draft.");
        toast.success(
          dialogKind === "edit"
            ? "Campaign returned to draft"
            : "Campaign unscheduled",
        );
        await finishAction();
      }

      if (dialogKind === "send-now") {
        const result: CampaignActivationResult = await activate({
          suppressToasts: true,
          sendImmediately: true,
          sendAt: null,
        });
        if (!result.success) {
          throw new Error(result.error.description || result.error.title);
        }
        toast.success("Campaign queued");
        await finishAction();
      }

      setDialogKind(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "The action could not be completed.",
      );
    } finally {
      setActionLoading(false);
    }
  };

  const dialogConfig = (() => {
    switch (dialogKind) {
      case "resume":
        return {
          title: "Resume Sending",
          description: `Resume sending to the remaining ${remaining.toLocaleString()} recipients?`,
          confirmLabel: "Resume Sending",
          color: "primary" as const,
        };
      case "retry":
        return {
          title: "Retry Failed Recipients",
          description: `Retry ${failedCount.toLocaleString()} failed recipients?`,
          confirmLabel: "Retry Failed Recipients",
          color: "primary" as const,
        };
      case "resend":
        return {
          title: "Resend to Missed Recipients",
          description:
            "Queue a resend for recipients who did not receive this campaign?",
          confirmLabel: "Resend to Missed Recipients",
          color: "primary" as const,
        };
      case "edit":
        return {
          title: "Edit Campaign",
          description:
            "Editing will unschedule this campaign. You'll need to reschedule after making changes.",
          confirmLabel: "Edit Campaign",
          color: "warning" as const,
        };
      case "send-now":
        return {
          title: "Send Now",
          description: `Send this campaign now to ${totalRecipients.toLocaleString()} recipients?`,
          confirmLabel: "Send Now",
          color: "primary" as const,
        };
      case "unschedule":
        return {
          title: "Unschedule Campaign",
          description:
            "Return this campaign to draft and remove the scheduled send time?",
          confirmLabel: "Unschedule",
          color: "danger" as const,
        };
      default:
        return null;
    }
  })();

  const actions = {
    recipients: () => navigate(`/crm/campaigns/${campaignId}/recipients`),
    report: () => navigate(`/crm/campaigns/${campaignId}/report`),
  };

  const renderPausedView = () => {
    const systemPauseCopy = getSystemPauseCopy(snapshot);
    return (
      <StateShell
        icon={<Pause size={48} color="var(--joy-palette-neutral-500)" />}
      >
        <Typography level="h3">Campaign Paused</Typography>
        <Typography level="body-md" sx={{ color: "neutral.600" }}>
          Paused after sending to {snapshot.messagesSent.toLocaleString()} of{" "}
          {totalRecipients.toLocaleString()} recipients
        </Typography>
        {snapshot.messagesFailed > 0 ? (
          <Typography level="body-sm" sx={{ color: "warning.700" }}>
            {snapshot.messagesFailed.toLocaleString()} failed deliveries
          </Typography>
        ) : null}

        <Stack spacing={1.5} sx={{ width: "100%", pt: 1 }}>
          <LinearProgress
            determinate
            value={getProgress(normalizedSnapshot)}
            color="neutral"
          />
          <Stack
            direction="row"
            spacing={1}
            justifyContent="center"
            useFlexGap
            flexWrap="wrap"
          >
            <SnapshotChip label="Sent" value={snapshot.messagesSent} />
            <SnapshotChip label="Failed" value={snapshot.messagesFailed} />
            <SnapshotChip label="Remaining" value={remaining} />
          </Stack>
          <Typography level="body-xs" sx={{ color: "neutral.500" }}>
            {formatRelativeActivity(snapshot.workerHeartbeatAt)}
          </Typography>
        </Stack>

        {systemPauseCopy ? (
          <Alert variant="soft" color="warning" sx={{ width: "100%" }}>
            {systemPauseCopy}
          </Alert>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="center"
          sx={{ width: "100%" }}
        >
          <JoyButton
            variant="solid"
            color="primary"
            startDecorator={<Play size={16} />}
            onClick={() => setDialogKind("resume")}
          >
            Resume Sending
          </JoyButton>
          <JoyButton
            variant="outlined"
            color="neutral"
            startDecorator={<Users size={16} />}
            onClick={actions.recipients}
          >
            View Recipients
          </JoyButton>
          <JoyButton variant="plain" color="neutral" onClick={actions.report}>
            View Report So Far
          </JoyButton>
        </Stack>
      </StateShell>
    );
  };

  const renderFailedView = () => (
    <StateShell
      icon={<AlertTriangle size={48} color="var(--joy-palette-danger-600)" />}
    >
      <Typography level="h3">Campaign Failed</Typography>
      <Typography level="body-md" sx={{ color: "neutral.600" }}>
        This campaign could not complete sending.
      </Typography>

      <Sheet
        variant="soft"
        color="neutral"
        sx={{ borderRadius: "md", p: 2, width: "100%", textAlign: "left" }}
      >
        <Stack spacing={1}>
          <Typography level="body-sm" fontWeight="lg">
            {humanizeReason(snapshot.sendBlockedReason) ||
              humanizeReason(snapshot.sendError) ||
              "Delivery stopped before completion."}
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            {snapshot.messagesSent.toLocaleString()} of{" "}
            {totalRecipients.toLocaleString()} emails were sent before the
            failure.
          </Typography>
          <Typography level="body-sm" sx={{ color: "neutral.600" }}>
            {snapshot.messagesFailed.toLocaleString()} emails failed to deliver.
          </Typography>
          {snapshot.messagesSent > 0 ? (
            <Typography level="body-sm" sx={{ color: "neutral.600" }}>
              Recipients who already received the email are not affected.
            </Typography>
          ) : null}
        </Stack>
      </Sheet>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ width: "100%" }}
      >
        <JoyButton
          variant="solid"
          color="primary"
          startDecorator={<RefreshCw size={16} />}
          onClick={() => setDialogKind("retry")}
        >
          Retry Failed Recipients
        </JoyButton>
        <JoyButton
          variant="outlined"
          color="neutral"
          onClick={() => setDialogKind("resend")}
        >
          Resend to Missed Recipients
        </JoyButton>
        <JoyButton
          variant="outlined"
          color="neutral"
          startDecorator={<Users size={16} />}
          onClick={actions.recipients}
        >
          View Recipients
        </JoyButton>
        <JoyButton
          variant="plain"
          color="neutral"
          loading={isCloning}
          startDecorator={<Copy size={16} />}
          onClick={() => void handleDuplicate()}
        >
          Duplicate as New Campaign
        </JoyButton>
      </Stack>
    </StateShell>
  );

  const renderSentView = (withErrors: boolean) => (
    <StateShell
      icon={
        withErrors ? (
          <AlertTriangle size={48} color="var(--joy-palette-warning-600)" />
        ) : (
          <CheckCircle size={48} color="var(--joy-palette-success-600)" />
        )
      }
    >
      <Typography level="h3">
        {withErrors ? "Campaign Sent with Errors" : "Campaign Sent"}
      </Typography>
      <Typography level="body-md" sx={{ color: "neutral.600" }}>
        {withErrors
          ? `Delivered to ${snapshot.messagesSent.toLocaleString()} recipients. ${snapshot.messagesFailed.toLocaleString()} emails could not be delivered.`
          : `Delivered to ${snapshot.messagesSent.toLocaleString()} recipients on ${formatTimestamp(snapshot.sendCompletedAt || snapshot.sentAt)}`}
      </Typography>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={1.25}
        sx={{ width: "100%" }}
      >
        <MetricCard
          label="Delivered"
          value={deliveredCount}
          percent={deliveredRate}
          color="success"
        />
        <MetricCard label="Opened" value={openedCount} percent={openedRate} />
        <MetricCard
          label="Clicked"
          value={clickedCount}
          percent={clickedRate}
        />
        <MetricCard
          label="Bounced"
          value={bouncedCount}
          percent={bouncedRate}
        />
        {withErrors ? (
          <MetricCard
            label="Failed"
            value={failedCount}
            percent={failedRate}
            color="warning"
          />
        ) : null}
      </Stack>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ width: "100%" }}
      >
        <JoyButton
          variant="solid"
          color="primary"
          startDecorator={<MailCheck size={16} />}
          onClick={actions.report}
        >
          View Full Report
        </JoyButton>
        <JoyButton
          variant="outlined"
          color="neutral"
          startDecorator={<Users size={16} />}
          onClick={actions.recipients}
        >
          View Recipients
        </JoyButton>
        <JoyButton
          variant="plain"
          color="neutral"
          loading={isCloning}
          startDecorator={<Copy size={16} />}
          onClick={() => void handleDuplicate()}
        >
          Duplicate Campaign
        </JoyButton>
        {withErrors ? (
          <JoyButton
            variant="plain"
            color="warning"
            startDecorator={<RefreshCw size={16} />}
            onClick={() => setDialogKind("retry")}
          >
            Retry Failed Recipients
          </JoyButton>
        ) : null}
      </Stack>
    </StateShell>
  );

  const renderScheduledView = () => (
    <StateShell
      icon={<Clock size={48} color="var(--joy-palette-primary-600)" />}
    >
      <Typography level="h3">Scheduled</Typography>
      <Typography
        level="h2"
        sx={{ color: "neutral.900", fontSize: { xs: "1.55rem", md: "2rem" } }}
      >
        {formatScheduleDisplay(snapshot.scheduledAt)}
      </Typography>
      <Typography level="body-md" sx={{ color: "neutral.600" }}>
        To {totalRecipients.toLocaleString()} recipients
      </Typography>

      <SummaryRows snapshot={snapshot} onPreview={onPreview} />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="center"
        useFlexGap
        flexWrap="wrap"
        sx={{ width: "100%" }}
      >
        <JoyButton
          variant="solid"
          color="primary"
          onClick={() => setDialogKind("edit")}
        >
          Edit Campaign
        </JoyButton>
        <JoyButton
          variant="outlined"
          color="neutral"
          startDecorator={<Clock size={16} />}
          onClick={onReschedule}
        >
          Reschedule
        </JoyButton>
        <JoyButton
          variant="outlined"
          color="neutral"
          startDecorator={<Send size={16} />}
          onClick={() => setDialogKind("send-now")}
        >
          Send Now
        </JoyButton>
        <JoyButton
          variant="plain"
          color="danger"
          onClick={() => setDialogKind("unschedule")}
        >
          Unschedule
        </JoyButton>
      </Stack>
    </StateShell>
  );

  const renderedView = (() => {
    switch (snapshot.status) {
      case CAMPAIGN_STATUS.PAUSED:
        return renderPausedView();
      case CAMPAIGN_STATUS.FAILED:
        return renderFailedView();
      case CAMPAIGN_STATUS.SENT:
        return renderSentView(false);
      case CAMPAIGN_STATUS.SENT_WITH_ERRORS:
        return renderSentView(true);
      case CAMPAIGN_STATUS.SCHEDULED:
        return renderScheduledView();
      default:
        return renderScheduledView();
    }
  })();

  return (
    <>
      {renderedView}
      {dialogConfig ? (
        <ConfirmationDialog
          open={Boolean(dialogKind)}
          title={dialogConfig.title}
          description={dialogConfig.description}
          confirmLabel={dialogConfig.confirmLabel}
          color={dialogConfig.color}
          loading={actionLoading}
          error={actionError}
          onClose={closeDialog}
          onConfirm={() => void handleConfirmedAction()}
        />
      ) : null}
    </>
  );
}
