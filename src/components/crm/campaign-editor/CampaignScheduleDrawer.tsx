import * as React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { format, formatDistanceToNow } from "date-fns";
import Typography from "@mui/joy/Typography";
import {
  Calendar,
  CalendarCheck,
  CalendarClock,
  Clock3,
  Globe,
  Send,
  X,
  Zap,
} from "lucide-react";
import { JoyDrawer } from "@/components/joy/JoyDrawer";
import { JoyInput } from "@/components/joy/JoyInput";
import { JoyButton } from "@/components/joy/JoyButton";
import { useCampaignEditor } from "@/components/crm/campaign-editor/CampaignEditorContext";

type ScheduleMode = "now" | "later";

function buildDefaultScheduledDate() {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(10, 0, 0, 0);
  return next;
}

function toLocalDateTimeValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function parseLocalDateTime(value: string) {
  if (!value) {
    return null;
  }

  const next = new Date(value);
  return Number.isNaN(next.getTime()) ? null : next;
}

function getTimezoneAbbreviation(timezone: string, date: Date) {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "short",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  return timeZoneName?.replace(/^GMT/, "UTC") ?? "Local";
}

function getTimezoneOffsetLabel(timezone: string, date: Date) {
  const timeZoneName = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "longOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;

  return timeZoneName?.replace(/^GMT/, "UTC") ?? "UTC";
}

function formatTimezoneLabel(timezone: string) {
  return timezone
    .split("/")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ");
}

function getInitialScheduleState(
  sendImmediately: boolean,
  sendAt: Date | null,
) {
  const source =
    !sendImmediately && sendAt ? sendAt : buildDefaultScheduledDate();

  return {
    mode: (!sendImmediately && sendAt ? "later" : "now") as ScheduleMode,
    dateTime: toLocalDateTimeValue(source),
  };
}

const selectionCardSx = (selected: boolean) => ({
  borderRadius: "lg",
  p: 2,
  cursor: "pointer",
  transition: "all 150ms ease",
  borderWidth: 2,
  borderColor: selected ? "primary.400" : "neutral.200",
  backgroundColor: selected ? "primary.50" : "transparent",
  "&:hover": {
    borderColor: selected ? "primary.400" : "neutral.300",
  },
});

const iconContainerSx = (selected: boolean) => ({
  width: 36,
  height: 36,
  borderRadius: "10px",
  backgroundColor: selected ? "primary.100" : "neutral.100",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "background-color 150ms ease",
});

