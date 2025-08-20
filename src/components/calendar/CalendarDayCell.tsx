
import React from 'react';
import { cn } from "@/lib/utils";
import { CalendarDayHeader } from "./CalendarDayHeader";
import { CalendarDayContent } from "./CalendarDayContent";
import { CalendarDropZone } from "./CalendarDropZone";

interface Campaign {
  id: number;
  week_number: number;
  start_date: string;
  title: string;
  theme?: string;
  description?: string;
}

interface Task {
  id: string;
  scheduled_date: string;
  post_type: string;
  status: string;
  ai_output?: string;
  campaigns?: {
    title: string;
  };
}

interface Newsletter {
  id: string;
  name: string;
  subject_line: string;
  status: 'draft' | 'scheduled' | 'sent';
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  segment_id?: string;
  crm_segments?: {
    name: string;
  };
  metrics?: {
    sent?: number;
    opened?: number;
    clicked?: number;
  };
}

interface CalendarDayCellProps {
  date: Date;
  campaigns: Campaign[];
  tasks?: Task[];
  newsletters?: Newsletter[];
  holidays?: any[];
  scheduledPosts?: any[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onCampaignClick?: (campaign: Campaign) => void;
  onTaskClick?: (task: Task) => void;
  onTaskLongPress?: (task: Task) => void;
  onNewsletterClick?: (newsletter: Newsletter) => void;
  onHolidayClick?: (holiday: any) => void;
  onDateClick?: (date: Date) => void;
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  selectedTasks?: Task[];
  weekNumber?: number;
  onTaskSelection?: (task: Task, ctrlKey: boolean) => void;
  onDrop?: (date: Date) => void;
  isTaskSelected?: (task: Task) => boolean;
  taskSelectionMode?: boolean;
  isDragging?: boolean;
  draggedTask?: Task;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
}

export const CalendarDayCell = React.memo(({
  date,
  campaigns,
  tasks = [],
  newsletters = [],
  holidays = [],
  scheduledPosts = [],
  isCurrentMonth,
  isToday,
  onCampaignClick,
  onTaskClick,
  onTaskLongPress,
  onNewsletterClick,
  onHolidayClick,
  onDateClick,
  selectionMode = false,
  selectedCampaigns = [],
  selectedTasks = [],
  onTaskSelection,
  onDrop,
  isTaskSelected,
  isDragging = false,
  draggedTask,
  onDragStart,
  onDragEnd,
}: CalendarDayCellProps) => {
  const isWeekend = React.useMemo(() => {
    const day = date.getDay();
    return day === 0 || day === 6;
  }, [date]);
  
  const isPastDate = React.useMemo(() => {
    return date < new Date(new Date().setHours(0, 0, 0, 0));
  }, [date]);

  const handleDateClick = () => {
    if (onDateClick) {
      onDateClick(date);
    }
  };

  return (
    <CalendarDropZone
      date={date}
      isDragging={isDragging}
      draggedTask={draggedTask}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "min-h-[140px] p-3 relative cursor-pointer border-r border-b border-slate-200",
          // Current month styling
          isCurrentMonth && "bg-white hover:bg-slate-50",
          // Other month styling
          !isCurrentMonth && "bg-slate-50 text-slate-500",
          // Today styling
          isToday && "bg-blue-50 ring-2 ring-blue-200",
          // Weekend styling
          isWeekend && isCurrentMonth && "bg-green-50/50",
          // Past date styling
          isPastDate && isCurrentMonth && "bg-orange-50/50"
        )}
        style={{ 
          willChange: 'background-color',
          transition: 'background-color 0.15s ease-out'
        }}
        onClick={handleDateClick}
      >
        {/* Today corner accent */}
        {isToday && (
          <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-blue-400/40 rounded-tr-lg" />
        )}

        <CalendarDayHeader
          date={date}
          isCurrentMonth={isCurrentMonth}
          isToday={isToday}
        />
        
        <CalendarDayContent
          campaigns={campaigns}
          tasks={tasks}
          newsletters={newsletters}
          holidays={holidays}
          scheduledPosts={scheduledPosts}
          selectionMode={selectionMode}
          selectedCampaigns={selectedCampaigns}
          isPastDate={isPastDate}
          draggedTask={draggedTask}
          onCampaignClick={onCampaignClick}
          onTaskClick={onTaskClick}
          onTaskLongPress={onTaskLongPress}
          onNewsletterClick={onNewsletterClick}
          onHolidayClick={onHolidayClick}
          isTaskSelected={isTaskSelected}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </div>
    </CalendarDropZone>
  );
});
