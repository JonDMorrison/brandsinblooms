import * as React from "react";
import Alert from "@mui/joy/Alert";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import LinearProgress from "@mui/joy/LinearProgress";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle, Clock3, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface SMSQueueStatusProps {
  queuedMessages: number;
  loading?: boolean;
  onRefresh: () => void;
}

export const SMSQueueStatus: React.FC<SMSQueueStatusProps> = ({
  queuedMessages,
  loading = false,
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
      variant="outlined"
      sx={{
        borderRadius: "24px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        p: 2.25,
      }}
    >
      {loading ? (
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <Stack spacing={0.75}>
              <Skeleton variant="text" sx={{ width: 112, height: 18 }} />
              <Skeleton variant="text" sx={{ width: 188, height: 14 }} />
            </Stack>
            <Skeleton
              variant="rectangular"
              sx={{ width: 84, height: 28, borderRadius: "999px" }}
            />
          </Stack>
          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 96, borderRadius: "18px" }}
          />
          <Skeleton
            variant="rectangular"
            sx={{ width: "100%", height: 12, borderRadius: "999px" }}
          />
        </Stack>
      ) : queuedMessages === 0 ? (
        <Stack spacing={2.25}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography level="title-md" fontWeight="lg">
                Message Queue
              </Typography>
              <Typography level="body-sm" color="neutral">
                No messages are currently waiting to send.
              </Typography>
            </Stack>
            <Chip size="sm" variant="soft" color="success">
              Clear
            </Chip>
          </Stack>

          <Box
            sx={{
              minHeight: 180,
              borderRadius: "18px",
              border: "1px dashed",
              borderColor: "neutral.300",
              backgroundColor: "background.level1",
              display: "grid",
              placeItems: "center",
              px: 3,
              py: 5,
              textAlign: "center",
            }}
          >
            <Stack spacing={1.5} alignItems="center" sx={{ maxWidth: 320 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: "16px",
                  display: "grid",
                  placeItems: "center",
                  backgroundColor:
                    "rgba(var(--joy-palette-success-mainChannel) / 0.08)",
                  color: "success.600",
                }}
              >
                <Clock3 size={20} />
              </Box>
              <Stack spacing={0.75}>
                <Typography level="title-md">Queue is clear</Typography>
                <Typography level="body-sm" color="neutral">
                  New scheduled or batched sends will appear here when they are
                  waiting for the worker.
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={2}
          >
            <Stack spacing={0.5}>
              <Typography level="title-md" fontWeight="lg">
                Message Queue
              </Typography>
              <Typography level="body-sm" color="neutral">
                {queuedMessages} messages are waiting for the worker to process.
              </Typography>
            </Stack>
            <Chip size="sm" variant="soft" color="warning">
              Pending
            </Chip>
          </Stack>

          <Box
            sx={{
              borderRadius: "18px",
              border: "1px solid",
              borderColor: "warning.200",
              backgroundColor:
                "rgba(var(--joy-palette-warning-mainChannel) / 0.08)",
              px: 2,
              py: 2,
            }}
          >
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                spacing={2}
              >
                <Box>
                  <Typography
                    level="h2"
                    sx={{
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                    }}
                  >
                    {queuedMessages}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    queued messages
                  </Typography>
                </Box>
                <Button
                  onClick={handleProcessQueue}
                  disabled={processing}
                  size="sm"
                  startDecorator={
                    processing ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Play size={15} />
                    )
                  }
                  sx={{ borderRadius: "12px" }}
                >
                  {processing ? "Processing..." : "Process Now"}
                </Button>
              </Stack>

              <LinearProgress
                determinate={false}
                color={processing ? "success" : "warning"}
                sx={{ borderRadius: "999px", height: 10 }}
              />
            </Stack>
          </Box>

          <Alert
            variant="soft"
            color={queuedMessages > 10 ? "warning" : "neutral"}
            startDecorator={
              queuedMessages > 10 ? (
                <AlertCircle size={16} />
              ) : (
                <Clock3 size={16} />
              )
            }
            sx={{ alignItems: "flex-start", borderRadius: "16px" }}
          >
            <Box>
              <Typography level="body-sm" fontWeight="md">
                Messages are processed automatically every 5 minutes.
              </Typography>
              <Typography level="body-xs" color="neutral">
                You can also run the worker manually from here whenever you need
                to clear the backlog sooner.
              </Typography>
            </Box>
          </Alert>
        </Stack>
      )}
    </Card>
  );
};
