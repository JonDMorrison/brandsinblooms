import * as React from "react";
import Avatar from "@mui/joy/Avatar";
import Box from "@mui/joy/Box";
import Breadcrumbs from "@mui/joy/Breadcrumbs";
import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Link from "@mui/joy/Link";
import List from "@mui/joy/List";
import ListItem from "@mui/joy/ListItem";
import ListItemContent from "@mui/joy/ListItemContent";
import ListItemDecorator from "@mui/joy/ListItemDecorator";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Skeleton from "@mui/joy/Skeleton";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Typography from "@mui/joy/Typography";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FilterX,
  MessageSquareText,
  Search,
} from "lucide-react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { JoyDebouncedInput } from "@/components/joy/JoyDebouncedInput";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyInput } from "@/components/joy/JoyInput";
import { PageContainer } from "@/components/joy/PageContainer";
import { type SMSMessageRecord, useSMSMessages } from "@/hooks/useSMSMessages";

const PAGE_SIZE = 25;
const MOUNT_SKELETON_MS = 260;

type StatusFilter =
  | "all"
  | "delivered"
  | "sent"
  | "failed"
  | "queued"
  | "received";

type DirectionFilter = "all" | "outbound" | "inbound";

type MessageTimelineItem = {
  key: string;
  label: string;
  detail: string;
  timestamp: string;
  color: "primary" | "success" | "warning" | "danger" | "neutral";
};

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "delivered", label: "Delivered" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "queued", label: "Queued" },
  { value: "received", label: "Received" },
];

const directionOptions: Array<{ value: DirectionFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "outbound", label: "Outbound" },
  { value: "inbound", label: "Inbound" },
];

function formatPhoneNumber(phone: string | null) {
  if (!phone) {
    return "--";
  }

  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }

  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }

  return phone;
}

