import { useEffect, useMemo, useRef, useState } from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Sparkles, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CreateFlowRetryDraft } from "@/components/create-flow/createFlowTypes";

type GenerationStatus = "loading" | "pending" | "ready" | "failed" | "timeout";

interface SnapshotContent {
  sourceLabel?: string;
  channels?: string[];
  generationStatus?: "pending" | "ready" | "failed";
  generationError?: string | null;
  generationContext?: {
    selectedChannels?: string[];
    hasMixedCarousel?: boolean;
    carouselPlatform?: "instagram" | "facebook" | null;
    startedAt?: string;
  };
  retryDraft?: CreateFlowRetryDraft;
  items?: unknown[];
}

interface DraftSnapshotRecord {
  id: string;
  doc_id: string;
  doc_type: string;
  created_at: string;
  updated_at: string;
  content: SnapshotContent;
}

interface ContentLibraryGenerationStatusCardProps {
  bundleId: string;
  hidden?: boolean;
  onDismiss: () => void;
  onReview: (bundleId: string, snapshotId?: string) => void;
  onRetry: (draft: CreateFlowRetryDraft | null) => void;
  onReady?: (bundleId: string, snapshotId?: string) => void;
  onFailed?: () => void;
}

const CHANNEL_PHASE_MESSAGES: Record<string, string> = {
  instagram: "Drafting your Instagram post…",
  facebook: "Drafting your Facebook post…",
  newsletter: "Composing your newsletter…",
  blog: "Structuring your blog article…",
  video: "Building your video script…",
};

const TIMEOUT_MESSAGE =
  "Generation is taking longer than expected. Try again or check your Content Library later.";

function getProgressValue(elapsedMs: number, status: GenerationStatus) {
  if (status === "ready") return 100;
  if (status === "failed" || status === "timeout") return 100;

  if (elapsedMs <= 30000) {
    return Math.min(72, (elapsedMs / 30000) * 72);
  }

  const extendedProgress = ((Math.min(elapsedMs, 120000) - 30000) / 90000) * 24;
  return Math.min(96, 72 + extendedProgress);
}

