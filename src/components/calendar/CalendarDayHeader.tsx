import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { format } from "date-fns";
import { CalendarEventDot } from "@/components/calendar/calendarEventPresentation";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";

interface CalendarDayHeaderProps {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  eventTypes?: UnifiedCalendarEvent["type"][];
  compact?: boolean;
}

export const CalendarDayHeader = ({
  date,
  isCurrentMonth,
  isToday,
  eventTypes = [],
  compact = false,
}: CalendarDayHeaderProps) => {
  const dayNumber = format(date, "d");

  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      sx={{ mb: compact ? 1 : 1.25 }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center">
        <Box
          sx={{
            width: compact ? 24 : 28,
            height: compact ? 24 : 28,
            borderRadius: "999px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isToday ? "primary.500" : "transparent",
            color: isToday
              ? "common.white"
              : isCurrentMonth
                ? "text.primary"
                : "neutral.500",
          }}
        >
          <Typography level="body-xs" fontWeight="lg">
            {dayNumber}
          </Typography>
        </Box>

        {!compact ? (
          <Typography level="body-xs" color="neutral">
            {isToday ? "Today" : ""}
          </Typography>
        ) : null}
      </Stack>

      <Stack direction="row" spacing={0.5} alignItems="center">
        {eventTypes.slice(0, 5).map((type, index) => (
          <CalendarEventDot key={`${type}:${index}`} type={type} />
        ))}
      </Stack>
    </Stack>
  );
};
