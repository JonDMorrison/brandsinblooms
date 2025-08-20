import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CalendarListView } from './CalendarListView';
import { format } from 'date-fns';
import { UnifiedCalendarEvent } from '@/hooks/useUnifiedCalendarData';

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  events: UnifiedCalendarEvent[];
  onEventClick: (event: UnifiedCalendarEvent) => void;
}

export const DayEventsModal = ({
  isOpen,
  onClose,
  date,
  events,
  onEventClick
}: DayEventsModalProps) => {
  if (!date) return null;

  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');
  const dayEvents = events.filter(event => 
    format(new Date(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Events for {formattedDate}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">
          <CalendarListView 
            events={dayEvents}
            onEventClick={onEventClick}
          />
          {dayEvents.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No events scheduled for this date.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};