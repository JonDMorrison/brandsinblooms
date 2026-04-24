import React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { Calendar } from "lucide-react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { JoyButton } from "@/components/joy/JoyButton";
import { JoyChip, JoyStatusChip } from "@/components/joy/JoyChip";
import {
  getCalendarEventConfig,
  getCalendarEventDescription,
  getCalendarEventTime,
  getCalendarEventTitle,
  sortCalendarEvents,
} from "@/components/calendar/calendarEventPresentation";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";

interface CalendarListViewProps {
  events: UnifiedCalendarEvent[];
  onEventClick: (event: UnifiedCalendarEvent) => void;
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (eventId: string) => void;
}

const getDateLabel = (date: Date) => {
  if (isToday(date)) {
    return "Today";
  } else if (isTomorrow(date)) {
    return "Tomorrow";
  } else if (isYesterday(date)) {
    return "Yesterday";
  } else {
    return format(date, "EEEE, MMMM d");
  }
};

export const CalendarListView = ({
  events,
  onEventClick,
  selectionMode = false,
  selectedTaskIds = [],
  onToggleTaskSelection,
}: CalendarListViewProps) => {
  const eventsByDate = events.reduce(
    (acc, event) => {
      const dateKey = format(event.date, "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(event);
      return acc;
    },
    {} as Record<string, UnifiedCalendarEvent[]>,
  );

  // Sort dates
  const sortedDates = Object.keys(eventsByDate).sort();

  if (events.length === 0) {
    return (
      <Sheet
        variant="soft"
        sx={{ borderRadius: "xl", p: 4, textAlign: "center" }}
      >
        <Calendar size={32} style={{ margin: "0 auto 12px" }} />
        <Typography level="title-md">No events found</Typography>
        <Typography level="body-sm" color="neutral">
          Try adjusting your filters or create a new item from the toolbar.
        </Typography>
      </Sheet>
    );
  }

  return (
    <Stack spacing={2.5} sx={{ minWidth: 0, width: "100%", maxWidth: "100%" }}>
      {sortedDates.map((dateKey) => {
        const date = new Date(dateKey);
        const dayEvents = sortCalendarEvents(eventsByDate[dateKey]);

        return (
          <Stack
            key={dateKey}
            spacing={1.25}
            sx={{ minWidth: 0, width: "100%" }}
          >
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ minWidth: 0, width: "100%" }}
            >
              <Calendar size={16} />
              <Typography level="title-sm">{getDateLabel(date)}</Typography>
              <JoyChip
                color="neutral"
                variant="soft"
                sx={{ ml: "auto", flexShrink: 0 }}
              >
                {dayEvents.length} {dayEvents.length === 1 ? "item" : "items"}
              </JoyChip>
            </Stack>

            <Stack spacing={1} sx={{ minWidth: 0, width: "100%" }}>
              {dayEvents.map((event) => {
                const config = getCalendarEventConfig(event.type);
                const IconComponent = config.icon;

                return (
                  <Sheet
                    key={event.id}
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      borderRadius: "xl",
                      width: "100%",
                      maxWidth: "100%",
                      minWidth: 0,
                      overflow: "hidden",
                      borderColor: selectedTaskIds.includes(event.id)
                        ? "primary.400"
                        : config.borderColor,
                      backgroundColor: selectedTaskIds.includes(event.id)
                        ? "rgba(var(--joy-palette-primary-mainChannel) / 0.08)"
                        : "background.surface",
                      cursor: "pointer",
                      transition:
                        "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease",
                      "&:hover": {
                        transform: "translateY(-1px)",
                        boxShadow: "sm",
                      },
                    }}
                    onClick={() => onEventClick(event)}
                  >
                    <Stack
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                      sx={{ minWidth: 0, width: "100%" }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: "lg",
                          backgroundColor: config.surfaceColor,
                          color: config.textColor,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent size={18} />
                      </Box>

                      <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={0.75}
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", md: "center" }}
                          sx={{ minWidth: 0, width: "100%" }}
                        >
                          <Typography
                            level="title-sm"
                            sx={{
                              minWidth: 0,
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {getCalendarEventTitle(event)}
                          </Typography>
                          {getCalendarEventTime(event) ? (
                            <Typography
                              level="body-xs"
                              color="neutral"
                              sx={{ flexShrink: 0 }}
                            >
                              {getCalendarEventTime(event)}
                            </Typography>
                          ) : null}
                        </Stack>

                        <Typography
                          level="body-sm"
                          color="neutral"
                          sx={{
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                          }}
                        >
                          {getCalendarEventDescription(event)}
                        </Typography>

                        <Stack
                          direction="row"
                          spacing={0.75}
                          useFlexGap
                          flexWrap="wrap"
                        >
                          <JoyChip color={config.chipColor} variant="soft">
                            {config.label}
                          </JoyChip>
                          {event.platform ? (
                            <JoyChip color="neutral" variant="soft">
                              {event.platform}
                            </JoyChip>
                          ) : null}
                          {event.status ? (
                            <JoyStatusChip status={event.status} />
                          ) : null}
                          {selectionMode && event.type === "task" ? (
                            <JoyButton
                              bloomVariant="outline"
                              color={
                                selectedTaskIds.includes(event.id)
                                  ? "primary"
                                  : "neutral"
                              }
                              onClick={(clickEvent) => {
                                clickEvent.stopPropagation();
                                onToggleTaskSelection?.(event.id);
                              }}
                            >
                              {selectedTaskIds.includes(event.id)
                                ? "Selected"
                                : "Select"}
                            </JoyButton>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Sheet>
                );
              })}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
};
