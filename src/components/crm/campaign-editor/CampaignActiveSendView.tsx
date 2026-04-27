import * as React from "react";
import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
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
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Eye,
  MailCheck,
  Pause,
  Send,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip } from "@/components/joy/JoyChip";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  CAMPAIGN_STATUS,
  getCampaignStatusLabel,
  isCampaignStatus,
  isDeliveredCampaignStatus,
  isQueuedCampaignStatus,
  isTerminalCampaignStatus,
  type CampaignStatus,
} from "@/constants/campaignStatuses";

type CampaignRow = Database["public"]["Tables"]["crm_campaigns"]["Row"];

type ActiveCampaignSnapshot = {
  id: string;
  tenantId: string | null;
  name: string;
  subjectLine: string;
  senderName: string;
  senderEmail: string;
  replyTo: string;
  status: CampaignStatus;
  queuedAt: string | null;
  queueStartedAt: string | null;
  queueCompletedAt: string | null;
  sendStartedAt: string | null;
  sendCompletedAt: string | null;
  sentAt: string | null;
  scheduledAt: string | null;
  totalRecipients: number;
  totalBatches: number;
  messagesSent: number;
  messagesFailed: number;
  messagesSkipped: number;
  workerHeartbeatAt: string | null;
  estimatedCompletionAt: string | null;
};

type RealtimeState = "connecting" | "connected" | "reconnecting";
type PhaseState = "done" | "current" | "pending";

const POLL_INTERVAL_MS = 15_000;
const TERMINAL_VIEW_DELAY_MS = 1_500;
const ACTIVE_SEND_STATUSES = [
  CAMPAIGN_STATUS.QUEUED,
  CAMPAIGN_STATUS.PARTIALLY_QUEUED,
  CAMPAIGN_STATUS.SENDING,
] as const satisfies readonly CampaignStatus[];

type CampaignProgressPollRow = Pick<
  CampaignRow,
  | "status"
  | "messages_sent"
  | "messages_failed"
  | "messages_skipped"
  | "total_recipients"
  | "total_batches"
  | "worker_heartbeat_at"
  | "estimated_completion_at"
  | "send_completed_at"
  | "sent_at"
>;

function isActiveSendCampaignStatus(
  value: string | null | undefined,
): value is (typeof ACTIVE_SEND_STATUSES)[number] {
  return (
    Boolean(value) &&
    (ACTIVE_SEND_STATUSES as readonly string[]).includes(value)
  );
}

function asNumber(value: unknown) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function getMetadataValue(row: CampaignRow, key: string) {
  const metadata = row.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return "";
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : "";
}

function normalizeCampaignRow(row: CampaignRow): ActiveCampaignSnapshot {
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
      getMetadataValue(row, "senderName"),
    senderEmail: row.actual_sender_email || row.sender_email || "",
    replyTo: getMetadataValue(row, "replyTo") || row.sender_email || "",
    status,
    queuedAt: row.queued_at,
    queueStartedAt: row.queue_started_at,
    queueCompletedAt: row.queue_completed_at,
    sendStartedAt: row.send_started_at,
    sendCompletedAt: row.send_completed_at,
    sentAt: row.sent_at,
    scheduledAt: row.scheduled_at,
    totalRecipients: asNumber(row.total_recipients ?? row.total_sent),
    totalBatches: asNumber(row.total_batches),
    messagesSent: asNumber(row.messages_sent),
    messagesFailed: asNumber(row.messages_failed),
    messagesSkipped: asNumber(row.messages_skipped),
    workerHeartbeatAt: row.worker_heartbeat_at,
    estimatedCompletionAt: row.estimated_completion_at,
  };
}