function formatDateTime(value: string | null) {
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
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getRelativeTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
    Math.round((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    "day",
  );
}

function getStatusChip(status: string) {
  switch (status) {
    case "delivered":
      return { color: "success" as const, label: "Delivered" };
    case "sent":
      return { color: "primary" as const, label: "Sent" };
    case "failed":
      return { color: "danger" as const, label: "Failed" };
    case "queued":
      return { color: "warning" as const, label: "Queued" };
    case "received":
      return { color: "success" as const, label: "Received" };
    default:
      return {
        color: "neutral" as const,
        label: status
          ? `${status.charAt(0).toUpperCase()}${status.slice(1)}`
          : "Unknown",
      };
  }
}

function getDirectionMeta(message: SMSMessageRecord) {
  if (message.direction === "inbound") {
    return {
      color: "success" as const,
      icon: ArrowDownLeft,
      label: "Inbound",
    };
  }

  return {
    color: "primary" as const,
    icon: ArrowUpRight,
    label: "Outbound",
  };
}

function getMessageTimestamp(message: SMSMessageRecord) {
  if (message.direction === "inbound") {
    return message.created_at;
  }

  return (
    message.delivered_at ||
    message.sent_at ||
    message.scheduled_at ||
    message.created_at
  );
}

function getMessageTimestampLabel(message: SMSMessageRecord) {
  return message.direction === "inbound" ? "Received" : "Sent";
}

function getContactLabel(message: SMSMessageRecord) {
  const phone = formatPhoneNumber(message.phone);
  if (message.customer_name) {
    return `${message.customer_name} (${phone})`;
  }

  return phone;
}

function parseInputDate(value: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinRange(
  message: SMSMessageRecord,
  fromDate: string,
  toDate: string,
) {
  const timestamp = getMessageTimestamp(message);
  const date = timestamp ? new Date(timestamp) : null;

  if (!date || Number.isNaN(date.getTime())) {
    return !fromDate && !toDate;
  }

  const from = parseInputDate(fromDate);
  if (from && date < from) {
    return false;
  }

  const to = parseInputDate(toDate);
  if (to) {
    to.setHours(23, 59, 59, 999);
    if (date > to) {
      return false;
    }
  }

  return true;
}

function buildTimeline(message: SMSMessageRecord): MessageTimelineItem[] {
  const events: MessageTimelineItem[] = [];

  if (message.direction === "inbound") {
    events.push({
      key: "received",
      label: "Received",
      detail: "Inbound message was captured in your message history.",
      timestamp: message.created_at,
      color: "success",
    });
  } else {
    events.push({
      key: "created",
      label: "Queued",
      detail: message.scheduled_at
        ? "Message was scheduled and queued for send."
        : "Message entered the outbound queue.",
      timestamp: message.scheduled_at || message.created_at,
      color: "warning",
    });

    if (message.sent_at) {
      events.push({
        key: "sent",
        label: "Sent",
        detail: "Outbound send was handed off to the SMS provider.",
        timestamp: message.sent_at,
        color: "primary",
      });
    }

    if (message.delivered_at) {
      events.push({
        key: "delivered",
        label: "Delivered",
        detail: "Carrier confirmed successful delivery.",
        timestamp: message.delivered_at,
        color: "success",
      });
    }

    if (message.status === "failed" || message.error_message) {
      events.push({
        key: "failed",
        label: "Failed",
        detail:
          message.error_message ||
          message.failure_type ||
          "Delivery failed before carrier confirmation.",
        timestamp:
          message.dead_lettered_at ||
          message.last_attempt_at ||
          message.updated_at ||
          message.created_at,
        color: "danger",
      });
    }
  }

  return events.sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
  );
}

function TableSkeleton() {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        overflow: "hidden",
        backgroundColor: "background.surface",
      }}
    >
      <Box sx={{ overflowX: "auto" }}>
        <Table
          hoverRow
          stickyHeader
          sx={{
            minWidth: 880,
            "--TableCell-headBackground":
              "var(--joy-palette-background-surface)",
          }}
        >
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Direction</th>
              <th style={{ width: "20%" }}>Recipient / Sender</th>
              <th style={{ width: "28%" }}>Message Content</th>
              <th style={{ width: "12%" }}>Status</th>
              <th style={{ width: "18%" }}>Campaign</th>
              <th style={{ width: "12%" }}>Sent / Received At</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, index) => (
              <tr key={index}>
                <td>
                  <Skeleton variant="circular" width={32} height={32} />
                </td>
                <td>
                  <Stack spacing={0.75} sx={{ py: 0.5 }}>
                    <Skeleton
                      variant="text"
                      sx={{ width: "78%", height: 16 }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{ width: "52%", height: 14 }}
                    />
                  </Stack>
                </td>
                <td>
                  <Skeleton variant="text" sx={{ width: "92%", height: 16 }} />
                </td>
                <td>
                  <Skeleton
                    variant="rectangular"
                    sx={{ width: 92, height: 28, borderRadius: "999px" }}
                  />
                </td>
                <td>
                  <Skeleton variant="text" sx={{ width: "66%", height: 16 }} />
                </td>
                <td>
                  <Stack spacing={0.75} sx={{ py: 0.5 }}>
                    <Skeleton
                      variant="text"
                      sx={{ width: "84%", height: 14 }}
                    />
                    <Skeleton
                      variant="text"
                      sx={{ width: "56%", height: 12 }}
                    />
                  </Stack>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Box>
    </Sheet>
  );
}

function EmptyState({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <Sheet
      variant="outlined"
      sx={{
        borderRadius: "28px",
        borderColor: "neutral.200",
        backgroundColor: "background.surface",
        minHeight: 420,
        display: "grid",
        placeItems: "center",
        px: 3,
        py: 8,
        textAlign: "center",
      }}
    >
      <Stack spacing={2.5} alignItems="center" sx={{ maxWidth: 420 }}>
        <Avatar
          size="lg"
          variant="soft"
          color="neutral"
          sx={{ width: 72, height: 72 }}
        >
          <MessageSquareText size={28} />
        </Avatar>
        <Stack spacing={0.75}>
          <Typography level="title-lg">
            {filtered ? "No messages found" : "No messages found"}
          </Typography>
          <Typography level="body-sm" color="neutral">
            {filtered
              ? "No messages match your current filters."
              : "SMS messages you send and receive will appear here."}
          </Typography>
        </Stack>
        {filtered ? (
          <Button
            variant="solid"
            size="sm"
            startDecorator={<FilterX size={15} />}
            onClick={onClear}
            sx={{ borderRadius: "12px" }}
          >
            Clear Filters
          </Button>
        ) : null}
      </Stack>
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Stack
      direction="row"
      spacing={2}
      justifyContent="space-between"
      alignItems="flex-start"
    >
      <Typography level="body-sm" color="neutral">
        {label}
      </Typography>
      <Box sx={{ textAlign: "right", minWidth: 0 }}>{value}</Box>
    </Stack>
  );
}

