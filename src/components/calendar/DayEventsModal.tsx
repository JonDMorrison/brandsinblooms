import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import { CheckSquare, Trash2 } from "lucide-react";
import { JoyButton } from "@/components/joy/JoyButton";
import {
  JoyDialog,
  JoyDialogActions,
  JoyDialogContent,
} from "@/components/joy/JoyDialog";
import type { UnifiedCalendarEvent } from "@/hooks/useUnifiedCalendarData";
import { CalendarListView } from "./CalendarListView";

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  events: UnifiedCalendarEvent[];
  onEventClick: (event: UnifiedCalendarEvent) => void;
  onDeleteSelected?: (taskIds: string[]) => Promise<void>;
}

export const DayEventsModal = ({
  isOpen,
  onClose,
  date,
  events,
  onEventClick,
  onDeleteSelected,
}: DayEventsModalProps) => {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const dayEvents = useMemo(() => {
    if (!date) {
      return [];
    }

    return events.filter(
      (event) =>
        format(new Date(event.date), "yyyy-MM-dd") ===
        format(date, "yyyy-MM-dd"),
    );
  }, [date, events]);

  if (!date) return null;

  const formattedDate = format(date, "EEEE, MMMM d, yyyy");

  const deletableTasks = dayEvents.filter((event) => event.type === "task");

  const handleSelectAll = () => {
    if (selectedEvents.length === deletableTasks.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(deletableTasks.map((e) => e.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEvents.length === 0) return;

    setIsDeleting(true);
    try {
      await onDeleteSelected?.(selectedEvents);
      setSelectedEvents([]);
    } catch (error) {
      console.error("Error deleting tasks:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <JoyDialog
      open={isOpen}
      onClose={() => onClose()}
      title={`Events for ${formattedDate}`}
      size="lg"
      description="Everything scheduled on this day"
    >
      <JoyDialogContent>
        {deletableTasks.length > 0 ? (
          <JoyDialogActions sx={{ px: 0, pt: 0 }}>
            <JoyButton
              bloomVariant="outline"
              color="neutral"
              startDecorator={<CheckSquare size={14} />}
              onClick={handleSelectAll}
            >
              {selectedEvents.length === deletableTasks.length
                ? "Deselect All"
                : "Select All Tasks"}
            </JoyButton>
            {selectedEvents.length > 0 ? (
              <JoyButton
                color="danger"
                startDecorator={<Trash2 size={14} />}
                loading={isDeleting}
                onClick={handleDeleteSelected}
              >
                Delete ({selectedEvents.length})
              </JoyButton>
            ) : null}
          </JoyDialogActions>
        ) : null}

        <div style={{ overflow: "auto" }}>
          <CalendarListView
            events={dayEvents}
            onEventClick={onEventClick}
            selectionMode={true}
            selectedTaskIds={selectedEvents}
            onToggleTaskSelection={(eventId) => {
              setSelectedEvents((prev) =>
                prev.includes(eventId)
                  ? prev.filter((id) => id !== eventId)
                  : [...prev, eventId],
              );
            }}
          />
          {dayEvents.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "2rem",
                color: "var(--joy-palette-neutral-500)",
              }}
            >
              No events scheduled for this date.
            </div>
          )}
        </div>
      </JoyDialogContent>
    </JoyDialog>
  );
};
