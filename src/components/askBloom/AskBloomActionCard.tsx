import * as React from "react";
import Button from "@mui/joy/Button";
import Card from "@mui/joy/Card";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertCircle, CheckCircle2, RotateCw, Zap } from "lucide-react";
import type { AskBloomActionCard as AskBloomActionCardBlock } from "@/types/askBloom";
import { useAskBloom } from "@/providers/AskBloomProvider";

interface AskBloomActionCardProps {
  messageId: string;
  block: AskBloomActionCardBlock;
}

export function AskBloomActionCard({
  messageId,
  block,
}: AskBloomActionCardProps) {
  const askBloom = useAskBloom();
  const [isDimmed, setIsDimmed] = React.useState(false);

  React.useEffect(() => {
    if (block.status !== "completed") {
      setIsDimmed(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsDimmed(true);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [block.status]);

  const handleApply = React.useCallback(() => {
    void askBloom.executeActionCard(messageId, block).catch((error) => {
      console.error("Failed to execute Ask Bloom action", error);
    });
  }, [askBloom, block, messageId]);

  const handleDismiss = React.useCallback(() => {
    askBloom.dismissActionCard(messageId, block.mutationId);
  }, [askBloom, block.mutationId, messageId]);

  const isExecuting =
    block.status === "confirmed" || block.status === "executing";

  const description =
    block.status === "completed"
      ? block.result || "Applied successfully."
      : block.status === "failed"
        ? `Failed: ${block.result || "Something went wrong."}`
        : isExecuting
          ? "Applying..."
          : block.description;

  const color =
    block.status === "completed"
      ? "success"
      : block.status === "failed"
        ? "danger"
        : "primary";

  const variant =
    block.status === "completed" || block.status === "failed"
      ? "soft"
      : "outlined";

  return (
    <Card
      variant={variant}
      color={color}
      size="sm"
      sx={{
        borderRadius: "10px",
        p: 1.25,
        gap: 1,
        borderColor:
          isExecuting && block.status !== "failed"
            ? "primary.300"
            : undefined,
        opacity: isDimmed ? 0.7 : 1,
        transition: "opacity 220ms ease",
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <Stack
          alignItems="center"
          justifyContent="center"
          sx={{
            mt: 0.125,
            color:
              block.status === "completed"
                ? "success.600"
                : block.status === "failed"
                  ? "danger.600"
                  : "primary.500",
          }}
        >
          {block.status === "completed" ? (
            <CheckCircle2 size={16} strokeWidth={1.8} />
          ) : block.status === "failed" ? (
            <AlertCircle size={16} strokeWidth={1.8} />
          ) : (
            <Zap size={16} strokeWidth={1.8} />
          )}
        </Stack>
        <Typography level="body-sm" sx={{ fontWeight: 500 }}>
          {description}
        </Typography>
      </Stack>

      {block.status === "completed" ? null : block.status === "failed" ? (
        <Stack direction="row" spacing={1}>
          <Button
            size="sm"
            variant="solid"
            color="danger"
            startDecorator={<RotateCw size={14} strokeWidth={1.8} />}
            onClick={handleApply}
          >
            Retry
          </Button>
          <Button
            size="sm"
            variant="plain"
            color="neutral"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
        </Stack>
      ) : isExecuting ? (
        <CircularProgress size="sm" thickness={3} />
      ) : (
        <Stack direction="row" spacing={1}>
          <Button size="sm" variant="solid" color="primary" onClick={handleApply}>
            Apply
          </Button>
          <Button
            size="sm"
            variant="plain"
            color="neutral"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
        </Stack>
      )}
    </Card>
  );
}