export function CampaignScheduleDrawer({
  open,
  onClose,
  onSchedule,
  onSendNow,
  canConfirm = true,
}: {
  open: boolean;
  onClose: () => void;
  onSchedule: (scheduledDateTime: Date) => void;
  onSendNow: () => void;
  canConfirm?: boolean;
}) {
  const { sendImmediately, sendAt } = useCampaignEditor();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [mode, setMode] = React.useState<ScheduleMode>("now");
  const [dateTime, setDateTime] = React.useState("");
  const [now, setNow] = React.useState(() => new Date());

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const initial = getInitialScheduleState(sendImmediately, sendAt);
    setMode(initial.mode);
    setDateTime(initial.dateTime);
    setNow(new Date());
  }, [open, sendAt, sendImmediately]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(timer);
  }, [open]);

  const scheduledDateTime = React.useMemo(() => {
    if (mode !== "later") {
      return null;
    }

    return parseLocalDateTime(dateTime);
  }, [dateTime, mode]);

  const isPastSchedule = Boolean(
    scheduledDateTime && scheduledDateTime.getTime() <= now.getTime(),
  );
  const validScheduledDateTime =
    scheduledDateTime && !isPastSchedule ? scheduledDateTime : null;
  const timeUntil = validScheduledDateTime
    ? formatDistanceToNow(validScheduledDateTime, { addSuffix: true })
    : null;
  const timezoneAbbr = getTimezoneAbbreviation(
    timezone,
    validScheduledDateTime ?? now,
  );
  const timezoneOffset = getTimezoneOffsetLabel(timezone, now);
  const currentTime = format(now, "h:mm a");
  const confirmDisabled =
    !canConfirm || (mode === "later" && !validScheduledDateTime);

  const handleSelectMode = (nextMode: ScheduleMode) => {
    setMode(nextMode);

    if (nextMode === "later" && !dateTime) {
      const initial = getInitialScheduleState(false, null);
      setDateTime(initial.dateTime);
    }
  };

  const handleConfirm = () => {
    if (mode === "now") {
      onSendNow();
      onClose();
      return;
    }

    if (!validScheduledDateTime) {
      return;
    }

    onSchedule(validScheduledDateTime);
    onClose();
  };

  return (
    <JoyDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      size="sm"
      hideCloseButton
      contentSx={{
        px: 0,
        py: 0,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
      slotProps={{
        content: {
          sx: {
            width: { xs: "100vw", sm: "380px" },
            display: "flex",
            flexDirection: "column",
          },
        },
      }}
    >
      <Box
        sx={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            borderBottom: "1px solid",
            borderColor: "neutral.100",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Clock3
                size={20}
                style={{ color: "var(--joy-palette-neutral-600)" }}
              />
              <Typography level="title-md" fontWeight="lg">
                Schedule
              </Typography>
            </Stack>
            <IconButton
              variant="plain"
              color="neutral"
              size="sm"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </IconButton>
          </Stack>
          <Typography level="body-sm" sx={{ color: "neutral.500", mt: 0.5 }}>
            Choose when to send your campaign
          </Typography>
        </Box>

        <Box
          sx={{
            px: 3,
            py: 2.5,
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Stack spacing={2} sx={{ flex: 1, justifyContent: "space-between" }}>
            <Stack spacing={2}>
              <Sheet
                variant="outlined"
                onClick={() => handleSelectMode("now")}
                sx={selectionCardSx(mode === "now")}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={iconContainerSx(mode === "now")}>
                    <Zap
                      size={18}
                      style={{
                        color:
                          mode === "now"
                            ? "var(--joy-palette-primary-600)"
                            : "var(--joy-palette-neutral-500)",
                      }}
                    />
                  </Box>
                  <Stack spacing={0.25}>
                    <Typography level="body-sm" fontWeight="lg">
                      Send immediately
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Campaign will begin sending right away
                    </Typography>
                  </Stack>
                </Stack>
              </Sheet>

              <Sheet
                variant="outlined"
                onClick={() => handleSelectMode("later")}
                sx={selectionCardSx(mode === "later")}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box sx={iconContainerSx(mode === "later")}>
                    <CalendarClock
                      size={18}
                      style={{
                        color:
                          mode === "later"
                            ? "var(--joy-palette-primary-600)"
                            : "var(--joy-palette-neutral-500)",
                      }}
                    />
                  </Box>
                  <Stack spacing={0.25} sx={{ flex: 1 }}>
                    <Typography level="body-sm" fontWeight="lg">
                      Schedule for later
                    </Typography>
                    <Typography level="body-xs" sx={{ color: "neutral.500" }}>
                      Set a specific date and time
                    </Typography>
                  </Stack>
                </Stack>

                {mode === "later" ? (
                  <Box
                    onClick={(event) => event.stopPropagation()}
                    sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: "1px solid",
                      borderColor: "neutral.100",
                    }}
                  >
                    <Stack spacing={2}>
                      <JoyInput
                        type="datetime-local"
                        label="Date and time"
                        value={dateTime}
                        onValueChange={setDateTime}
                        startDecorator={<Calendar size={16} />}
                        helperText="Choose the exact local date and time for this send."
                        slotProps={{
                          input: {
                            min: toLocalDateTimeValue(now),
                          },
                        }}
                      />

                      <Sheet
                        variant="soft"
                        color="neutral"
                        sx={{ borderRadius: "md", px: 2, py: 1.5 }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Globe
                            size={14}
                            style={{
                              color: "var(--joy-palette-neutral-500)",
                              flexShrink: 0,
                            }}
                          />
                          <Stack spacing={0}>
                            <Typography level="body-xs" fontWeight="md">
                              {formatTimezoneLabel(timezone)} ({timezoneAbbr})
                            </Typography>
                            <Typography
                              level="body-xs"
                              sx={{ color: "neutral.500" }}
                            >
                              {timezoneOffset} · Currently {currentTime} local
                              time
                            </Typography>
                          </Stack>
                        </Stack>
                      </Sheet>
                    </Stack>
                  </Box>
                ) : null}
              </Sheet>
            </Stack>

            <Sheet
              variant="soft"
              color={
                mode === "later" && !validScheduledDateTime
                  ? "warning"
                  : "primary"
              }
              sx={{ borderRadius: "lg", p: 2 }}
            >
              {mode === "now" ? (
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Zap
                    size={18}
                    style={{
                      color: "var(--joy-palette-primary-600)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <Stack spacing={0.25}>
                    <Typography
                      level="body-sm"
                      fontWeight="md"
                      sx={{ color: "primary.800" }}
                    >
                      Send immediately
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "primary.700" }}>
                      Campaign will begin sending as soon as you confirm
                    </Typography>
                  </Stack>
                </Stack>
              ) : validScheduledDateTime ? (
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <CalendarCheck
                    size={18}
                    style={{
                      color: "var(--joy-palette-primary-600)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <Stack spacing={0.25}>
                    <Typography
                      level="body-sm"
                      fontWeight="md"
                      sx={{ color: "primary.800" }}
                    >
                      Scheduled for{" "}
                      {format(validScheduledDateTime, "EEEE, MMMM d, yyyy")}
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "primary.700" }}>
                      at {format(validScheduledDateTime, "h:mm a")}{" "}
                      {timezoneAbbr}
                      {timeUntil ? ` · ${timeUntil}` : ""}
                    </Typography>
                  </Stack>
                </Stack>
              ) : (
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <CalendarClock
                    size={18}
                    style={{
                      color: "var(--joy-palette-warning-600)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                  <Stack spacing={0.25}>
                    <Typography
                      level="body-sm"
                      fontWeight="md"
                      sx={{ color: "warning.800" }}
                    >
                      Choose a future send time
                    </Typography>
                    <Typography level="body-sm" sx={{ color: "warning.700" }}>
                      Select a valid date and time to confirm the schedule
                    </Typography>
                  </Stack>
                </Stack>
              )}
            </Sheet>
          </Stack>
        </Box>

        <Box
          sx={{
            px: 3,
            py: 2.5,
            borderTop: "1px solid",
            borderColor: "neutral.100",
          }}
        >
          <Stack spacing={1.5}>
            <JoyButton
              variant="solid"
              color="primary"
              size="md"
              fullWidth
              startDecorator={
                mode === "now" ? (
                  <Send size={16} />
                ) : (
                  <CalendarCheck size={16} />
                )
              }
              onClick={handleConfirm}
              disabled={confirmDisabled}
            >
              {mode === "now" ? "Send Now" : "Confirm Schedule"}
            </JoyButton>

            <JoyButton
              variant="plain"
              color="neutral"
              size="sm"
              fullWidth
              onClick={onClose}
            >
              Cancel
            </JoyButton>
          </Stack>
        </Box>
      </Box>
    </JoyDrawer>
  );
}
