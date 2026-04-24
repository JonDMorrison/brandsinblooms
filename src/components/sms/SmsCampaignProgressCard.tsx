import Alert from "@mui/joy/Alert";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import CircularProgress from "@mui/joy/CircularProgress";
import Divider from "@mui/joy/Divider";
import LinearProgress from "@mui/joy/LinearProgress";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Send,
  XCircle,
} from "lucide-react";
import { SmsCampaignProgress } from "@/lib/sms/getSmsCampaignProgress";

interface SmsCampaignProgressCardProps {
  progress: SmsCampaignProgress | null;
  loading?: boolean;
  error?: Error | null;
}

function getStatusPresentation(progress: SmsCampaignProgress) {
  const enqueue = (
    progress as SmsCampaignProgress & {
      enqueue?: {
        isEnqueuing?: boolean;
        percentComplete?: number;
      };
    }
  ).enqueue;

  if (enqueue?.isEnqueuing) {
    return { color: "primary" as const, label: "Preparing audience" };
  }

  if (progress.isStalled) {
    return { color: "danger" as const, label: "Stalled" };
  }

  if (progress.isComplete && progress.messages.failed === 0) {
    return { color: "success" as const, label: "Complete" };
  }

  if (progress.isComplete && progress.messages.failed > 0) {
    return { color: "warning" as const, label: "Complete with failures" };
  }

  if (progress.jobs.in_progress > 0) {
    return { color: "primary" as const, label: "Sending" };
  }

  if (progress.jobs.pending > 0) {
    return { color: "warning" as const, label: "Queued" };
  }

  return {
    color: "neutral" as const,
    label: progress.campaignStatus || "Unknown",
  };
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function SmsCampaignProgressCard({
  progress,
  loading,
  error,
}: SmsCampaignProgressCardProps) {
  if (loading && !progress) {
    return (
      <Card
        variant="outlined"
        sx={{ borderRadius: "28px", borderColor: "neutral.200", p: 2.5 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <CircularProgress size="sm" />
          <Typography level="body-sm" color="neutral">
            Loading live delivery progress...
          </Typography>
        </Stack>
      </Card>
    );
  }

  if (error && !progress) {
    return (
      <Card
        variant="outlined"
        sx={{ borderRadius: "28px", borderColor: "danger.200", p: 2.5 }}
      >
        <Alert
          color="danger"
          variant="soft"
          sx={{ borderRadius: "18px", alignItems: "flex-start" }}
        >
          <Stack spacing={0.5}>
            <Typography level="title-sm">
              Unable to load campaign progress
            </Typography>
            <Typography level="body-sm">{error.message}</Typography>
          </Stack>
        </Alert>
      </Card>
    );
  }

  if (!progress) {
    return null;
  }

  const enqueue = (
    progress as SmsCampaignProgress & {
      enqueue?: {
        status?: string;
        totalEstimate?: number;
        totalEnqueued?: number;
        percentComplete?: number;
        isEnqueuing?: boolean;
      };
    }
  ).enqueue;

  const processedMessages =
    progress.messages.sent +
    progress.messages.delivered +
    progress.messages.failed;
  const progressPercent =
    progress.messages.total > 0
      ? Math.round((processedMessages / progress.messages.total) * 100)
      : 0;
  const status = getStatusPresentation(progress);

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: "30px",
        borderColor: "neutral.200",
        overflow: "hidden",
        background:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(248,250,252,1) 100%)",
      }}
    >
      <Stack spacing={2.25} sx={{ p: { xs: 2.5, md: 3 } }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={1.5}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
        >
          <Stack spacing={0.5}>
            <Typography level="title-lg" fontWeight="lg">
              Live Campaign Progress
            </Typography>
            <Typography level="body-sm" color="neutral">
              Real-time preparation, delivery, and failure signals for this
              send.
            </Typography>
          </Stack>
          <Chip
            size="md"
            color={status.color}
            variant="soft"
            startDecorator={<Send size={14} />}
          >
            {status.label}
          </Chip>
        </Stack>

        {progress.isStalled && progress.stallReason ? (
          <Alert
            color="danger"
            variant="soft"
            sx={{ borderRadius: "18px", alignItems: "flex-start" }}
          >
            <Stack spacing={0.5}>
              <Typography level="title-sm">Campaign stalled</Typography>
              <Typography level="body-sm">{progress.stallReason}</Typography>
            </Stack>
          </Alert>
        ) : null}

        {enqueue?.isEnqueuing ? (
          <Sheet
            variant="soft"
            color="primary"
            sx={{ borderRadius: "22px", p: 2 }}
          >
            <Stack spacing={1.25}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography level="title-sm">Audience preparation</Typography>
                <Typography level="body-sm" fontWeight="lg">
                  {`${enqueue.percentComplete ?? 0}%`}
                </Typography>
              </Stack>
              <LinearProgress
                determinate
                value={enqueue.percentComplete ?? 0}
                sx={{ borderRadius: 999, height: 8 }}
              />
              <Typography level="body-xs" color="neutral">
                {`${(enqueue.totalEnqueued ?? 0).toLocaleString()} of ~${(enqueue.totalEstimate ?? 0).toLocaleString()} recipients prepared`}
              </Typography>
            </Stack>
          </Sheet>
        ) : null}

        <Stack spacing={1}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography level="body-sm" fontWeight="lg">
              Delivery progress
            </Typography>
            <Typography level="body-sm" color="neutral">
              {`${processedMessages.toLocaleString()} / ${progress.messages.total.toLocaleString()} processed`}
            </Typography>
          </Stack>
          <LinearProgress
            determinate
            value={progressPercent}
            sx={{ borderRadius: 999, height: 10 }}
          />
        </Stack>

        <BoxGrid>
          <MetricTile
            label="Queued"
            value={progress.messages.queued.toLocaleString()}
            icon={<Clock3 size={16} />}
            color="warning"
          />
          <MetricTile
            label="Sent"
            value={progress.messages.sent.toLocaleString()}
            icon={<MessageSquareText size={16} />}
            color="primary"
          />
          <MetricTile
            label="Delivered"
            value={progress.messages.delivered.toLocaleString()}
            icon={<CheckCircle2 size={16} />}
            color="success"
          />
          <MetricTile
            label="Failed"
            value={progress.messages.failed.toLocaleString()}
            icon={<XCircle size={16} />}
            color="danger"
          />
        </BoxGrid>

        <Divider />

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ md: "center" }}
        >
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip size="sm" variant="soft" color="success">
              {`Delivery ${(progress.rates.deliveredRate * 100).toFixed(1)}%`}
            </Chip>
            <Chip size="sm" variant="soft" color="danger">
              {`Failure ${(progress.rates.failedRate * 100).toFixed(1)}%`}
            </Chip>
            <Chip size="sm" variant="soft" color="neutral">
              {`${progress.jobs.in_progress} active workers`}
            </Chip>
          </Stack>

          <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap">
            <TimestampStat
              label="Scheduled"
              value={formatTimestamp(progress.timestamps.scheduledAt)}
            />
            <TimestampStat
              label="Sent"
              value={formatTimestamp(progress.timestamps.sentAt)}
            />
            <TimestampStat
              label="Last update"
              value={formatTimestamp(
                progress.timestamps.lastJobUpdatedAt ||
                  progress.timestamps.lastMessageUpdatedAt,
              )}
            />
          </Stack>
        </Stack>
      </Stack>
    </Card>
  );
}

function BoxGrid({ children }: { children: React.ReactNode }) {
  return (
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1.25}
      useFlexGap
      flexWrap="wrap"
      sx={{
        "& > *": {
          flex: "1 1 180px",
        },
      }}
    >
      {children}
    </Stack>
  );
}

function MetricTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "danger";
}) {
  return (
    <Sheet variant="soft" color={color} sx={{ borderRadius: "20px", p: 1.75 }}>
      <Stack spacing={0.75}>
        <Stack direction="row" spacing={1} alignItems="center">
          {icon}
          <Typography level="body-xs" color="neutral">
            {label}
          </Typography>
        </Stack>
        <Typography level="title-lg" fontWeight="lg">
          {value}
        </Typography>
      </Stack>
    </Sheet>
  );
}

function TimestampStat({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 100 }}>
      <Typography level="body-xs" color="neutral">
        {label}
      </Typography>
      <Typography level="body-sm" fontWeight="md">
        {value}
      </Typography>
    </Stack>
  );
}
