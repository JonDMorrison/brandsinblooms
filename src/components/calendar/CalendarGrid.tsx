
import React from 'react';
import { CalendarDayCell } from './CalendarDayCell';
import { addDays, startOfWeek, startOfMonth, endOfMonth, isSameMonth, format } from 'date-fns';

interface CalendarGridProps {
  campaigns: any[];
  tasks: any[];
  currentDate: Date;
  viewMode: 'month' | 'week';
  onTaskClick: (task: any) => void;
  onTaskLongPress?: (task: any) => void;
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
  onTaskLongPress,
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

  // Create a map of date strings to campaigns for efficient lookup
  const campaignsByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    
    campaigns.forEach(campaign => {
      if (!campaign.start_date) {
        console.log('CalendarGrid: Campaign missing start_date:', campaign);
        return;
      }
      
      const dateKey = format(new Date(campaign.start_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(campaign);
    });
    
    // Deduplicate campaigns within each date group
    map.forEach((campaignsForDate, dateKey) => {
      const uniqueCampaigns = campaignsForDate.reduce((acc: any[], campaign: any) => {
        // Check if we already have a campaign with the same week_number and title
        const isDuplicate = acc.some(existing => 
          existing.week_number === campaign.week_number && 
          existing.title === campaign.title
        );
        
        if (!isDuplicate) {
          acc.push(campaign);
        }
        
        return acc;
      }, []);
      
      map.set(dateKey, uniqueCampaigns);
    });
    
    return map;
  }, [campaigns]);

  // Create a map of date strings to tasks for efficient lookup
  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    
    tasks.forEach(task => {
      if (!task.scheduled_date) return;
      
      const dateKey = format(new Date(task.scheduled_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(task);
    });
    
    return map;
  }, [tasks]);

  const days = generateDays();
  const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7';
  const dayHeight = viewMode === 'week' ? 'h-full' : 'min-h-[120px]';

  console.log('CalendarGrid: Rendering with', campaigns.length, 'campaigns and', tasks.length, 'tasks');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200/60 overflow-hidden">
      <div className={`grid ${gridCols} ${dayHeight}`}>
        {/* Clean Day headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
          <div key={day} className="bg-gray-50/80 p-3 text-sm font-medium text-gray-700 h-12 flex items-center justify-center border-b border-gray-200/50">
            <span className="tracking-wide">{day}</span>
          </div>
        ))}
        
        {/* Calendar days with clean styling */}
        {days.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          
          // Get campaigns and tasks for this specific date only
          const dayCampaigns = campaignsByDate.get(dateKey) || [];
          const dayTasks = tasksByDate.get(dateKey) || [];

          const isCurrentMonth = viewMode === 'week' || isSameMonth(date, currentDate);
          const isToday = date.toDateString() === new Date().toDateString();

          console.log(`CalendarGrid: Date ${dateKey} has ${dayCampaigns.length} campaigns and ${dayTasks.length} tasks`);

          return (
            <CalendarDayCell
              key={date.toISOString()}
              date={date}
              campaigns={dayCampaigns}
              tasks={dayTasks}
              onTaskClick={onTaskClick}
              onTaskLongPress={onTaskLongPress}
              onCampaignClick={onCampaignClick}
              isCurrentMonth={isCurrentMonth}
              isToday={isToday}
              selectionMode={true}
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
