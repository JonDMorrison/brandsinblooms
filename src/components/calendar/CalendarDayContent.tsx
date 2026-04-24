import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { ChevronDown } from "lucide-react";
import { useMemo } from "react";
import {
  createCalendarPillSx,
  getCalendarEventTime,
  getCalendarEventTitle,
} from "@/components/calendar/calendarEventPresentation";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";
import { CalendarCampaignList } from "./CalendarCampaignList";
import { EnhancedCalendarTaskItem } from "./EnhancedCalendarTaskItem";
import { NewsletterCalendarBlock } from "./NewsletterCalendarBlock";

interface CalendarDayContentProps {
  date: Date;
  events: UnifiedCalendarEvent[];
  selectionMode?: boolean;
  selectedTaskIds?: string[];
  highlightedEventId?: string | null;
  isPastDate: boolean;
  onToggleTaskSelection?: (taskId: string) => void;
  onEventClick?: (event: UnifiedCalendarEvent) => void;
  onShowMore?: () => void;
}

export const CalendarDayContent = ({
  events,
  selectionMode = false,
  selectedTaskIds = [],
  highlightedEventId,
  isPastDate,
  onToggleTaskSelection,
  onEventClick,
  onShowMore,
}: CalendarDayContentProps) => {
  const visibleEvents = useMemo(() => events.slice(0, 4), [events]);
  const hiddenCount = Math.max(events.length - visibleEvents.length, 0);

  return (
    <Stack spacing={0.75} sx={{ minHeight: 0 }}>
      {visibleEvents.map((event) => {
        if (event.type === "event") {
          return (
            <CalendarCampaignList
              key={event.id}
              campaigns={[event.meta]}
              onCampaignClick={() => onEventClick?.(event)}
              highlightedId={highlightedEventId}
            />
          );
        }

        if (event.type === "newsletter") {
          return (
            <NewsletterCalendarBlock
              key={event.id}
              newsletter={event.meta}
              onClick={() => onEventClick?.(event)}
              isCompact
              highlighted={highlightedEventId === event.id}
            />
          );
        }

        if (event.type === "task") {
          return (
            <EnhancedCalendarTaskItem
              key={event.id}
              task={event.meta}
              isSelected={selectedTaskIds.includes(event.id)}
              isPastDate={isPastDate}
              highlighted={highlightedEventId === event.id}
              onTaskClick={() => {
                if (selectionMode) {
                  onToggleTaskSelection?.(event.id);
                  return;
                }

                onEventClick?.(event);
              }}
              onLongPress={() => {
                onToggleTaskSelection?.(event.id);
              }}
            />
          );
        }

        const label = getCalendarEventTitle(event);
        const time = getCalendarEventTime(event);

        return (
          <Box
            key={event.id}
            component="button"
            type="button"
            sx={{
              ...createCalendarPillSx(
                event.type,
                highlightedEventId === event.id,
              ),
              appearance: "none",
            }}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onEventClick?.(event);
            }}
          >
            <Box sx={{ pl: 0.75, minWidth: 0 }}>
              <Typography
                level="body-xs"
                fontWeight="lg"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
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
                {time || event.type.replace("_", " ")}
              </Typography>
            </Box>
          </Box>
        );
      })}

      {hiddenCount > 0 ? (
        <Button
          size="sm"
          variant="plain"
          color="neutral"
          endDecorator={<ChevronDown size={14} />}
          onClick={(event) => {
            event.stopPropagation();
            onShowMore?.();
          }}
          sx={{ justifyContent: "flex-start", px: 0.5 }}
        >
          +{hiddenCount} more
        </Button>
      ) : null}
    </Stack>
  );
};
