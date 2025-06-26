
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

  // Deduplicate campaigns and tasks at the source level
  const uniqueCampaigns = campaigns.filter((campaign, index, self) => 
    index === self.findIndex(c => c.id === campaign.id)
  );
  
  const uniqueTasks = tasks.filter((task, index, self) => 
    index === self.findIndex(t => t.id === task.id)
  );

  console.log('CalendarGrid: Original campaigns:', campaigns.length, 'Unique:', uniqueCampaigns.length);
  console.log('CalendarGrid: Original tasks:', tasks.length, 'Unique:', uniqueTasks.length);

  const days = generateDays();
  const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7';
  const dayHeight = viewMode === 'week' ? 'h-full' : 'min-h-[120px]';

  return (
    <div className="bg-gradient-to-br from-green-50/30 to-blue-50/20 rounded-xl shadow-sm border border-green-100/50 overflow-hidden">
      <div className={`grid ${gridCols} ${dayHeight}`}>
        {/* Enhanced Day headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
          <div key={day} className="bg-gradient-to-b from-green-100/80 to-green-50/60 p-3 text-sm font-semibold text-green-800 h-12 flex items-center justify-center border-b border-green-200/50">
            <span className="tracking-wide">{day}</span>
          </div>
        ))}
        
        {/* Calendar days with enhanced styling */}
        {days.map((date) => {
          const dayCampaigns = uniqueCampaigns.filter(campaign => {
            const campaignDate = new Date(campaign.publish_date || campaign.start_date);
            return campaignDate.toDateString() === date.toDateString();
          });

          const dayTasks = uniqueTasks.filter(task => {
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
              onTaskClick={(task, ctrlKey) => {
                console.log('CalendarGrid: Task click event triggered for task:', task.id);
                onTaskClick(task);
              }}
              onCampaignClick={(campaign) => {
                console.log('CalendarGrid: Campaign click event triggered for campaign:', campaign.id);
                onCampaignClick(campaign);
              }}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              selectionMode={false}
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
    </div>
  );
};
