import Alert from "@mui/joy/Alert";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { AlertTriangle, Info, Phone, ShieldAlert } from "lucide-react";

interface SmsComplianceWarningsProps {
  messageContent: string;
  isFirstMessage?: boolean;
  hasOptOutText?: boolean;
  recipientCount?: number;
  invalidPhoneCount?: number;
  landlineCount?: number;
  isMms?: boolean;
  hasBrandIdentification?: boolean;
}

type ComplianceNotice = {
  key: string;
  color: "warning" | "danger" | "neutral";
  title: string;
  detail: string;
  icon: React.ReactNode;
};

export default function SmsComplianceWarnings({
  messageContent,
  isFirstMessage = false,
  hasOptOutText,
  recipientCount = 0,
  invalidPhoneCount = 0,
  landlineCount = 0,
  isMms = false,
  hasBrandIdentification,
}: SmsComplianceWarningsProps) {
  const lowerMessage = messageContent.toLowerCase();
  const messageHasOptOut = [
    "stop",
    "unsubscribe",
    "opt out",
    "opt-out",
    "reply stop",
  ].some((keyword) => lowerMessage.includes(keyword));
  const messageHasBrand = ["from", "sent by", "team", "bloomsuite"].some(
    (keyword) => lowerMessage.includes(keyword),
  );
  const finalHasOptOut = hasOptOutText ?? messageHasOptOut;
  const finalHasBrand = hasBrandIdentification ?? messageHasBrand;
  const hasUnicode = Array.from(messageContent).some(
    (character) => character.charCodeAt(0) > 127,
  );
  const segmentLimit = hasUnicode ? 67 : 153;
  const segments = Math.ceil(messageContent.length / segmentLimit) || 1;

  const notices: ComplianceNotice[] = [];

  if (isFirstMessage && !finalHasOptOut) {
    notices.push({
      key: "opt-out",
      color: "danger",
      title: "Missing opt-out language",
      detail:
        'First marketing messages should include instructions like "Reply STOP to unsubscribe" for compliance.',
      icon: <AlertTriangle size={16} />,
    });
  }

  if (isMms && isFirstMessage && !finalHasBrand) {
    notices.push({
      key: "brand",
      color: "warning",
      title: "Add brand identification",
      detail:
        "MMS campaigns perform better when the business name is clear near the start of the message.",
      icon: <Info size={16} />,
    });
  }

  if (invalidPhoneCount > 0) {
    notices.push({
      key: "invalid-phone",
      color: "warning",
      title: "Invalid phone numbers detected",
      detail: `${invalidPhoneCount} recipient${invalidPhoneCount === 1 ? "" : "s"} will be skipped during delivery.`,
      icon: <Phone size={16} />,
    });
  }

  if (landlineCount > 0) {
    notices.push({
      key: "landline",
      color: "warning",
      title: "Possible landlines in audience",
      detail: `${landlineCount} recipient${landlineCount === 1 ? "" : "s"} may not be able to receive SMS messages.`,
      icon: <ShieldAlert size={16} />,
    });
  }

  if (recipientCount > 1000) {
    notices.push({
      key: "large-campaign",
      color: "neutral",
      title: "Large audience",
      detail: `This campaign targets ${recipientCount.toLocaleString()} recipients. Warmup limits and rate controls may stretch delivery time.`,
      icon: <Info size={16} />,
    });
  }

  if (messageContent.length > 160 && segments > 3) {
    notices.push({
      key: "segments",
      color: "warning",
      title: `Long message (${segments} segments)`,
      detail:
        "This message spans multiple SMS segments, which increases delivery cost.",
      icon: <Info size={16} />,
    });
  }

  if (notices.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1.25}>
      {notices.map((notice) => (
        <Alert
          key={notice.key}
          color={notice.color}
          variant="soft"
          sx={{ borderRadius: "18px", alignItems: "flex-start" }}
        >
          <List sx={{ "--List-padding": "0px", gap: 0.35, width: "100%" }}>
            <ListItem sx={{ px: 0, py: 0, alignItems: "flex-start" }}>
              <ListItemDecorator
                sx={{ minWidth: 24, color: `${notice.color}.600`, mt: 0.2 }}
              >
                {notice.icon}
              </ListItemDecorator>
              <Stack spacing={0.25}>
                <Typography level="title-sm">{notice.title}</Typography>
                <Typography level="body-sm">{notice.detail}</Typography>
              </Stack>
            </ListItem>
          </List>
        </Alert>
      ))}
    </Stack>
  );
}
