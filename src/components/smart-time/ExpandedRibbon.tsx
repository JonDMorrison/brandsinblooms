
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { ScheduledContentPill } from '@/components/new-dashboard/ScheduledContentPill';

interface ExpandedRibbonProps {
  week: Date;
  scheduledByDate: Record<string, any[]>;
  socialConnections: any[];
  onPage: (date: Date) => void;
  onClose: () => void;
  onTaskClick: (task: any) => void;
  onDragEnd?: (result: any) => void;
}

export const ExpandedRibbon = ({ 
  week, 
  scheduledByDate, 
  socialConnections,
  onPage, 
  onClose, 
  onTaskClick,
  onDragEnd 
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
    <div className="smartDockExpanded">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#3E5A6B]">Smart-Time Ribbon</h2>
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
            <Button variant="ghost" size="sm" onClick={onClose} className="ml-2">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!hasConnections && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800 text-center">
              <span className="font-medium">No social connections:</span> Connect your social accounts to schedule posts
            </p>
          </div>
        )}

        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const scheduledTasksForDay = getScheduledTasksForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <Droppable key={dayKey} droppableId={`day-${dayKey}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-[120px] p-3 rounded-lg border-2 border-dashed transition-all duration-200",
                      snapshot.isDraggingOver && hasConnections
                        ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-md" 
                        : hasConnections
                        ? "border-gray-200 bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5 hover:border-[#68BEB9]/50"
                        : "border-red-200 bg-red-50/30",
                      isToday && "ring-2 ring-[#68BEB9]/30"
                    )}
                  >
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

                    {/* Scheduled Content Tasks */}
                    <div className="space-y-2">
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
                    {snapshot.isDraggingOver && hasConnections && (
                      <div className="flex items-center justify-center h-8 text-sm text-[#68BEB9] font-medium mt-2">
                        Drop to schedule
                      </div>
                    )}

                    {/* No connections warning when dragging */}
                    {snapshot.isDraggingOver && !hasConnections && (
                      <div className="flex items-center justify-center h-8 text-sm text-red-600 font-medium mt-2">
                        Connect social accounts first
                      </div>
                    )}

                    {/* Empty state */}
                    {!snapshot.isDraggingOver && scheduledTasksForDay.length === 0 && (
                      <div className="flex items-center justify-center h-8 mt-2">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      </div>
                    )}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-[#68BEB9]/5 rounded-lg border border-[#68BEB9]/20">
          <p className="text-sm text-[#3E5A6B]">
            <span className="font-medium">Tip:</span> Drag approved drafts from the tray to schedule them for specific days.
          </p>
        </div>
      </div>
    </div>
  );
};