export function ContentLibraryGenerationStatusCard({
  bundleId,
  hidden = false,
  onDismiss,
  onReview,
  onRetry,
  onReady,
  onFailed,
}: ContentLibraryGenerationStatusCardProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<GenerationStatus>("loading");
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const [title, setTitle] = useState("Preparing your content");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [retryDraft, setRetryDraft] = useState<CreateFlowRetryDraft | null>(
    null,
  );
  const [hasMixedCarousel, setHasMixedCarousel] = useState(false);
  const [mixedAlertDismissed, setMixedAlertDismissed] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [progressNow, setProgressNow] = useState(Date.now());

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const readyNotifiedRef = useRef(false);
  const failedNotifiedRef = useRef(false);

  const phaseMessages = useMemo(() => {
    const channelPhases = selectedChannels
      .map((channel) => CHANNEL_PHASE_MESSAGES[channel])
      .filter(Boolean);

    return [
      "Researching seasonal care tips…",
      ...channelPhases,
      "Preparing image guidance…",
      "Finalizing your content bundle…",
    ];
  }, [selectedChannels]);

  const progressValue = useMemo(() => {
    const elapsedMs = startedAt
      ? Math.max(0, progressNow - new Date(startedAt).getTime())
      : 0;
    return getProgressValue(elapsedMs, status);
  }, [progressNow, startedAt, status]);

  const clearSubscription = () => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  const applySnapshot = (record: DraftSnapshotRecord) => {
    const content = record.content || {};
    const nextStatus =
      content.generationStatus ||
      (Array.isArray(content.items) && content.items.length > 0
        ? "ready"
        : "pending");

    setSnapshotId(record.id);
    setTitle(content.sourceLabel || "Preparing your content");
    setStartedAt(content.generationContext?.startedAt || record.created_at);
    setSelectedChannels(
      content.generationContext?.selectedChannels || content.channels || [],
    );
    setRetryDraft(content.retryDraft || null);
    setHasMixedCarousel(Boolean(content.generationContext?.hasMixedCarousel));

    if (nextStatus === "ready") {
      setStatus("ready");
      setErrorMessage(null);
      clearSubscription();

      if (!readyNotifiedRef.current) {
        readyNotifiedRef.current = true;
        queryClient.invalidateQueries({ queryKey: ["content-library"] });
        queryClient.invalidateQueries({ queryKey: ["content-library-count"] });
        onReady?.(bundleId, record.id);
      }
      return;
    }

    if (nextStatus === "failed") {
      setStatus("failed");
      setErrorMessage(
        content.generationError ||
          "We couldn't finish generating this content. Try again.",
      );
      clearSubscription();

      if (!failedNotifiedRef.current) {
        failedNotifiedRef.current = true;
        onFailed?.();
      }
      return;
    }

    setStatus("pending");
    setErrorMessage(null);
  };

  useEffect(() => {
    readyNotifiedRef.current = false;
    failedNotifiedRef.current = false;
    setStatus("loading");
    setSnapshotId(null);
    setTitle("Preparing your content");
    setErrorMessage(null);
    setStartedAt(null);
    setSelectedChannels([]);
    setRetryDraft(null);
    setHasMixedCarousel(false);
    setMixedAlertDismissed(false);
    setPhaseIndex(0);
    clearSubscription();

    let isMounted = true;

    const loadSnapshot = async () => {
      const { data, error } = await supabase
        .from("draft_snapshots")
        .select("id, doc_id, doc_type, created_at, updated_at, content")
        .eq("doc_type", "content_bundle")
        .eq("doc_id", bundleId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus("failed");
        setErrorMessage("We couldn't load the current generation status.");
        onFailed?.();
        return;
      }

      if (data) {
        applySnapshot(data as unknown as DraftSnapshotRecord);
      } else {
        setStatus("pending");
      }
    };

    void loadSnapshot();

    const channel = supabase
      .channel(`content-bundle-generation-${bundleId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "draft_snapshots",
          filter: `doc_id=eq.${bundleId}`,
        },
        (payload) => {
          const record = (payload.new ||
            payload.old) as Partial<DraftSnapshotRecord>;
          if (record.doc_type !== "content_bundle") {
            return;
          }

          applySnapshot(record as DraftSnapshotRecord);
        },
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      clearSubscription();
    };
  }, [bundleId]);

  useEffect(() => {
    if (status !== "pending" && status !== "loading") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      clearSubscription();
      setStatus("timeout");
      setErrorMessage(TIMEOUT_MESSAGE);

      if (!failedNotifiedRef.current) {
        failedNotifiedRef.current = true;
        onFailed?.();
      }
    }, 120000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bundleId, status, onFailed]);

  useEffect(() => {
    if (status !== "pending") {
      return;
    }

    const timerId = window.setInterval(() => {
      setPhaseIndex((currentIndex) =>
        phaseMessages.length > 0
          ? (currentIndex + 1) % phaseMessages.length
          : currentIndex,
      );
    }, 2600);

    return () => {
      window.clearInterval(timerId);
    };
  }, [phaseMessages.length, status]);

  useEffect(() => {
    if (status !== "pending") {
      return;
    }

    const timerId = window.setInterval(() => {
      setProgressNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [status]);

  if (hidden) {
    return null;
  }

  const color =
    status === "ready"
      ? "success"
      : status === "failed" || status === "timeout"
        ? "danger"
        : "primary";

  const message =
    status === "ready"
      ? "Your content is ready"
      : status === "failed" || status === "timeout"
        ? errorMessage || "We couldn't finish generating this content."
        : phaseMessages[phaseIndex] || "Preparing your content…";

  return (
    <Stack spacing={1.5} sx={{ mb: 3 }}>
      <Card
        variant="soft"
        color={color}
        role="status"
        aria-live="polite"
        sx={{
          p: { xs: 2.5, md: 3 },
          gap: 2,
          transition: "background-color 240ms ease, box-shadow 240ms ease",
        }}
      >
        <Box
          key={status}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 2,
            animation: "generation-card-fade 220ms ease",
            "@keyframes generation-card-fade": {
              from: { opacity: 0, transform: "translateY(6px)" },
              to: { opacity: 1, transform: "translateY(0)" },
            },
          }}
        >
          <Stack spacing={0.75}>
            <Typography level="title-md">{title}</Typography>
            <Typography level="body-sm">{message}</Typography>
          </Stack>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            {status === "ready" ? (
              <Button
                color="success"
                startDecorator={<CheckCircle2 size={16} />}
                onClick={() => onReview(bundleId, snapshotId || undefined)}
              >
                Review content
              </Button>
            ) : null}

            {status === "failed" || status === "timeout" ? (
              <>
                <Button
                  color="danger"
                  startDecorator={<Sparkles size={16} />}
                  onClick={() => onRetry(retryDraft)}
                >
                  Try again
                </Button>
                <Button variant="plain" color="neutral" onClick={onDismiss}>
                  Dismiss
                </Button>
              </>
            ) : null}

            {status === "pending" || status === "loading" ? (
              <Button
                variant="plain"
                color="neutral"
                startDecorator={<X size={16} />}
                onClick={onDismiss}
              >
                Dismiss
              </Button>
            ) : null}

            {status === "ready" ? (
              <Button variant="plain" color="neutral" onClick={onDismiss}>
                Dismiss
              </Button>
            ) : null}
          </Box>
        </Box>

        {status === "pending" || status === "loading" ? (
          <Stack spacing={1}>
            <LinearProgress
              determinate
              variant="soft"
              color="primary"
              value={progressValue}
              sx={{ "--LinearProgress-radius": "999px", height: 8 }}
            />
            <Typography level="body-xs" sx={{ color: "text.secondary" }}>
              Expected around 30 seconds. We'll keep monitoring for up to 2
              minutes.
            </Typography>
          </Stack>
        ) : null}
      </Card>

      {(status === "pending" || status === "loading") &&
      hasMixedCarousel &&
      !mixedAlertDismissed ? (
        <Alert
          variant="soft"
          color="neutral"
          startDecorator={<AlertCircle size={16} />}
          endDecorator={
            <Button
              size="sm"
              variant="plain"
              color="neutral"
              onClick={() => setMixedAlertDismissed(true)}
            >
              Dismiss
            </Button>
          }
        >
          Carousel content is handled in the carousel composer. Your standard
          bundle will keep generating here.
        </Alert>
      ) : null}
    </Stack>
  );
}
