import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Card from "@mui/joy/Card";
import Chip from "@mui/joy/Chip";
import Link from "@mui/joy/Link";
import List from "@mui/joy/List";
import ListDivider from "@mui/joy/ListDivider";
import ListItem from "@mui/joy/ListItem";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { SMSStats } from "@/hooks/useSMSStats";

interface SMSRecentMessagesProps {
  messages: SMSStats["recentMessages"];
  loading?: boolean;
}

export const SMSRecentMessages: React.FC<SMSRecentMessagesProps> = ({
  messages,
  loading = false,
}) => {
  const navigate = useNavigate();

  const getStatusTone = React.useCallback((status: string) => {
    const normalized = status.trim().toLowerCase();

    switch (normalized) {
      case "delivered":
      case "completed":
        return { color: "success" as const, label: "Delivered" };
      case "sent":
        return { color: "primary" as const, label: "Sent" };
      case "queued":
      case "sending":
      case "processing":
        return { color: "warning" as const, label: "Queued" };
      case "failed":
      case "error":
        return { color: "danger" as const, label: "Failed" };
      case "received":
      case "inbound":
        return { color: "success" as const, label: "Received" };
      default:
        return {
          color: "neutral" as const,
          label:
            normalized.length > 0
              ? normalized.charAt(0).toUpperCase() + normalized.slice(1)
              : "Sent",
        };
    }
  }, []);

  const getDirectionMeta = React.useCallback((status: string) => {
    const normalized = status.trim().toLowerCase();

    if (normalized === "received" || normalized === "inbound") {
      return {
        icon: ArrowDownLeft,
        color: "success" as const,
      };
    }

    return {
      icon: ArrowUpRight,
      color: "primary" as const,
    };
  }, []);

  const maskPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ***-${cleaned.slice(7)}`;
    }
    if (cleaned.length >= 10) {
      return `(${cleaned.slice(0, 3)}) ***-${cleaned.slice(-4)}`;
    }
    return phone.replace(/.(?=.{4})/g, "*");
  };

  return (
    <Card
      id="messages"
      variant="outlined"
      sx={{
        borderRadius: "24px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        overflow: "hidden",
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={2}
        sx={{
          px: 2.5,
          py: 2.25,
          borderBottom: "1px solid",
          borderColor: "neutral.100",
        }}
      >
        <Typography level="title-md" fontWeight="lg">
          Recent Messages
        </Typography>
        <Link
          component="button"
          type="button"
          level="body-sm"
          color="neutral"
          underline="none"
          endDecorator={<ArrowRight size={14} />}
          onClick={() => navigate("/sms/messages")}
          sx={{ fontWeight: "md" }}
        >
          View All
        </Link>
      </Stack>

      {loading ? (
        <List sx={{ px: 2.5, py: 1.25 }}>
          {Array.from({ length: 5 }).map((_, index) => (
            <React.Fragment key={index}>
              <ListItem sx={{ alignItems: "center", gap: 1.5, px: 0, py: 1.5 }}>
                <ListItemDecorator>
                  <Skeleton variant="circular" width={32} height={32} />
                </ListItemDecorator>
                <ListItemContent>
                  <Stack spacing={0.75}>
                    <Skeleton
                      variant="text"
                      sx={{ width: "42%", height: 16 }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{ width: "76%", height: 14 }}
                    />
                  </Stack>
                </ListItemContent>
                <Stack
                  spacing={0.75}
                  alignItems="flex-end"
                  sx={{ minWidth: 88 }}
                >
                  <Skeleton variant="text" sx={{ width: 54, height: 14 }} />
                  <Skeleton
                    variant="rectangular"
                    sx={{ width: 66, height: 24, borderRadius: "999px" }}
                  />
                </Stack>
              </ListItem>
              {index < 4 ? <ListDivider inset="gutter" /> : null}
            </React.Fragment>
          ))}
        </List>
      ) : messages.length === 0 ? (
        <Box
          sx={{
            minHeight: 260,
            display: "grid",
            placeItems: "center",
            px: 3,
            py: 8,
            textAlign: "center",
          }}
        >
          <Stack spacing={2} alignItems="center" sx={{ maxWidth: 360 }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: "neutral.500",
                opacity: 0.45,
                "& > .lucide": {
                  width: 52,
                  height: 52,
                },
              }}
            >
              <MessageSquare />
            </Box>
            <Stack spacing={0.75}>
              <Typography level="title-md">No recent messages</Typography>
              <Typography level="body-sm" color="neutral">
                SMS activity across your account will appear here.
              </Typography>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <List sx={{ px: 2.5, py: 1.25 }}>
          {messages.slice(0, 6).map((message, index) => {
            const direction = getDirectionMeta(message.status);
            const statusTone = getStatusTone(message.status);
            const DirectionIcon = direction.icon;

            return (
              <React.Fragment key={message.id}>
                <ListItem
                  sx={{ px: 0, py: 1.5, alignItems: "center", gap: 1.5 }}
                >
                  <ListItemDecorator>
                    <Avatar size="sm" variant="soft" color={direction.color}>
                      <DirectionIcon size={14} />
                    </Avatar>
                  </ListItemDecorator>
                  <ListItemContent sx={{ minWidth: 0 }}>
                    <Typography level="body-sm" fontWeight="md">
                      {maskPhone(message.phone)}
                    </Typography>
                    <Typography
                      level="body-xs"
                      color="neutral"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {message.content}
                    </Typography>
                  </ListItemContent>
                  <Stack
                    spacing={0.75}
                    alignItems="flex-end"
                    sx={{ minWidth: 92, flexShrink: 0 }}
                  >
                    <Typography level="body-xs" color="neutral">
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                      })}
                    </Typography>
                    <Chip size="sm" variant="soft" color={statusTone.color}>
                      {statusTone.label}
                    </Chip>
                  </Stack>
                </ListItem>
                {index < Math.min(messages.length, 6) - 1 ? (
                  <ListDivider inset="gutter" />
                ) : null}
              </React.Fragment>
            );
          })}
        </List>
      )}
    </Card>
  );
};
