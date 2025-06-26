
import React from 'react';
import { CalendarDayCell } from './CalendarDayCell';
import { addDays, startOfWeek, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';

interface CalendarGridProps {
  campaigns: any[];
  tasks: any[];
  currentDate: Date;
  viewMode: 'month' | 'week';
  onTaskClick: (task: any) => void;
  onCampaignClick: (campaign: any) => void;
  onDateClick: (date: Date) => void;
  selectedTasks: any[];
  onDrop?: (date: Date) => void;
  isTaskSelected?: (task: any) => boolean;
  isDragging?: boolean;
  draggedTask?: any;
  onDragStart?: (task: any) => void;
  onDragEnd?: () => void;
}

export const CalendarGrid = ({
  campaigns,
  tasks,
  currentDate,
  viewMode,
  onTaskClick,
  onCampaignClick,
  onDateClick,
  selectedTasks,
  onDrop,
  isTaskSelected,
  isDragging,
  draggedTask,
  onDragStart,
  onDragEnd
}: CalendarGridProps) => {
  const generateDays = () => {
    if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    } else {
      // Month view - generate full 6-week grid (42 days)
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      
      return Array.from({ length: 42 }, (_, i) => addDays(calendarStart, i));
    }
  };

  const days = generateDays();
  const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7';
  const dayHeight = viewMode === 'week' ? 'h-full' : 'min-h-[120px]';

  return (
    <div className={`grid ${gridCols} gap-px bg-gray-200 ${dayHeight}`}>
      {/* Day headers */}
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
        <div key={day} className="bg-gray-100 p-2 text-sm font-medium text-gray-700 h-10 flex items-center justify-center">
          {day}
        </div>
      ))}
      
      {/* Calendar days */}
      {days.map((date) => {
        const dayCampaigns = campaigns.filter(campaign => {
          const campaignDate = new Date(campaign.publish_date || campaign.start_date);
          return campaignDate.toDateString() === date.toDateString();
        });

        const dayTasks = tasks.filter(task => {
          const taskDate = new Date(task.scheduled_date);
          return taskDate.toDateString() === date.toDateString();
        });

        const isCurrentMonth = viewMode === 'week' || isSameMonth(date, currentDate);
        const isToday = date.toDateString() === new Date().toDateString();

        return (
          <CalendarDayCell
            key={date.toISOString()}
            date={date}
            campaigns={dayCampaigns}
            tasks={dayTasks}
            onTaskClick={(task, ctrlKey) => onTaskClick(task)}
            onCampaignClick={onCampaignClick}
            isCurrentMonth={isCurrentMonth}
            isToday={isToday}
            onDrop={onDrop}
            isTaskSelected={isTaskSelected}
            isDragging={isDragging}
            draggedTask={draggedTask}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        );
      })}
    </div>
  );
};
