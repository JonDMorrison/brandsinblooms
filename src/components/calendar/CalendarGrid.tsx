import React from "react";
import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Typography from "@mui/joy/Typography";
import {
  addDays,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDayCell } from "./CalendarDayCell";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";

interface CalendarGridProps {
  currentDate: Date;
  viewMode: "month" | "week";
  eventsByDate: Record<string, UnifiedCalendarEvent[]>;
  highlightedEventId?: string | null;
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  onEventClick: (event: UnifiedCalendarEvent) => void;
  onDateClick: (date: Date) => void;
  onDateCreate?: (date: Date) => void;
  onDrop?: (date: Date) => void;
  isDragging?: boolean;
  draggedTask?: any;
}

export const CalendarGrid = React.memo(
  ({
    currentDate,
    viewMode,
    eventsByDate,
    highlightedEventId,
    selectionMode = false,
    selectedTaskIds = [],
    onToggleTaskSelection,
    onEventClick,
    onDateClick,
    onDateCreate,
    onDrop,
    isDragging,
    draggedTask,
  }: CalendarGridProps) => {
    const generateDays = React.useMemo(() => {
      if (viewMode === "week") {
        const start = startOfWeek(currentDate, { weekStartsOn: 1 });
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
      } else {
        // Month view - generate full 6-week grid (42 days)
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });

        return Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));
      }
    }, [currentDate, viewMode]);

    const days = generateDays;
    const minCellHeight = viewMode === "week" ? 220 : 168;

    return (
      <Sheet
        variant="outlined"
        sx={{
          borderRadius: "xl",
          overflow: "hidden",
          borderColor: "neutral.200",
          boxShadow: "sm",
        }}
      >
        <Box sx={{ overflowX: "auto" }}>
          <Box sx={{ minWidth: { xs: 980, lg: "100%" } }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                borderBottom: "1px solid",
                borderColor: "neutral.200",
              }}
            >
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <Box
                  key={day}
                  sx={{
                    px: 1.5,
                    py: 1.25,
                    backgroundColor: "neutral.50",
                    borderRight: "1px solid",
                    borderColor: "neutral.200",
                    "&:last-child": { borderRight: 0 },
                  }}
                >
                  <Typography
                    level="body-xs"
                    fontWeight="lg"
                    textTransform="uppercase"
                    color="neutral"
                  >
                    {day}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              }}
            >
              {days.map((date) => {
                const dateKey = format(date, "yyyy-MM-dd");
                const dayEvents = eventsByDate[dateKey] || [];
                const isCurrentMonth =
                  viewMode === "week" || isSameMonth(date, currentDate);
                const isToday =
                  format(date, "yyyy-MM-dd") ===
                  format(new Date(), "yyyy-MM-dd");

                return (
                  <CalendarDayCell
                    key={date.toISOString()}
                    date={date}
                    events={dayEvents}
                    highlightedEventId={highlightedEventId}
                    isCurrentMonth={isCurrentMonth}
                    isToday={isToday}
                    minHeight={minCellHeight}
                    selectionMode={selectionMode}
                    selectedTaskIds={selectedTaskIds}
                    onToggleTaskSelection={onToggleTaskSelection}
                    onEventClick={onEventClick}
                    onDateClick={onDateClick}
                    onDateCreate={onDateCreate}
                    onDrop={onDrop}
                    isDragging={isDragging}
                    draggedTask={draggedTask}
                  />
                );
              })}
            </Box>
          </Box>
        </Box>
      </Sheet>
    );
  },
);
