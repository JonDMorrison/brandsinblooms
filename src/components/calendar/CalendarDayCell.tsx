import React from "react";
import Box from "@mui/joy/Box";
import IconButton from "@mui/joy/IconButton";
import Stack from "@mui/joy/Stack";
import { Plus } from "lucide-react";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";
import { CalendarDropZone } from "./CalendarDropZone";
import { CalendarDayContent } from "./CalendarDayContent";
import { CalendarDayHeader } from "./CalendarDayHeader";

interface CalendarDayCellProps {
  date: Date;
  events: UnifiedCalendarEvent[];
  isCurrentMonth: boolean;
  isToday: boolean;
  minHeight?: number;
  highlightedEventId?: string | null;
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  onToggleTaskSelection?: (taskId: string) => void;
  onEventClick?: (event: UnifiedCalendarEvent) => void;
  onDateClick?: (date: Date) => void;
  onDateCreate?: (date: Date) => void;
  onDrop?: (date: Date) => void;
  isDragging?: boolean;
  draggedTask?: any;
}

export const CalendarDayCell = React.memo(
  ({
    date,
    events,
    isCurrentMonth,
    isToday,
    minHeight = 168,
    highlightedEventId,
    selectionMode = false,
    selectedTaskIds = [],
    onToggleTaskSelection,
    onEventClick,
    onDateClick,
    onDateCreate,
    onDrop,
    isDragging = false,
    draggedTask,
  }: CalendarDayCellProps) => {
    const containerRef = React.useRef<HTMLDivElement | null>(null);
    const isWeekend = React.useMemo(() => {
      const day = date.getDay();
      return day === 0 || day === 6;
    }, [date]);

    const isPastDate = React.useMemo(() => {
      return date < new Date(new Date().setHours(0, 0, 0, 0));
    }, [date]);

    const hasHighlightedEvent = React.useMemo(
      () =>
        Boolean(
          highlightedEventId &&
          events.some((event) => event.id === highlightedEventId),
        ),
      [events, highlightedEventId],
    );

    React.useEffect(() => {
      if (hasHighlightedEvent) {
        containerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, [hasHighlightedEvent]);

    const handleDateClick = () => {
      if (onDateClick) {
        onDateClick(date);
      }
    };

    return (
      <CalendarDropZone
        date={date}
        isDragging={isDragging}
        draggedTask={draggedTask}
        onDrop={onDrop}
      >
        <Box
          ref={containerRef}
          sx={{
            minHeight,
            p: 1.25,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            cursor: "pointer",
            borderRight: "1px solid",
            borderBottom: "1px solid",
            borderColor: "neutral.200",
            backgroundColor: isToday
              ? "rgba(var(--joy-palette-primary-mainChannel) / 0.08)"
              : !isCurrentMonth
                ? "neutral.50"
                : isWeekend
                  ? "rgba(var(--joy-palette-success-mainChannel) / 0.04)"
                  : isPastDate
                    ? "rgba(var(--joy-palette-warning-mainChannel) / 0.05)"
                    : "common.white",
            boxShadow: hasHighlightedEvent
              ? "inset 0 0 0 2px rgba(var(--joy-palette-primary-mainChannel) / 0.26)"
              : undefined,
            transition: "background-color 0.16s ease, box-shadow 0.16s ease",
            "&:hover": {
              backgroundColor: isCurrentMonth ? "neutral.50" : "neutral.100",
            },
          }}
          onClick={handleDateClick}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={1}
          >
            <CalendarDayHeader
              date={date}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              eventTypes={[...new Set(events.map((event) => event.type))]}
            />
            <IconButton
              size="sm"
              variant="soft"
              color="neutral"
              onClick={(event) => {
                event.stopPropagation();
                onDateCreate?.(date);
              }}
            >
              <Plus size={14} />
            </IconButton>
          </Stack>

          <CalendarDayContent
            date={date}
            events={events}
            isPastDate={isPastDate}
            selectionMode={selectionMode}
            selectedTaskIds={selectedTaskIds}
            highlightedEventId={highlightedEventId}
            onToggleTaskSelection={onToggleTaskSelection}
            onEventClick={onEventClick}
            onShowMore={() => onDateClick?.(date)}
          />
        </Box>
      </CalendarDropZone>
    );
  },
);
