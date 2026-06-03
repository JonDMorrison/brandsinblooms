import React from "react";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import CircularProgress from "@mui/joy/CircularProgress";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  Check,
  FileText,
  Mail,
  MessageCircle,
  Smartphone,
  Sparkles,
} from "lucide-react";

interface ContentGenerationLoaderProps {
  /** Coarse real progress (0-100) from the generator milestones. */
  progress: number;
  /** Optional status text from the generator; preferred over the rotating pool. */
  statusMessage?: string;
  /** Pre-formatted month label, e.g. "July 2026". */
  monthName: string;
}

type ChannelStatus = "pending" | "active" | "complete";

// Percentage thresholds that map simulated progress to per-channel state.
// activeAt = channel starts working, doneAt = channel finished.
const CHANNELS = [
  { key: "email", label: "Email", Icon: Mail, activeAt: 15, doneAt: 40 },
  { key: "social", label: "Social", Icon: MessageCircle, activeAt: 40, doneAt: 50 },
  { key: "blog", label: "Blog", Icon: FileText, activeAt: 50, doneAt: 65 },
  { key: "sms", label: "SMS", Icon: Smartphone, activeAt: 65, doneAt: 85 },
] as const;

const getChannelStatus = (percent: number, activeAt: number, doneAt: number): ChannelStatus => {
  if (percent >= doneAt) return "complete";
  if (percent >= activeAt) return "active";
  return "pending";
};

// Rotating status pool. Each phase covers an upper-bound percentage band and
// cycles its messages sequentially so the user sees variety without repeats.
const buildMessagePhases = (monthName: string) => [
  {
    max: 15,
    messages: [
      `Analyzing seasonal trends for ${monthName || "your month"}...`,
      "Identifying key marketing opportunities...",
      "Mapping holiday and event calendar...",
    ],
  },
  {
    max: 40,
    messages: [
      "Composing email subject lines...",
      "Writing email body content...",
      "Crafting call-to-action messaging...",
    ],
  },
  {
    max: 60,
    messages: [
      "Creating Facebook post drafts...",
      "Designing Instagram captions...",
      "Writing engaging social hooks...",
    ],
  },
  {
    max: 80,
    messages: [
      "Drafting blog article outlines...",
      "Writing blog post content...",
      "Optimizing content for SEO...",
    ],
  },
  {
    max: 95,
    messages: [
      "Composing SMS message drafts...",
      "Polishing content across all channels...",
      "Running final quality checks...",
    ],
  },
  {
    max: Infinity,
    messages: [
      "Assembling your content calendar...",
      "Almost there — finalizing your plan...",
    ],
  },
];

type MessagePhase = ReturnType<typeof buildMessagePhases>[number];

const pickMessage = (phases: MessagePhase[], percent: number, tick: number) => {
  const phase = phases.find((entry) => percent < entry.max) ?? phases[phases.length - 1];
  return phase.messages[tick % phase.messages.length];
};

// Simulated-progress tuning. Real progress plateaus at 36% for most of the
// 30-90s wait, so we creep a *display* value forward (never past the ceiling)
// to keep the bar and channel narrative alive until real completion snaps to 100.
// The ceiling stays below the SMS channel's doneAt (85) so the final channel
// keeps its active spinner — and the bar never implies "done" — until the real
// generation finishes and snaps everything to 100.
const SIMULATED_CEILING = 84;
const TICK_MS = 160;
const ROTATE_MS = 3000;
const FADE_MS = 320;

