
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface SmartTimeRibbonProps {
  tasks: any[];
  onScheduleUpdate: () => void;
}

export const SmartTimeRibbon = ({ tasks, onScheduleUpdate }: SmartTimeRibbonProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const prevWeek = () => setCurrentWeek(addWeeks(currentWeek, -1));

  const getDayName = (date: Date) => format(date, 'EEE').toUpperCase();

  // Mock scheduled content - in real app would come from actual scheduling data
  const mockScheduledContent = [
    { day: 1, time: '10:15 AM', type: 'Newsletter', color: 'bg-[#68BEB9]' },
    { day: 3, time: '2:30 PM', type: 'Social', color: 'bg-blue-500' }
  ];

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
          const scheduledItem = mockScheduledContent.find(item => item.day === index);
          
          return (
            <div key={index} className="text-center">
              {/* Day Header */}
              <div className="mb-3">
                <div className="text-xs font-medium text-[#3E5A6B] mb-1">
                  {getDayName(day)}
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {format(day, 'd')}
                </div>
              </div>

              {/* Time Slot */}
              <div className="h-16 flex flex-col items-center justify-center">
                {scheduledItem ? (
                  <div className={cn(
                    "px-3 py-2 rounded-full text-white text-xs font-medium mb-1",
                    scheduledItem.color
                  )}>
                    {scheduledItem.type}
                  </div>
                ) : (
                  <div className="w-2 h-2 bg-gray-200 rounded-full mb-1"></div>
                )}
                
                {scheduledItem && (
                  <div className="text-xs text-gray-500">
                    {scheduledItem.time}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
