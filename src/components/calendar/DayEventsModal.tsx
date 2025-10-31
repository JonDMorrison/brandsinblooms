import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarListView } from './CalendarListView';
import { format } from 'date-fns';
import { UnifiedCalendarEvent } from '@/hooks/useUnifiedCalendarData';
import { X, Trash2, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DayEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  events: UnifiedCalendarEvent[];
  onEventClick: (event: UnifiedCalendarEvent) => void;
  onDataUpdate?: () => void;
}

export const DayEventsModal = ({
  isOpen,
  onClose,
  date,
  events,
  onEventClick,
  onDataUpdate
}: DayEventsModalProps) => {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!date) return null;

  const formattedDate = format(date, 'EEEE, MMMM d, yyyy');
  const dayEvents = events.filter(event => 
    format(new Date(event.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
  );

  // Filter to only show task events that can be deleted
  const deletableTasks = dayEvents.filter(event => event.type === 'task');

  const handleSelectAll = () => {
    if (selectedEvents.length === deletableTasks.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(deletableTasks.map(e => e.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEvents.length === 0) return;

    setIsDeleting(true);
    try {
      await Promise.all(selectedEvents.map(async (eventId) => {
        const { error } = await supabase
          .from('content_tasks')
          .delete()
          .eq('id', eventId);
        
        if (error) throw error;
      }));

      toast.success(`Deleted ${selectedEvents.length} task${selectedEvents.length > 1 ? 's' : ''}`);
      setSelectedEvents([]);
      onDataUpdate?.();
    } catch (error) {
      console.error('Error deleting tasks:', error);
      toast.error('Failed to delete tasks');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden p-6">
        <DialogClose asChild>
          <Button variant="ghost" size="icon" className="absolute right-4 top-4 h-6 w-6">
            <X className="h-4 w-4" />
          </Button>
        </DialogClose>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold pr-8">
            Events for {formattedDate}
          </DialogTitle>
        </DialogHeader>
        
        {/* Bulk actions for deletable tasks */}
        {deletableTasks.length > 0 && (
          <div className="flex items-center justify-between gap-2 py-2 px-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                className="h-8"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {selectedEvents.length === deletableTasks.length ? 'Deselect All' : 'Select All Tasks'}
              </Button>
              <span className="text-sm text-muted-foreground">
                {selectedEvents.length} of {deletableTasks.length} selected
              </span>
            </div>
            {selectedEvents.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="h-8"
              >
                {isDeleting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete ({selectedEvents.length})
              </Button>
            )}
          </div>
        )}
        
        <div className="overflow-auto">
          <CalendarListView 
            events={dayEvents}
            onEventClick={onEventClick}
            selectedEvents={selectedEvents}
            onToggleSelect={(eventId) => {
              setSelectedEvents(prev =>
                prev.includes(eventId)
                  ? prev.filter(id => id !== eventId)
                  : [...prev, eventId]
              );
            }}
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