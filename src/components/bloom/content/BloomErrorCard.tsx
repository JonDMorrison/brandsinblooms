import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";

interface BloomErrorCardProps {
  message: string;
  onRetry?: () => void;
}

export function BloomErrorCard({ message, onRetry }: BloomErrorCardProps) {
  return (
    <ResultCardShell
      icon={<AlertTriangle size={15} strokeWidth={1.9} />}
      title="Something went wrong"
    >
      <Stack spacing={1.5} alignItems="flex-start">
        <Typography
          level="body-sm"
          sx={{ color: "neutral.700", lineHeight: 1.6 }}
        >
          {message ||
            "I couldn't retrieve that data. This may be temporary; try asking again in a moment."}
        </Typography>
        {onRetry ? (
          <JoyButton
            color="neutral"
            size="sm"
            variant="outlined"
            onClick={onRetry}
          >
            Retry
          </JoyButton>
        ) : null}
      </Stack>
    </ResultCardShell>
  );
}