function MessageDetailDrawer({
  message,
  onClose,
}: {
  message: SMSMessageRecord | null;
  onClose: () => void;
}) {
  const direction = message ? getDirectionMeta(message) : null;
  const timeline = message ? buildTimeline(message) : [];
  const DirectionIcon = direction?.icon;

  return (
    <JoyDrawer
      open={Boolean(message)}
      onClose={onClose}
      size="md"
      title="Message Detail"
      description={
        message
          ? `${direction?.label} message for ${formatPhoneNumber(message.phone)}`
          : undefined
      }
      startDecorator={
        direction && DirectionIcon ? (
          <Avatar size="sm" variant="soft" color={direction.color}>
            <DirectionIcon size={15} />
          </Avatar>
        ) : null
      }
    >
      {message ? (
        <Stack spacing={2.5}>
          <Sheet variant="soft" sx={{ borderRadius: "24px", p: 2.25 }}>
            <Stack spacing={1.5}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="flex-start"
                spacing={2}
              >
                <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                  <Typography level="title-md">
                    {getContactLabel(message)}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {getMessageTimestampLabel(message)}{" "}
                    {formatDateTime(getMessageTimestamp(message))}
                  </Typography>
                </Stack>
                <Chip
                  size="sm"
                  variant="soft"
                  color={getStatusChip(message.status).color}
                >
                  {getStatusChip(message.status).label}
                </Chip>
              </Stack>

              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "18px",
                  p: 2,
                  backgroundColor: "background.surface",
                }}
              >
                <Typography level="body-sm" sx={{ whiteSpace: "pre-wrap" }}>
                  {message.content}
                </Typography>
              </Sheet>

              {message.media_urls.length > 0 ? (
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {message.media_urls.map((url, index) => (
                    <Sheet
                      key={`${url}-${index}`}
                      variant="outlined"
                      sx={{
                        borderRadius: "18px",
                        overflow: "hidden",
                        width: 92,
                        height: 92,
                      }}
                    >
                      <img
                        src={url}
                        alt={`Message media ${index + 1}`}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </Sheet>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ borderRadius: "24px", p: 2.25 }}>
            <Stack spacing={1.5}>
              <Typography level="title-sm">Delivery metadata</Typography>
              <DetailRow
                label="Direction"
                value={
                  <Typography level="body-sm">
                    {direction?.label || "--"}
                  </Typography>
                }
              />
              <DetailRow
                label="Phone"
                value={
                  <Typography level="body-sm">
                    {formatPhoneNumber(message.phone)}
                  </Typography>
                }
              />
              <DetailRow
                label="From phone"
                value={
                  <Typography level="body-sm">
                    {formatPhoneNumber(message.from_phone)}
                  </Typography>
                }
              />
              <DetailRow
                label="Campaign"
                value={
                  message.campaign_id ? (
                    <Link
                      component={RouterLink}
                      to={`/sms/${message.campaign_id}`}
                      level="body-sm"
                      underline="hover"
                      onClick={onClose}
                    >
                      {message.campaign_name || "Open campaign"}
                    </Link>
                  ) : (
                    <Typography level="body-sm">--</Typography>
                  )
                }
              />
              <DetailRow
                label="Provider SID"
                value={
                  <Typography level="body-sm">
                    {message.twilio_sid || "--"}
                  </Typography>
                }
              />
              <DetailRow
                label="Segment count"
                value={
                  <Typography level="body-sm">
                    {Math.max(1, Math.ceil(message.content.length / 160))}
                  </Typography>
                }
              />
              <DetailRow
                label="Attempts"
                value={
                  <Typography level="body-sm">{message.attempts}</Typography>
                }
              />
              <DetailRow
                label="Failure type"
                value={
                  <Typography level="body-sm">
                    {message.failure_type || "--"}
                  </Typography>
                }
              />
              <DetailRow
                label="Error details"
                value={
                  <Typography level="body-sm">
                    {message.error_message || message.error_code || "--"}
                  </Typography>
                }
              />
              <DetailRow
                label="Link click data"
                value={
                  <Typography level="body-sm">
                    No click data recorded
                  </Typography>
                }
              />
            </Stack>
          </Sheet>

          <Sheet variant="outlined" sx={{ borderRadius: "24px", p: 2.25 }}>
            <Stack spacing={1.5}>
              <Typography level="title-sm">Status timeline</Typography>
              <List sx={{ "--List-gap": "12px" }}>
                {timeline.map((item) => (
                  <ListItem key={item.key} sx={{ alignItems: "flex-start" }}>
                    <ListItemDecorator>
                      <Avatar size="sm" variant="soft" color={item.color}>
                        <Clock3 size={14} />
                      </Avatar>
                    </ListItemDecorator>
                    <ListItemContent>
                      <Stack spacing={0.5}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          spacing={2}
                        >
                          <Typography level="body-sm" fontWeight="md">
                            {item.label}
                          </Typography>
                          <Typography level="body-xs" color="neutral">
                            {formatDateTime(item.timestamp)}
                          </Typography>
                        </Stack>
                        <Typography level="body-xs" color="neutral">
                          {item.detail}
                        </Typography>
                      </Stack>
                    </ListItemContent>
                  </ListItem>
                ))}
              </List>
            </Stack>
          </Sheet>
        </Stack>
      ) : null}
    </JoyDrawer>
  );
}

export default function SMSMessagesPage() {
  const navigate = useNavigate();
  const { data: messages = [], isLoading } = useSMSMessages();
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [directionFilter, setDirectionFilter] =
    React.useState<DirectionFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [selectedMessage, setSelectedMessage] =
    React.useState<SMSMessageRecord | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const [showMountSkeleton, setShowMountSkeleton] = React.useState(true);

  React.useEffect(() => {
    const timeout = window.setTimeout(() => {
      setShowMountSkeleton(false);
    }, MOUNT_SKELETON_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    statusFilter !== "all" ||
    directionFilter !== "all" ||
    Boolean(fromDate) ||
    Boolean(toDate);

  const filteredMessages = React.useMemo(() => {
    const lowerSearch = searchQuery.trim().toLowerCase();

    return messages.filter((message) => {
      if (statusFilter !== "all" && message.status !== statusFilter) {
        return false;
      }

      if (directionFilter !== "all" && message.direction !== directionFilter) {
        return false;
      }

      if (!isWithinRange(message, fromDate, toDate)) {
        return false;
      }

      if (!lowerSearch) {
        return true;
      }

      const searchableValue = [
        message.phone,
        message.content,
        message.campaign_name,
        message.customer_name,
        message.from_phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableValue.includes(lowerSearch);
    });
  }, [messages, searchQuery, statusFilter, directionFilter, fromDate, toDate]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredMessages.length / PAGE_SIZE),
  );

  React.useEffect(() => {
    setPage(1);
  }, [searchQuery, statusFilter, directionFilter, fromDate, toDate]);

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  React.useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const paginatedMessages = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredMessages.slice(start, start + PAGE_SIZE);
  }, [filteredMessages, page]);

  const showingFrom =
    filteredMessages.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredMessages.length);

  const handleClearFilters = React.useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setDirectionFilter("all");
    setFromDate("");
    setToDate("");
    setPage(1);
  }, []);

  const shouldShowSkeleton = isLoading || showMountSkeleton;

  return (
    <>
      <PageContainer fullWidth sx={{ py: 3 }}>
        <Stack spacing={2.5}>
          <Stack spacing={1.25}>
            <Breadcrumbs separator="/" size="sm">
              <Link
                component="button"
                type="button"
                color="neutral"
                underline="hover"
                onClick={() => navigate("/sms")}
              >
                SMS Campaigns
              </Link>
              <Typography level="body-sm" color="neutral">
                Messages
              </Typography>
            </Breadcrumbs>

            <Stack spacing={0.5}>
              <Typography level="h3" fontWeight="lg">
                Messages
              </Typography>
              <Typography level="body-sm" color="neutral">
                Complete history of all SMS messages sent and received across
                your account
              </Typography>
            </Stack>
          </Stack>

          <Sheet
            variant="soft"
            sx={{
              borderRadius: "24px",
              p: 1.5,
              bgcolor: "rgba(var(--joy-palette-neutral-mainChannel) / 0.05)",
            }}
          >
            <Stack
              direction="row"
              spacing={1.5}
              useFlexGap
              flexWrap="wrap"
              alignItems="center"
            >
              <JoyDebouncedInput
                size="sm"
                variant="outlined"
                debounceMs={300}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                startDecorator={<Search size={15} />}
                placeholder="Search by phone number or content..."
                sx={{
                  minWidth: 260,
                  flex: 1,
                  backgroundColor: "background.surface",
                }}
              />

              <Select
                size="sm"
                variant="outlined"
                value={statusFilter}
                onChange={(_event, value) =>
                  setStatusFilter((value as StatusFilter) || "all")
                }
                sx={{ minWidth: 150, backgroundColor: "background.surface" }}
              >
                {statusOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>

              <Select
                size="sm"
                variant="outlined"
                value={directionFilter}
                onChange={(_event, value) =>
                  setDirectionFilter((value as DirectionFilter) || "all")
                }
                sx={{ minWidth: 150, backgroundColor: "background.surface" }}
              >
                {directionOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>

              <JoyInput
                type="date"
                size="sm"
                variant="outlined"
                value={fromDate}
                onChange={(event) => setFromDate(event.target.value)}
                startDecorator={<CalendarDays size={15} />}
                aria-label="From date"
                sx={{ minWidth: 168, backgroundColor: "background.surface" }}
              />

              <JoyInput
                type="date"
                size="sm"
                variant="outlined"
                value={toDate}
                onChange={(event) => setToDate(event.target.value)}
                startDecorator={<CalendarDays size={15} />}
                aria-label="To date"
                sx={{ minWidth: 168, backgroundColor: "background.surface" }}
              />

              {hasActiveFilters ? (
                <Button
                  variant="plain"
                  size="sm"
                  color="neutral"
                  startDecorator={<FilterX size={15} />}
                  onClick={handleClearFilters}
                >
                  Clear Filters
                </Button>
              ) : null}
            </Stack>
          </Sheet>

          <Box
            sx={{
              opacity: shouldShowSkeleton ? 0.72 : 1,
              transform: shouldShowSkeleton
                ? "translateY(6px)"
                : "translateY(0)",
              transition: "opacity 180ms ease, transform 180ms ease",
            }}
          >
            {shouldShowSkeleton ? (
              <TableSkeleton />
            ) : filteredMessages.length === 0 ? (
              <EmptyState
                filtered={hasActiveFilters}
                onClear={handleClearFilters}
              />
            ) : (
              <Sheet
                variant="outlined"
                sx={{
                  borderRadius: "28px",
                  borderColor: "neutral.200",
                  overflow: "hidden",
                  backgroundColor: "background.surface",
                }}
              >
                <Box sx={{ overflowX: "auto" }}>
                  <Table
                    hoverRow
                    stickyHeader
                    sx={{
                      minWidth: 960,
                      "--TableCell-headBackground":
                        "var(--joy-palette-background-surface)",
                    }}
                  >
                    <thead>
                      <tr>
                        <th style={{ width: "10%" }}>Direction</th>
                        <th style={{ width: "22%" }}>Recipient / Sender</th>
                        <th style={{ width: "28%" }}>Message Content</th>
                        <th style={{ width: "12%" }}>Status</th>
                        <th style={{ width: "16%" }}>Campaign</th>
                        <th style={{ width: "12%" }}>Sent / Received At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedMessages.map((message) => {
                        const direction = getDirectionMeta(message);
                        const DirectionIcon = direction.icon;
                        const status = getStatusChip(message.status);

                        return (
                          <tr
                            key={message.id}
                            onClick={() => setSelectedMessage(message)}
                            style={{ cursor: "pointer" }}
                          >
                            <td>
                              <Avatar
                                size="sm"
                                variant="soft"
                                color={direction.color}
                              >
                                <DirectionIcon size={14} />
                              </Avatar>
                            </td>
                            <td>
                              <Stack spacing={0.25} sx={{ py: 0.5 }}>
                                <Typography level="body-sm" fontWeight="md">
                                  {getContactLabel(message)}
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  {direction.label}
                                  {message.from_phone
                                    ? ` from ${formatPhoneNumber(message.from_phone)}`
                                    : ""}
                                </Typography>
                              </Stack>
                            </td>
                            <td>
                              <Typography
                                level="body-sm"
                                color="neutral"
                                sx={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  maxWidth: 0,
                                }}
                              >
                                {message.content}
                              </Typography>
                            </td>
                            <td>
                              <Chip
                                size="sm"
                                variant="soft"
                                color={status.color}
                              >
                                {status.label}
                              </Chip>
                            </td>
                            <td>
                              {message.campaign_id ? (
                                <Link
                                  component={RouterLink}
                                  to={`/sms/${message.campaign_id}`}
                                  level="body-sm"
                                  underline="hover"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  {message.campaign_name || "Open campaign"}
                                </Link>
                              ) : (
                                <Typography level="body-sm" color="neutral">
                                  --
                                </Typography>
                              )}
                            </td>
                            <td>
                              <Stack spacing={0.25} sx={{ py: 0.5 }}>
                                <Typography level="body-xs" color="neutral">
                                  {formatDateTime(getMessageTimestamp(message))}
                                </Typography>
                                <Typography level="body-xs" color="neutral">
                                  {getRelativeTime(
                                    getMessageTimestamp(message),
                                  )}
                                </Typography>
                              </Stack>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </Box>

                <Divider />

                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1.5}
                  justifyContent="space-between"
                  alignItems={{ sm: "center" }}
                  sx={{ px: 2.5, py: 2 }}
                >
                  <Typography level="body-sm" color="neutral">
                    Showing {showingFrom}-{showingTo} of{" "}
                    {filteredMessages.length} messages
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center">
                    {totalPages > 100 ? (
                      <JoyInput
                        type="number"
                        size="sm"
                        variant="outlined"
                        value={pageInput}
                        onChange={(event) => setPageInput(event.target.value)}
                        onBlur={() => {
                          const nextPage = Number(pageInput);
                          if (Number.isFinite(nextPage)) {
                            setPage(
                              Math.min(Math.max(nextPage, 1), totalPages),
                            );
                          }
                        }}
                        sx={{ width: 88 }}
                      />
                    ) : null}

                    <Button
                      variant="outlined"
                      size="sm"
                      color="neutral"
                      startDecorator={<ChevronLeft size={15} />}
                      disabled={page <= 1}
                      onClick={() =>
                        setPage((current) => Math.max(current - 1, 1))
                      }
                      sx={{ borderRadius: "12px" }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outlined"
                      size="sm"
                      color="neutral"
                      endDecorator={<ChevronRight size={15} />}
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((current) => Math.min(current + 1, totalPages))
                      }
                      sx={{ borderRadius: "12px" }}
                    >
                      Next
                    </Button>
                  </Stack>
                </Stack>
              </Sheet>
            )}
          </Box>
        </Stack>
      </PageContainer>

      <MessageDetailDrawer
        message={selectedMessage}
        onClose={() => setSelectedMessage(null)}
      />
    </>
  );
}