export const ContentGenerationLoader: React.FC<ContentGenerationLoaderProps> = ({
  progress,
  statusMessage,
  monthName,
}) => {
  const messagePhases = React.useMemo(
    () => buildMessagePhases(monthName),
    [monthName],
  );

  const [displayProgress, setDisplayProgress] = React.useState(() =>
    Math.min(Math.max(progress, 0), 100),
  );

  // Refs let the rotation interval read the latest values without resubscribing.
  const displayProgressRef = React.useRef(displayProgress);
  displayProgressRef.current = displayProgress;
  const phasesRef = React.useRef(messagePhases);
  phasesRef.current = messagePhases;
  const tickRef = React.useRef(0);

  const [shownMessage, setShownMessage] = React.useState(() =>
    pickMessage(messagePhases, displayProgress, 0),
  );
  const [messageVisible, setMessageVisible] = React.useState(true);

  // Smoothly advance the displayed progress toward a soft ceiling while real
  // progress is plateaued; snap to 100 the moment generation actually finishes.
  React.useEffect(() => {
    if (progress >= 100) {
      setDisplayProgress(100);
      return;
    }

    const interval = window.setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= SIMULATED_CEILING) {
          return Math.max(prev, progress);
        }
        const increment = Math.max(0.22 * (1 - prev / 140), 0.06);
        const next = Math.min(SIMULATED_CEILING, prev + increment);
        // Never display less than the real reported milestone.
        return Math.max(next, progress);
      });
    }, TICK_MS);

    return () => window.clearInterval(interval);
  }, [progress]);

  // Rotate the status message every few seconds with a fade-out/fade-in. When
  // the generator supplies its own message we show it verbatim and skip rotation.
  React.useEffect(() => {
    if (statusMessage && statusMessage.trim()) {
      return;
    }

    let fadeTimer: number | undefined;
    const interval = window.setInterval(() => {
      setMessageVisible(false);
      fadeTimer = window.setTimeout(() => {
        tickRef.current += 1;
        setShownMessage(
          pickMessage(phasesRef.current, displayProgressRef.current, tickRef.current),
        );
        setMessageVisible(true);
      }, FADE_MS);
    }, ROTATE_MS);

    return () => {
      window.clearInterval(interval);
      if (fadeTimer !== undefined) {
        window.clearTimeout(fadeTimer);
      }
    };
  }, [statusMessage]);

  const roundedProgress = Math.round(displayProgress);
  const message =
    statusMessage && statusMessage.trim() ? statusMessage : shownMessage;

  return (
    <Card
      variant="outlined"
      sx={{
        maxWidth: 640,
        mx: "auto",
        mt: { xs: 2, sm: 4 },
        p: { xs: 3, sm: 4 },
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        borderRadius: "xl",
        bgcolor: "background.surface",
      }}
    >
      {/* A. Hero */}
      <Stack spacing={1.5} sx={{ alignItems: "center" }}>
        <Box
          aria-hidden="true"
          sx={{
            color: "primary.500",
            display: "inline-flex",
            "@keyframes content-loader-pulse": {
              "0%, 100%": { transform: "scale(1)", opacity: 0.9 },
              "50%": { transform: "scale(1.08)", opacity: 1 },
            },
            animation: "content-loader-pulse 2.5s ease-in-out infinite",
          }}
        >
          <Sparkles size={48} />
        </Box>
        <Stack spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography level="h3">Crafting Your Marketing Plan</Typography>
          <Typography color="neutral" level="body-md" sx={{ maxWidth: 420 }}>
            AI is building a multi-channel plan for{" "}
            {monthName || "your selected month"}
          </Typography>
        </Stack>
      </Stack>

      {/* B. Progress bar */}
      <Box
        sx={{
          width: "100%",
          "@keyframes content-loader-glow": {
            "0%, 100%": { boxShadow: "0 0 0 0 var(--joy-palette-primary-100)" },
            "50%": { boxShadow: "0 0 10px 1px var(--joy-palette-primary-200)" },
          },
          borderRadius: "sm",
          animation: "content-loader-glow 2.5s ease-in-out infinite",
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
          <LinearProgress
            determinate
            size="lg"
            thickness={8}
            value={displayProgress}
            sx={{
              flex: 1,
              "--LinearProgress-radius": "8px",
              "&::before": {
                transition: "inset-inline-end 0.4s ease",
              },
            }}
          />
          <Typography level="title-sm" sx={{ minWidth: 40, textAlign: "right" }}>
            {roundedProgress}%
          </Typography>
        </Stack>
      </Box>

      {/* C. Rotating status message */}
      <Box
        sx={{
          minHeight: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            color: "primary.600",
            display: "inline-flex",
            opacity: messageVisible ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          <Sparkles size={16} />
        </Box>
        <Typography
          level="body-md"
          sx={{
            color: "primary.600",
            fontStyle: "italic",
            opacity: messageVisible ? 1 : 0,
            transition: "opacity 0.3s ease",
          }}
        >
          {message}
        </Typography>
      </Box>

      {/* D. Channel indicators */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, minmax(0, 80px))",
            sm: "repeat(4, minmax(0, 80px))",
          },
          gap: 2,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {CHANNELS.map(({ key, label, Icon, activeAt, doneAt }) => {
          const status = getChannelStatus(displayProgress, activeAt, doneAt);
          const color =
            status === "complete"
              ? "success"
              : status === "active"
                ? "primary"
                : "neutral";

          return (
            <Card
              color={color}
              key={key}
              size="sm"
              variant="soft"
              sx={{
                width: "100%",
                alignItems: "center",
                gap: 0.75,
                p: 1.5,
                textAlign: "center",
                transition: "background-color 0.4s ease",
              }}
            >
              <Box
                sx={{
                  alignItems: "center",
                  display: "flex",
                  height: 24,
                  justifyContent: "center",
                }}
              >
                {status === "complete" ? (
                  <Box sx={{ color: "success.500", display: "inline-flex" }}>
                    <Check aria-hidden="true" size={20} />
                  </Box>
                ) : status === "active" ? (
                  <CircularProgress color="primary" size="sm" />
                ) : (
                  <Box sx={{ color: "neutral.400", display: "inline-flex" }}>
                    <Icon aria-hidden="true" size={20} />
                  </Box>
                )}
              </Box>
              <Typography
                level="body-xs"
                sx={{
                  color: status === "pending" ? "neutral.500" : "text.primary",
                }}
              >
                {label}
              </Typography>
            </Card>
          );
        })}
      </Box>

      {/* E. Reassurance */}
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          gap: 0.5,
          justifyContent: "center",
        }}
      >
        <Typography level="body-sm" sx={{ color: "neutral.500" }}>
          This usually takes about 30–60 seconds
        </Typography>
        <Box
          aria-hidden="true"
          sx={{
            display: "inline-flex",
            gap: "3px",
            "@keyframes content-loader-dot": {
              "0%, 80%, 100%": { opacity: 0.25 },
              "40%": { opacity: 1 },
            },
          }}
        >
          {[0, 1, 2].map((dot) => (
            <Box
              key={dot}
              sx={{
                width: 3,
                height: 3,
                borderRadius: "50%",
                bgcolor: "neutral.400",
                animation: "content-loader-dot 1.4s ease-in-out infinite",
                animationDelay: `${dot * 0.2}s`,
              }}
            />
          ))}
        </Box>
      </Box>
    </Card>
  );
};

export default ContentGenerationLoader;