async function fetchActiveCampaignSnapshot(
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

function mergePolledCampaignProgress(
  snapshot: ActiveCampaignSnapshot | null,
  row: CampaignProgressPollRow,
) {
  if (!snapshot) {
    return null;
  }

  return {
    ...snapshot,
    status: isCampaignStatus(row.status) ? row.status : snapshot.status,
    totalRecipients:
      row.total_recipients === null
        ? snapshot.totalRecipients
        : asNumber(row.total_recipients),
    totalBatches:
      row.total_batches === null
        ? snapshot.totalBatches
        : asNumber(row.total_batches),
    messagesSent: asNumber(row.messages_sent),
    messagesFailed: asNumber(row.messages_failed),
    messagesSkipped: asNumber(row.messages_skipped),
    workerHeartbeatAt: row.worker_heartbeat_at,
    estimatedCompletionAt: row.estimated_completion_at,
    sendCompletedAt: row.send_completed_at,
    sentAt: row.sent_at,
  };
}

function formatTimestamp(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function formatEta(value: string | null) {
  if (!value) return "Calculating ETA";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Calculating ETA";
  return `ETA ${formatDistanceToNow(date, { addSuffix: true })}`;
}

function getPhaseState(
  phase: "preparing" | "sending" | "complete",
  status: CampaignStatus,
): PhaseState {
  const sending = status === CAMPAIGN_STATUS.SENDING;
  const complete = isTerminalCampaignStatus(status);

  if (phase === "preparing") {
    if (sending || complete) return "done";
    return "current";
  }
  if (phase === "sending") {
    if (complete) return "done";
    return sending ? "current" : "pending";
  }
  return complete ? "current" : "pending";
}

function PhaseStep({
  label,
  detail,
  state,
}: {
  label: string;
  detail: string;
  state: PhaseState;
}) {
  const isDone = state === "done";
  const isCurrent = state === "current";

  return (
    <Stack
      direction="row"
      spacing={1.25}
      alignItems="flex-start"
      sx={{ minWidth: 0 }}
    >
      <Box
        sx={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          border: "1px solid",
          borderColor: isDone
            ? "success.300"
            : isCurrent
              ? "primary.300"
              : "neutral.200",
          backgroundColor: isDone
            ? "success.100"
            : isCurrent
              ? "primary.100"
              : "background.surface",
          color: isDone
            ? "success.700"
            : isCurrent
              ? "primary.700"
              : "neutral.400",
        }}
      >
        {isDone ? (
          <CheckCircle2 size={15} />
        ) : isCurrent ? (
          <Send size={14} />
        ) : (
          <Clock3 size={14} />
        )}
      </Box>
      <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography level="body-sm" fontWeight="lg">
          {label}
        </Typography>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {detail}
        </Typography>
      </Stack>
    </Stack>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
  bumped = false,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "success" | "warning";
  bumped?: boolean;
}) {
  const color =
    tone === "success"
      ? "success.700"
      : tone === "warning"
        ? "warning.700"
        : "neutral.900";

  return (
    <Sheet variant="outlined" sx={{ borderRadius: "md", p: 2, minHeight: 104 }}>
      <Stack spacing={0.75}>
        <Typography level="body-xs" sx={{ color: "neutral.500" }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <Typography level="h3" fontWeight="xl" sx={{ color }}>
            {value.toLocaleString()}
          </Typography>
          <Box
            sx={{
              opacity: bumped ? 1 : 0,
              transform: bumped ? "translateY(-2px)" : "translateY(4px)",
              transition: "opacity 180ms ease, transform 180ms ease",
              color: "success.600",
            }}
          >
            <ArrowUpRight size={18} />
          </Box>
        </Stack>
      </Stack>
    </Sheet>
  );
}

function buildSnapshotFallback(input: {
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
}): ActiveCampaignSnapshot {
  return {
    id: input.campaignId,
    tenantId: input.tenantId ?? null,
    name: input.name || "Untitled Campaign",
    subjectLine: input.subjectLine,
    senderName: input.senderName,
    senderEmail: input.senderEmail,
    replyTo: input.replyTo || input.senderEmail,
    status: input.status,
    queuedAt: null,
    queueStartedAt: null,
    queueCompletedAt: null,
    sendStartedAt: null,
    sendCompletedAt: null,
    sentAt: null,
    scheduledAt: input.sendAt?.toISOString() ?? null,
    totalRecipients: input.audienceCount ?? 0,
    totalBatches: 0,
    messagesSent: 0,
    messagesFailed: 0,
    messagesSkipped: 0,
    workerHeartbeatAt: null,
    estimatedCompletionAt: null,
  };
}

export function CampaignActiveSendView({
  onPreview,
}: {
  onPreview: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
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
    pause,
    syncLiveCampaign,
  } = useCampaignEditor();
  const [realtimeState, setRealtimeState] =
    React.useState<RealtimeState>("connecting");
  const [pauseOpen, setPauseOpen] = React.useState(false);
  const [pauseError, setPauseError] = React.useState<string | null>(null);
  const [isPausing, setIsPausing] = React.useState(false);
  const [pollingError, setPollingError] = React.useState<string | null>(null);
  const [showReportAction, setShowReportAction] = React.useState(false);
  const [sentBumped, setSentBumped] = React.useState(false);
  const previousSentRef = React.useRef(0);
  const latestSnapshotRef = React.useRef<ActiveCampaignSnapshot | null>(null);
  const latestEditorStatusRef = React.useRef(status);
  const terminalSyncTimeoutRef = React.useRef<number | null>(null);
  const pendingTerminalStatusRef = React.useRef<CampaignStatus | null>(null);
  const tenantId = tenant?.id;
  const activeQueryKey = React.useMemo(
    () => ["campaign-active-send", tenantId, campaignId] as const,
    [tenantId, campaignId],
  );
  const fallbackSnapshot = React.useMemo(
    () =>
      campaignId
        ? buildSnapshotFallback({
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
          })
        : null,
    [
      audienceCount,
      campaignId,
      name,
      replyTo,
      sendAt,
      senderEmail,
      senderName,
      status,
      subjectLine,
      tenantId,
    ],
  );

  const campaignQuery = useQuery({
    queryKey: activeQueryKey,
    enabled: Boolean(campaignId && tenantId),
    queryFn: () =>
      fetchActiveCampaignSnapshot(campaignId as string, tenantId as string),
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  });

  const snapshot = campaignQuery.data ?? fallbackSnapshot;
  const snapshotStatus = snapshot?.status;

  const clearPendingTerminalSync = React.useCallback(() => {
    if (terminalSyncTimeoutRef.current !== null) {
      window.clearTimeout(terminalSyncTimeoutRef.current);
      terminalSyncTimeoutRef.current = null;
    }
    pendingTerminalStatusRef.current = null;
  }, []);

  React.useEffect(() => {
    latestSnapshotRef.current = snapshot;
  }, [snapshot]);

  React.useEffect(() => {
    latestEditorStatusRef.current = status;
  }, [status]);

  React.useEffect(() => {
    return () => {
      clearPendingTerminalSync();
    };
  }, [clearPendingTerminalSync]);

  React.useEffect(() => {
    if (!campaignId || !tenantId) return;

    setRealtimeState("connecting");
    const channel = supabase
      .channel(`campaign-active-send:${tenantId}:${campaignId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "crm_campaigns",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const nextRow = payload.new as CampaignRow | null;
          if (!nextRow || nextRow.id !== campaignId) return;
          const nextSnapshot = normalizeCampaignRow(nextRow);
          latestSnapshotRef.current = nextSnapshot;
          queryClient.setQueryData(activeQueryKey, nextSnapshot);
        },
      )
      .subscribe((nextStatus) => {
        if (nextStatus === "SUBSCRIBED") {
          setRealtimeState("connected");
          return;
        }
        if (
          nextStatus === "CHANNEL_ERROR" ||
          nextStatus === "TIMED_OUT" ||
          nextStatus === "CLOSED"
        ) {
          setRealtimeState("reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeQueryKey, campaignId, queryClient, tenantId]);

  React.useEffect(() => {
    const nextSnapshot = campaignQuery.data;
    if (!nextSnapshot) {
      return;
    }

    const nextStatus = nextSnapshot.status;
    if (nextStatus === latestEditorStatusRef.current) {
      return;
    }

    if (
      isActiveSendCampaignStatus(latestEditorStatusRef.current) &&
      isTerminalCampaignStatus(nextStatus)
    ) {
      if (pendingTerminalStatusRef.current === nextStatus) {
        return;
      }

      clearPendingTerminalSync();
      pendingTerminalStatusRef.current = nextStatus;
      terminalSyncTimeoutRef.current = window.setTimeout(() => {
        terminalSyncTimeoutRef.current = null;
        pendingTerminalStatusRef.current = null;
        latestEditorStatusRef.current = nextStatus;
        syncLiveCampaign({
          campaignId: nextSnapshot.id,
          status: nextStatus,
        });
      }, TERMINAL_VIEW_DELAY_MS);
      return;
    }

    clearPendingTerminalSync();
    latestEditorStatusRef.current = nextStatus;
    syncLiveCampaign({
      campaignId: nextSnapshot.id,
      status: nextStatus,
    });
  }, [campaignQuery.data, clearPendingTerminalSync, syncLiveCampaign]);

  React.useEffect(() => {
    if (!campaignId || !tenantId || !snapshotStatus) {
      return;
    }

    if (!isActiveSendCampaignStatus(snapshotStatus)) {
      return;
    }

    let intervalId: number | null = null;
    let isMounted = true;

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const pollCampaignProgress = async () => {
      const currentSnapshot = latestSnapshotRef.current ?? fallbackSnapshot;
      if (!isMounted || !currentSnapshot) {
        return;
      }

      const { data, error } = await supabase
        .from("crm_campaigns")
        .select(
          "status, messages_sent, messages_failed, messages_skipped, total_recipients, total_batches, worker_heartbeat_at, estimated_completion_at, send_completed_at, sent_at",
        )
        .eq("id", campaignId)
        .eq("tenant_id", tenantId)
        .single();

      if (!isMounted) {
        return;
      }

      if (error || !data) {
        setPollingError(
          error?.message ?? "Live campaign updates are temporarily delayed.",
        );
        return;
      }

      setPollingError(null);
      const mergedSnapshot = mergePolledCampaignProgress(
        currentSnapshot,
        data as CampaignProgressPollRow,
      );
      if (!mergedSnapshot) {
        return;
      }

      latestSnapshotRef.current = mergedSnapshot;
      queryClient.setQueryData(activeQueryKey, mergedSnapshot);

      if (!isActiveSendCampaignStatus(mergedSnapshot.status)) {
        stopPolling();
      }
    };

    const startPolling = () => {
      if (intervalId !== null || document.visibilityState === "hidden") {
        return;
      }

      intervalId = window.setInterval(() => {
        void pollCampaignProgress();
      }, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (!isMounted) {
        return;
      }

      if (document.visibilityState === "visible") {
        void pollCampaignProgress();
        if (isActiveSendCampaignStatus(latestSnapshotRef.current?.status)) {
          startPolling();
        }
        return;
      }

      stopPolling();
    };

    if (document.visibilityState === "visible") {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    activeQueryKey,
    campaignId,
    fallbackSnapshot,
    queryClient,
    snapshotStatus,
    tenantId,
  ]);

  React.useEffect(() => {
    if (!snapshot) return;
    if (snapshot.messagesSent > previousSentRef.current) {
      setSentBumped(true);
      const timeout = window.setTimeout(() => setSentBumped(false), 700);
      previousSentRef.current = snapshot.messagesSent;
      return () => window.clearTimeout(timeout);
    }
    previousSentRef.current = snapshot.messagesSent;
  }, [snapshot?.messagesSent, snapshot]);

  const isDelivered = snapshot
    ? isDeliveredCampaignStatus(snapshot.status)
    : false;
  const isTerminal = snapshot
    ? isTerminalCampaignStatus(snapshot.status)
    : false;
  const backgroundRefreshError = pollingError ?? campaignQuery.error;
  const backgroundRefreshErrorMessage =
    typeof backgroundRefreshError === "string"
      ? backgroundRefreshError
      : backgroundRefreshError instanceof Error
        ? backgroundRefreshError.message
        : backgroundRefreshError
          ? "Live campaign updates are temporarily delayed."
          : null;
  const lastUpdatedAt = campaignQuery.dataUpdatedAt
    ? new Date(campaignQuery.dataUpdatedAt)
    : null;
  const lastUpdatedLabel = lastUpdatedAt
    ? formatDistanceToNow(lastUpdatedAt, { addSuffix: true })
    : null;

  React.useEffect(() => {
    if (!isDelivered) {
      setShowReportAction(false);
      return;
    }

    const timeout = window.setTimeout(() => setShowReportAction(true), 2000);
    return () => window.clearTimeout(timeout);
  }, [isDelivered]);

  if (!snapshot || !campaignId) {
    return (
      <Sheet
        variant="outlined"
        sx={{ borderRadius: "lg", p: 4, textAlign: "center" }}
      >
        <CircularProgress size="sm" />
      </Sheet>
    );
  }

  const isQueued = isQueuedCampaignStatus(snapshot.status);
  const isSending = snapshot.status === CAMPAIGN_STATUS.SENDING;
  const canPause = isQueued || isSending;
  const totalRecipients = snapshot.totalRecipients || audienceCount || 0;
  const messagesSent = snapshot.messagesSent;
  const messagesFailed = snapshot.messagesFailed;
  const remaining = Math.max(
    0,
    totalRecipients - messagesSent - messagesFailed,
  );
  const progress =
    totalRecipients > 0
      ? Math.min(100, Math.round((messagesSent / totalRecipients) * 100))
      : isDelivered
        ? 100
        : 0;
  const progressColor =
    snapshot.status === CAMPAIGN_STATUS.FAILED
      ? "danger"
      : snapshot.status === CAMPAIGN_STATUS.SENT_WITH_ERRORS
        ? "warning"
        : isDelivered
          ? "success"
          : "primary";
  const heartbeatTime = snapshot.workerHeartbeatAt
    ? new Date(snapshot.workerHeartbeatAt).getTime()
    : null;
  const staleHeartbeat =
    isSending &&
    heartbeatTime !== null &&
    Date.now() - heartbeatTime > 5 * 60 * 1000;
  const completionTime = snapshot.sendCompletedAt || snapshot.sentAt;
  const title =
    snapshot.status === CAMPAIGN_STATUS.FAILED
      ? "Campaign stopped before completion"
      : isDelivered
        ? snapshot.status === CAMPAIGN_STATUS.SENT_WITH_ERRORS
          ? "Campaign complete with delivery errors"
          : "Campaign complete"
        : isSending
          ? "Delivering your campaign"
          : "Campaign accepted. Preparing the queue.";
  const detail =
    snapshot.status === CAMPAIGN_STATUS.FAILED
      ? `${messagesSent.toLocaleString()} of ${totalRecipients.toLocaleString()} recipients were delivered before sending stopped.`
      : isDelivered
        ? `${messagesSent.toLocaleString()} emails delivered through the provider.`
        : isSending
          ? `${messagesSent.toLocaleString()} of ${totalRecipients.toLocaleString()} recipients sent.`
          : "Recipients are being batched before provider delivery begins.";

  const handlePause = async () => {
    setPauseError(null);
    setIsPausing(true);
    try {
      await pause();
      setPauseOpen(false);
    } catch (error) {
      setPauseError(
        error instanceof Error
          ? error.message
          : "The campaign could not be paused.",
      );
    } finally {
      setIsPausing(false);
    }
  };

  return (
    <>
      <Stack
        spacing={3}
        sx={{ maxWidth: 920, mx: "auto", py: { xs: 2, md: 4 } }}
      >
        <Sheet
          className="bg-card"
          variant="outlined"
          sx={{
            borderRadius: "lg",
            p: { xs: 2, md: 3 },
            backgroundColor: "background.surface",
          }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  useFlexGap
                  flexWrap="wrap"
                >
                  <JoyChip
                    size="sm"
                    variant="soft"
                    color={
                      isTerminal
                        ? progressColor
                        : isSending
                          ? "primary"
                          : "neutral"
                    }
                  >
                    {getCampaignStatusLabel(snapshot.status)}
                  </JoyChip>
                  {backgroundRefreshErrorMessage && snapshot ? (
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      sx={{ color: "warning.700" }}
                      title={
                        lastUpdatedLabel
                          ? `${backgroundRefreshErrorMessage} Last successful update ${lastUpdatedLabel}.`
                          : backgroundRefreshErrorMessage
                      }
                    >
                      <AlertTriangle size={13} />
                      <Typography level="body-xs" sx={{ color: "warning.700" }}>
                        {lastUpdatedLabel
                          ? `Last updated ${lastUpdatedLabel}`
                          : "Live updates delayed"}
                      </Typography>
                    </Stack>
                  ) : realtimeState !== "connected" && !isTerminal ? (
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Reconnecting...
                    </Typography>
                  ) : null}
                </Stack>
                <Typography level="h2" fontWeight="xl">
                  {title}
                </Typography>
                <Typography
                  level="body-sm"
                  sx={{ color: "neutral.600", maxWidth: 620 }}
                >
                  {detail}
                </Typography>
              </Stack>
              <Box sx={{ textAlign: { xs: "left", md: "right" } }}>
                <Typography level="h1" fontWeight="xl">
                  {progress}%
                </Typography>
                <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                  {isTerminal
                    ? formatTimestamp(completionTime)
                    : formatEta(snapshot.estimatedCompletionAt)}
                </Typography>
              </Box>
            </Stack>

            <LinearProgress
              determinate
              value={progress}
              size="lg"
              color={progressColor}
              sx={{
                "--LinearProgress-thickness": "12px",
                "&::before": {
                  transition: "inline-size 0.8s ease !important",
                },
              }}
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <PhaseStep
                label="Preparing"
                detail="Queue accepted and batches created"
                state={getPhaseState("preparing", snapshot.status)}
              />
              <PhaseStep
                label="Provider Delivery"
                detail="Messages moving through delivery"
                state={getPhaseState("sending", snapshot.status)}
              />
              <PhaseStep
                label="Complete"
                detail="Final counts recorded"
                state={getPhaseState("complete", snapshot.status)}
              />
            </Stack>

            {staleHeartbeat ? (
              <Sheet
                variant="soft"
                color="warning"
                sx={{ borderRadius: "md", p: 1.5 }}
              >
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <AlertTriangle
                    size={17}
                    style={{ flexShrink: 0, marginTop: 2 }}
                  />
                  <Typography level="body-sm">
                    Processing is slower than expected. The system will resume
                    automatically.
                  </Typography>
                </Stack>
              </Sheet>
            ) : null}
          </Stack>
        </Sheet>

        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <Box sx={{ flex: 1 }}>
            <MetricTile
              label="Sent"
              value={messagesSent}
              tone="success"
              bumped={sentBumped}
            />
          </Box>
          {messagesFailed > 0 ? (
            <Box sx={{ flex: 1 }}>
              <MetricTile
                label="Failed"
                value={messagesFailed}
                tone="warning"
              />
            </Box>
          ) : null}
          <Box sx={{ flex: 1 }}>
            <MetricTile label="Remaining" value={remaining} />
          </Box>
        </Stack>

        <Sheet
          variant="outlined"
          sx={{ borderRadius: "lg", p: { xs: 2, md: 2.5 } }}
        >
          <Stack spacing={2}>
            <Stack
              direction={{ xs: "column", md: "row" }}
              spacing={2}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
            >
              <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                <Typography level="title-md" fontWeight="lg">
                  Campaign Summary
                </Typography>
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  {snapshot.name}
                </Typography>
              </Stack>
              <JoyButton
                variant="plain"
                color="neutral"
                startDecorator={<Eye size={16} />}
                onClick={onPreview}
              >
                Preview Email
              </JoyButton>
            </Stack>

            <Divider />

            <Stack spacing={1.1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <MailCheck
                  size={16}
                  style={{ color: "var(--joy-palette-neutral-500)" }}
                />
                <Typography
                  level="body-sm"
                  sx={{ minWidth: 92, color: "neutral.500" }}
                >
                  Subject
                </Typography>
                <Typography
                  level="body-sm"
                  sx={{ minWidth: 0, wordBreak: "break-word" }}
                >
                  {snapshot.subjectLine || "No subject line"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Send
                  size={16}
                  style={{ color: "var(--joy-palette-neutral-500)" }}
                />
                <Typography
                  level="body-sm"
                  sx={{ minWidth: 92, color: "neutral.500" }}
                >
                  From
                </Typography>
                <Typography
                  level="body-sm"
                  sx={{ minWidth: 0, wordBreak: "break-word" }}
                >
                  {snapshot.senderName
                    ? `${snapshot.senderName} <${snapshot.senderEmail}>`
                    : snapshot.senderEmail || "No sender"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Users
                  size={16}
                  style={{ color: "var(--joy-palette-neutral-500)" }}
                />
                <Typography
                  level="body-sm"
                  sx={{ minWidth: 92, color: "neutral.500" }}
                >
                  Recipients
                </Typography>
                <Typography level="body-sm">
                  {totalRecipients.toLocaleString()}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <Clock3
                  size={16}
                  style={{ color: "var(--joy-palette-neutral-500)" }}
                />
                <Typography
                  level="body-sm"
                  sx={{ minWidth: 92, color: "neutral.500" }}
                >
                  Time
                </Typography>
                <Typography level="body-sm">
                  {isTerminal
                    ? formatTimestamp(completionTime)
                    : snapshot.scheduledAt
                      ? formatTimestamp(snapshot.scheduledAt)
                      : formatTimestamp(
                          snapshot.queuedAt || snapshot.queueStartedAt,
                        )}
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </Sheet>

        {snapshot.status === CAMPAIGN_STATUS.SENT_WITH_ERRORS ? (
          <Sheet
            variant="soft"
            color="warning"
            sx={{ borderRadius: "lg", p: 2 }}
          >
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <AlertTriangle size={17} />
                <Typography level="body-sm" fontWeight="lg">
                  {messagesFailed.toLocaleString()} emails could not be
                  delivered
                </Typography>
              </Stack>
              <JoyButton
                variant="plain"
                color="warning"
                sx={{ alignSelf: "flex-start" }}
                onClick={() =>
                  navigate(
                    `/crm/campaigns/${campaignId}/recipients?delivery=failed`,
                  )
                }
              >
                View Failed Recipients
              </JoyButton>
            </Stack>
          </Sheet>
        ) : null}

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            {canPause ? (
              <JoyButton
                variant="outlined"
                color="warning"
                startDecorator={<Pause size={16} />}
                onClick={() => setPauseOpen(true)}
              >
                Pause Campaign
              </JoyButton>
            ) : null}
            <JoyButton
              variant="plain"
              color="neutral"
              onClick={() =>
                navigate(`/crm/campaigns/${campaignId}/recipients`)
              }
            >
              View Recipients
            </JoyButton>
          </Stack>

          {isDelivered ? (
            <Box
              sx={{
                opacity: showReportAction ? 1 : 0,
                transform: showReportAction
                  ? "translateY(0)"
                  : "translateY(6px)",
                transition: "opacity 220ms ease, transform 220ms ease",
                pointerEvents: showReportAction ? "auto" : "none",
              }}
            >
              <JoyButton
                variant="solid"
                color="primary"
                onClick={() => navigate(`/crm/campaigns/${campaignId}/report`)}
              >
                View Campaign Report
              </JoyButton>
            </Box>
          ) : null}
        </Stack>
      </Stack>

      <Modal open={pauseOpen} onClose={() => !isPausing && setPauseOpen(false)}>
        <ModalDialog variant="outlined" size="sm">
          <DialogTitle>Pause Campaign?</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              <Typography level="body-sm">
                Sending will stop after in-flight provider requests finish.
                Queued work remains available to resume.
              </Typography>
              {pauseError ? (
                <Sheet
                  variant="soft"
                  color="danger"
                  sx={{ borderRadius: "md", p: 1.25 }}
                >
                  <Typography level="body-sm">{pauseError}</Typography>
                </Sheet>
              ) : null}
            </Stack>
          </DialogContent>
          <DialogActions>
            <JoyButton
              variant="plain"
              color="neutral"
              disabled={isPausing}
              onClick={() => setPauseOpen(false)}
            >
              Back
            </JoyButton>
            <JoyButton
              loading={isPausing}
              color="warning"
              onClick={() => void handlePause()}
            >
              Pause Campaign
            </JoyButton>
          </DialogActions>
        </ModalDialog>
      </Modal>
    </>
  );
}
