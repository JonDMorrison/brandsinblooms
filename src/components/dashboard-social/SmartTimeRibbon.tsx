
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { useDashboard } from '@/contexts/DashboardContext';

export const SmartTimeRibbon = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const { scheduleDraft } = useDashboard();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const prevWeek = () => setCurrentWeek(addWeeks(currentWeek, -1));

  const getDayName = (date: Date) => format(date, 'EEE');
  const getDayNumber = (date: Date) => format(date, 'd');

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 border border-white/20">
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
        </div>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          
          return (
            <Droppable key={dayKey} droppableId={`calendar-day-${dayKey}`}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    "min-h-[100px] p-3 rounded-lg border-2 border-dashed transition-all duration-200",
                    snapshot.isDraggingOver 
                      ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-md" 
                      : "border-gray-200 bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5 hover:border-[#68BEB9]/50"
                  )}
                >
                  <div className="text-center mb-3">
                    <div className="text-xs font-medium text-[#3E5A6B] mb-1">
                      {getDayName(day)}
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {getDayNumber(day)}
                    </div>
                  </div>

                  {/* Drop zone indicator */}
                  {snapshot.isDraggingOver && (
                    <div className="flex items-center justify-center h-12 text-sm text-[#68BEB9] font-medium">
                      Drop to schedule
                    </div>
                  )}

                  {/* Placeholder for future scheduled items */}
                  {!snapshot.isDraggingOver && (
                    <div className="flex items-center justify-center h-12">
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
          <span className="font-medium">Tip:</span> Drag drafts from the tray to schedule them for specific days.
        </p>
      </div>
    </div>
  );
};
