import React from 'react';
import { CalendarDayCell } from './CalendarDayCell';
import { addDays, startOfWeek } from 'date-fns';

interface CalendarGridProps {
  campaigns: any[];
  tasks: any[];
  currentWeek: Date;
  onTaskClick: (task: any) => void;
  onCampaignClick: (campaign: any) => void;
  onDateClick: (date: Date) => void;
  selectedTasks: any[];
  onDragStart: (event: React.DragEvent<HTMLDivElement>, task: any) => void;
  onDragEnd: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>, date: Date) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>, date: Date) => void;
  isDragging: boolean;
  draggedTasks: any[];
}

export const CalendarGrid = ({
  campaigns,
  tasks,
  currentWeek,
  onTaskClick,
  onCampaignClick,
  onDateClick,
  selectedTasks,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  isDragging,
  draggedTasks
}: CalendarGridProps) => {
  const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 h-full">
      {weekDays.map((date) => (
        <div key={date.toISOString()} className="bg-gray-100 p-2 text-sm font-medium text-gray-500 h-12 flex items-center justify-center">
          {date.toLocaleDateString(undefined, { weekday: 'short' })}
        </div>
      ))}
      
      {weekDays.map((date) => {
        const dayCampaigns = campaigns.filter(campaign => {
          const campaignDate = new Date(campaign.publish_date);
          return campaignDate.toDateString() === date.toDateString();
        });

        const dayTasks = tasks.filter(task => {
          const taskDate = new Date(task.publish_date);
          return taskDate.toDateString() === date.toDateString();
        });

        return (
          <CalendarDayCell
            key={date.toISOString()}
            date={date}
            campaigns={dayCampaigns}
            tasks={dayTasks}
            onTaskClick={onTaskClick}
            onCampaignClick={onCampaignClick}
            onDateClick={onDateClick}
            selectedTasks={selectedTasks}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            isDragging={isDragging}
            draggedTasks={draggedTasks}
          />
        );
      })}
    </div>
  );
};
