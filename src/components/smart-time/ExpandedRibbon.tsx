
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { ScheduledContentPill } from '@/components/new-dashboard/ScheduledContentPill';

interface ExpandedRibbonProps {
  week: Date;
  scheduledByDate?: Record<string, any[]>;
  socialConnections?: any[];
  onPage: (date: Date) => void;
  onClose: () => void;
  onTaskClick: (task: any) => void;
  dragOverDay?: string | null;
  onDayDragOver?: (e: React.DragEvent, dayKey: string) => void;
  onDayDragLeave?: (e: React.DragEvent, dayKey: string) => void;
}

export const ExpandedRibbon = ({ 
  week, 
  scheduledByDate = {}, 
  socialConnections = [],
  onPage, 
  onClose, 
  onTaskClick,
  dragOverDay,
  onDayDragOver,
  onDayDragLeave
}: ExpandedRibbonProps) => {
  const weekStart = startOfWeek(week, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const nextWeek = () => onPage(addWeeks(week, 1));
  const prevWeek = () => onPage(addWeeks(week, -1));

  const getDayName = (date: Date) => format(date, 'EEE');
  const getDayNumber = (date: Date) => format(date, 'd');

  const getScheduledTasksForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return scheduledByDate[dateKey] || [];
  };

  const hasConnections = socialConnections.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-semibold text-[#3E5A6B]">Smart-Time Scheduling</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={prevWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium text-gray-600 min-w-[120px] text-center">
            {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
          </span>
          <Button variant="ghost" size="sm" onClick={nextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Connection Status */}
      {!hasConnections && (
        <div className="p-3 bg-amber-50 border-b border-amber-200">
          <p className="text-sm text-amber-800 text-center">
            <span className="font-medium">Connect social accounts</span> to enable automatic posting
          </p>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="flex-1 p-4 overflow-hidden">
        <div className="grid grid-cols-7 gap-3 h-full">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const scheduledTasksForDay = getScheduledTasksForDay(day);
            const isToday = isSameDay(day, new Date());
            const isDragOver = dragOverDay === dayKey;
            
            return (
              <Droppable key={dayKey} droppableId={`day-${dayKey}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-[180px] p-3 rounded-lg border-2 transition-all duration-200",
                      // Base styles
                      "bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5",
                      // Border styles based on state
                      snapshot.isDraggingOver || isDragOver
                        ? hasConnections
                          ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-lg border-solid"
                          : "border-red-400 bg-red-50/80 border-solid"
                        : "border-gray-200 border-dashed hover:border-[#68BEB9]/50",
                      // Today highlight
                      isToday && "ring-2 ring-[#68BEB9]/30",
                      // Animation for drag over
                      (snapshot.isDraggingOver || isDragOver) && "scale-105"
                    )}
                    onDragOver={(e) => onDayDragOver?.(e, dayKey)}
                    onDragLeave={(e) => onDayDragLeave?.(e, dayKey)}
                  >
                    {/* Day Header */}
                    <div className="text-center mb-3">
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isToday ? "text-[#68BEB9]" : "text-[#3E5A6B]"
                      )}>
                        {getDayName(day)}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold",
                        isToday ? "text-[#68BEB9]" : "text-gray-900"
                      )}>
                        {getDayNumber(day)}
                      </div>
                    </div>

                    {/* Scheduled Content */}
                    <div className="space-y-2 flex-1">
                      {scheduledTasksForDay.map((scheduledTaskData) => (
                        <ScheduledContentPill
                          key={`task-${scheduledTaskData.id}`}
                          task={scheduledTaskData}
                          scheduledMeta={scheduledTaskData.scheduledMeta}
                          onClick={() => onTaskClick(scheduledTaskData)}
                        />
                      ))}
                    </div>

                    {/* Drop zone indicator */}
                    {(snapshot.isDraggingOver || isDragOver) && (
                      <div className={cn(
                        "flex items-center justify-center h-12 text-sm font-medium mt-2 rounded border-2 border-dashed",
                        hasConnections 
                          ? "text-[#68BEB9] border-[#68BEB9] bg-[#68BEB9]/5" 
                          : "text-red-600 border-red-400 bg-red-50"
                      )}>
                        {hasConnections ? "Drop to schedule" : "Connect accounts first"}
                      </div>
                    )}

                    {/* Empty state */}
                    {!snapshot.isDraggingOver && !isDragOver && scheduledTasksForDay.length === 0 && (
                      <div className="flex items-center justify-center h-12 mt-2">
                        <div className="w-2 h-2 bg-gray-300 rounded-full opacity-50"></div>
                      </div>
                    )}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>
      </div>

      {/* Footer Tip */}
      <div className="p-4 bg-[#68BEB9]/5 border-t border-[#68BEB9]/20">
        <p className="text-sm text-[#3E5A6B] text-center">
          <span className="font-medium">Tip:</span> Drag approved drafts here to schedule them for specific days
        </p>
      </div>
    </div>
  );
};
