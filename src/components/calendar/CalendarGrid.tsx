
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
  onDrop?: (date: Date) => void;
  isTaskSelected?: (task: any) => boolean;
}

export const CalendarGrid = ({
  campaigns,
  tasks,
  currentWeek,
  onTaskClick,
  onCampaignClick,
  onDateClick,
  selectedTasks,
  onDrop,
  isTaskSelected
}: CalendarGridProps) => {
  const start = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="grid grid-cols-7 gap-px bg-gray-200 h-full">
      {weekDays.map((date) => (
        <div key={date.toISOString()} className="bg-gray-100 p-2 text-sm font-medium text-gray-700 h-10 flex items-center justify-center">
          {date.toLocaleDateString(undefined, { weekday: 'short' })}
        </div>
      ))}
      
      {weekDays.map((date) => {
        const dayCampaigns = campaigns.filter(campaign => {
          const campaignDate = new Date(campaign.publish_date);
          return campaignDate.toDateString() === date.toDateString();
        });

        const dayTasks = tasks.filter(task => {
          const taskDate = new Date(task.scheduled_date);
          return taskDate.toDateString() === date.toDateString();
        });

        return (
          <CalendarDayCell
            key={date.toISOString()}
            date={date}
            campaigns={dayCampaigns}
            tasks={dayTasks}
            onTaskClick={(task, ctrlKey) => onTaskClick(task)}
            onCampaignClick={onCampaignClick}
            isCurrentMonth={true}
            isToday={date.toDateString() === new Date().toDateString()}
            onDrop={onDrop}
            isTaskSelected={isTaskSelected}
          />
        );
      })}
    </div>
  );
};
