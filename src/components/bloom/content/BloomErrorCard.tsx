import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import { ResultCardShell } from "@/components/bloom/content/cards/ResultCardShell";

export interface BloomErrorIssue {
  path: string | null;
  message: string;
}

interface BloomErrorCardProps {
  message: string;
  issues?: BloomErrorIssue[];
  onRetry?: () => void;
}

export function BloomErrorCard({
  message,
  issues,
  onRetry,
}: BloomErrorCardProps) {
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
        {issues && issues.length > 0 ? (
          <Stack
            spacing={0.5}
            sx={{
              alignSelf: "stretch",
              borderRadius: "var(--joy-radius-sm)",
              backgroundColor: "background.level1",
              p: 1,
            }}
          >
            {issues.map((issue, index) => (
              <Typography
                key={`${issue.path ?? "issue"}-${index}`}
                level="body-xs"
                sx={{ color: "danger.600", fontFamily: "code" }}
              >
                {issue.path ? `${issue.path}: ${issue.message}` : issue.message}
              </Typography>
            ))}
          </Stack>
        ) : null}
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
