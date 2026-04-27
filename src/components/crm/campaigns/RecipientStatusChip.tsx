import * as React from "react";
import CircularProgress from "@mui/joy/CircularProgress";
import { Check, Clock, Eye, Flag, MousePointerClick, RotateCcw, SkipForward, XCircle } from "lucide-react";
import { JoyChip } from "@/components/joy/JoyChip";

export type RecipientLiveStatus =
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "skipped"
  | "unsubscribed"
  | "deferred"
  | "rejected"
  | "unknown";

export function normalizeRecipientStatus(value: string | null | undefined): RecipientLiveStatus {
  switch ((value || "").toLowerCase()) {
    case "queued":
      return "queued";
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "open":
    case "opened":
      return "opened";
    case "click":
    case "clicked":
      return "clicked";
    case "bounce":
    case "bounced":
      return "bounced";
    case "complaint":
    case "complained":
      return "complained";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "unsubscribe":
    case "unsubscribed":
      return "unsubscribed";
    case "deferred":
      return "deferred";
    case "rejected":
      return "rejected";
    default:
      return "unknown";
  }
}

export function getRecipientStatusLabel(status: RecipientLiveStatus) {
  switch (status) {
    case "queued":
      return "Queued";
    case "sending":
      return "Sending";
    case "sent":
      return "Sent";
    case "delivered":
      return "Delivered";
    case "opened":
      return "Opened";
    case "clicked":
      return "Clicked";
    case "bounced":
      return "Bounced";
    case "complained":
      return "Complained";
    case "failed":
      return "Failed";
    case "skipped":
      return "Skipped";
    case "unsubscribed":
      return "Unsubscribed";
    case "deferred":
      return "Deferred";
    case "rejected":
      return "Rejected";
    default:
      return "Unknown";
  }
}

export function getRecipientStatusColor(status: RecipientLiveStatus) {
  switch (status) {
    case "sending":
      return "primary" as const;
    case "delivered":
    case "opened":
    case "clicked":
      return "success" as const;
    case "bounced":
    case "deferred":
      return "warning" as const;
    case "complained":
    case "failed":
    case "rejected":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function getStatusIcon(status: RecipientLiveStatus) {
  switch (status) {
    case "queued":
      return <Clock size={13} />;
    case "sending":
      return <CircularProgress size="sm" sx={{ "--CircularProgress-size": "14px" }} />;
    case "delivered":
      return <Check size={13} />;
    case "opened":
      return <Eye size={13} />;
    case "clicked":
      return <MousePointerClick size={13} />;
    case "bounced":
    case "deferred":
      return <RotateCcw size={13} />;
    case "complained":
      return <Flag size={13} />;
    case "failed":
    case "rejected":
      return <XCircle size={13} />;
    case "skipped":
      return <SkipForward size={13} />;
    default:
      return null;
  }
}

export function RecipientStatusChip({
  status,
  size = "sm",
}: {
  status: string | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const normalized = normalizeRecipientStatus(status);
  const icon = getStatusIcon(normalized);

  return (
    <JoyChip
      variant="soft"
      color={getRecipientStatusColor(normalized)}
      size={size}
      startDecorator={icon}
      sx={{ minWidth: 0 }}
    >
      {getRecipientStatusLabel(normalized)}
    </JoyChip>
  );
}