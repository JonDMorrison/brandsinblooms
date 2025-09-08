
import React from 'react';
import { CalendarDayCell } from './CalendarDayCell';
import { addDays, startOfWeek, startOfMonth, endOfMonth, isSameMonth, format } from 'date-fns';
import { UnifiedCalendarEvent } from '@/hooks/useUnifiedCalendarData';

interface CalendarGridProps {
  campaigns: any[];
  tasks: any[];
  newsletters: any[];
  scheduledPosts?: any[];
  holidays?: any[];
  unifiedEvents?: UnifiedCalendarEvent[];
  eventsByDate?: Record<string, UnifiedCalendarEvent[]>;
  currentDate: Date;
  viewMode: 'month' | 'week';
  onTaskClick: (task: any) => void;
  onTaskLongPress?: (task: any) => void;
  onCampaignClick: (campaign: any) => void;
  onNewsletterClick: (newsletter: any) => void;
  onHolidayClick?: (holiday: any) => void;
  onEventClick?: (event: UnifiedCalendarEvent) => void;
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
  scheduledPosts = [],
  holidays = [],
  unifiedEvents = [],
  eventsByDate = {},
  currentDate,
  viewMode,
  onTaskClick,
  onTaskLongPress,
  onCampaignClick,
  onNewsletterClick,
  onHolidayClick,
  onEventClick,
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
      
      // Normalize campaign display date to the Monday of the week for weekly themes
      const campaignDate = new Date(campaign.start_date);
      const mondayOfWeek = startOfWeek(campaignDate, { weekStartsOn: 1 });
      const dateKey = format(mondayOfWeek, 'yyyy-MM-dd');
      
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

  // Create a map of date strings to holidays for efficient lookup
  const holidaysByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    
    holidays.forEach(holiday => {
      if (!holiday.holiday_date) return;
      
      const dateKey = format(new Date(holiday.holiday_date), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(holiday);
    });
    
    return map;
  }, [holidays]);

  // Create a map of date strings to scheduled posts for efficient lookup
  const scheduledPostsByDate = React.useMemo(() => {
    const map = new Map<string, any[]>();
    
    scheduledPosts.forEach(post => {
      if (!post.publish_at) return;
      
      const dateKey = format(new Date(post.publish_at), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(post);
    });
    
    return map;
  }, [scheduledPosts]);

  const days = generateDays;
  const gridCols = viewMode === 'week' ? 'grid-cols-7' : 'grid-cols-7';
  const dayHeight = viewMode === 'week' ? 'h-full' : 'min-h-[120px]';

  return (
    <div 
      className="relative bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden" 
      style={{ 
        contain: 'layout style paint',
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      {/* Mobile: Horizontal scroll container */}
      <div className="md:hidden overflow-x-auto">
        <div className="grid grid-cols-7 min-w-[700px]">
          {/* Clean Day headers */}
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
            <div key={day} className="bg-slate-100 p-3 text-sm font-bold text-slate-700 h-12 flex items-center justify-center border-b border-slate-200 min-w-[100px]">
              <span className="tracking-wide">{day}</span>
            </div>
          ))}
          
          {/* Calendar days with clean styling */}
          {days.map((date) => {
            const dateKey = format(date, 'yyyy-MM-dd');
            
            // Get campaigns, tasks, newsletters, holidays, and scheduled posts for this specific date only
            const dayCampaigns = campaignsByDate.get(dateKey) || [];
            const dayTasks = tasksByDate.get(dateKey) || [];
            const dayNewsletters = newslettersByDate.get(dateKey) || [];
            const dayHolidays = holidaysByDate.get(dateKey) || [];
            const dayScheduledPosts = scheduledPostsByDate.get(dateKey) || [];

            const isCurrentMonth = viewMode === 'week' || isSameMonth(date, currentDate);
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <CalendarDayCell
                key={date.toISOString()}
                date={date}
                campaigns={dayCampaigns}
                tasks={dayTasks}
                newsletters={dayNewsletters}
                holidays={dayHolidays}
                scheduledPosts={dayScheduledPosts}
                onTaskClick={onTaskClick}
                onTaskLongPress={onTaskLongPress}
                onCampaignClick={onCampaignClick}
                onNewsletterClick={onNewsletterClick}
                onHolidayClick={onHolidayClick}
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
      
      {/* Desktop: Standard grid */}
      <div className={`hidden md:block relative grid ${gridCols} ${dayHeight}`}>
        {/* Clean Day headers */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
          <div key={day} className="bg-slate-100 p-3 text-sm font-bold text-slate-700 h-12 flex items-center justify-center border-b border-slate-200">
            <span className="tracking-wide">{day}</span>
          </div>
        ))}
        
        {/* Calendar days with clean styling */}
        {days.map((date) => {
          const dateKey = format(date, 'yyyy-MM-dd');
          
          // Get campaigns, tasks, newsletters, holidays, and scheduled posts for this specific date only
          const dayCampaigns = campaignsByDate.get(dateKey) || [];
          const dayTasks = tasksByDate.get(dateKey) || [];
          const dayNewsletters = newslettersByDate.get(dateKey) || [];
          const dayHolidays = holidaysByDate.get(dateKey) || [];
          const dayScheduledPosts = scheduledPostsByDate.get(dateKey) || [];

          const isCurrentMonth = viewMode === 'week' || isSameMonth(date, currentDate);
          const isToday = date.toDateString() === new Date().toDateString();

          return (
            <CalendarDayCell
              key={date.toISOString()}
              date={date}
              campaigns={dayCampaigns}
              tasks={dayTasks}
              newsletters={dayNewsletters}
              holidays={dayHolidays}
              scheduledPosts={dayScheduledPosts}
              onTaskClick={onTaskClick}
              onTaskLongPress={onTaskLongPress}
              onCampaignClick={onCampaignClick}
              onNewsletterClick={onNewsletterClick}
              onHolidayClick={onHolidayClick}
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
