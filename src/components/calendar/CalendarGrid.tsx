
import React from 'react';
import { CalendarDayCell } from './CalendarDayCell';
import { addDays, startOfWeek, startOfMonth, endOfMonth, isSameMonth, format } from 'date-fns';

interface CalendarGridProps {
  campaigns: any[];
  tasks: any[];
  newsletters: any[];
  currentDate: Date;
  viewMode: 'month' | 'week';
  onTaskClick: (task: any) => void;
  onTaskLongPress?: (task: any) => void;
  onCampaignClick: (campaign: any) => void;
  onNewsletterClick: (newsletter: any) => void;
  onDateClick: (date: Date) => void;
  selectedTasks: any[];
  onDrop?: (date: Date) => void;
  isTaskSelected?: (task: any) => boolean;
  isDragging?: boolean;
  draggedTask?: any;
  onDragStart?: (task: any) => void;
  onDragEnd?: () => void;
}

export const CalendarGrid = React.memo(({
  campaigns,
  tasks,
  newsletters,
  currentDate,
  viewMode,
  onTaskClick,
  onTaskLongPress,
  onCampaignClick,
  onNewsletterClick,
  onDateClick,
  selectedTasks,
  onDrop,
  isTaskSelected,
  isDragging,
  draggedTask,
  onDragStart,
  onDragEnd
}: CalendarGridProps) => {
  const generateDays = React.useMemo(() => {
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
  }, [currentDate, viewMode]);

  // Create a map of date strings to campaigns for efficient lookup
  const campaignsByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    
    campaigns.forEach(campaign => {
      if (!campaign.start_date) {
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

  // Create a map of date strings to newsletters for efficient lookup
  const newslettersByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    
    newsletters.forEach(newsletter => {
      if (!newsletter.scheduled_at) return;
      
      const dateKey = format(new Date(newsletter.scheduled_at), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(newsletter);
    });
    
    return map;
  }, [newsletters]);

  const days = generateDays;
  const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7';
  const dayHeight = viewMode === 'week' ? 'h-full' : 'min-h-[120px]';

  

  return (
    <div className="relative bg-gradient-to-br from-white/80 to-white/40 backdrop-blur-sm border border-white/20 rounded-2xl shadow-2xl overflow-hidden">
      {/* Gradient Background Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-slate-50/80 to-slate-100/60"></div>
      <div className="absolute inset-0 bg-black/5"></div>
      
      <div className={`relative z-10 grid ${gridCols} ${dayHeight}`}>
        {/* Clean Day headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
          <div key={day} className="bg-gradient-to-br from-slate-100/80 to-slate-200/60 backdrop-blur-sm p-3 text-sm font-bold text-slate-700 h-12 flex items-center justify-center border-b border-white/30">
            <span className="tracking-wide">{day}</span>
          </div>
        ))}
        
        {/* Calendar days with clean styling */}
        {days.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          
          // Get campaigns, tasks, and newsletters for this specific date only
          const dayCampaigns = campaignsByDate.get(dateKey) || [];
          const dayTasks = tasksByDate.get(dateKey) || [];
          const dayNewsletters = newslettersByDate.get(dateKey) || [];

          const isCurrentMonth = viewMode === 'week' || isSameMonth(date, currentDate);
          const isToday = date.toDateString() === new Date().toDateString();

          

          return (
            <CalendarDayCell
              key={date.toISOString()}
              date={date}
              campaigns={dayCampaigns}
              tasks={dayTasks}
              newsletters={dayNewsletters}
              onTaskClick={onTaskClick}
              onTaskLongPress={onTaskLongPress}
              onCampaignClick={onCampaignClick}
              onNewsletterClick={onNewsletterClick}
              onDateClick={onDateClick}
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
});
