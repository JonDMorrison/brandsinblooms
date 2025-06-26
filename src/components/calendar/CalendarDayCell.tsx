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

interface CalendarDayCellProps {
  date: Date;
  campaigns: Campaign[];
  tasks?: Task[];
  isCurrentMonth: boolean;
  isToday: boolean;
  onCampaignClick?: (campaign: Campaign) => void;
  onTaskClick?: (task: Task, ctrlKey: boolean) => void;
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

export const CalendarDayCell = ({
  date,
  campaigns,
  tasks = [],
  isCurrentMonth,
  isToday,
  onCampaignClick,
  onTaskClick,
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
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <CalendarDropZone
      date={date}
      isDragging={isDragging}
      draggedTask={draggedTask}
      onDrop={onDrop}
    >
      <div
        className={cn(
          "min-h-[140px] p-3 transition-all duration-300 relative group",
          // Base styling with warmer colors
          "border-r border-b border-green-100/40",
          // Current month styling
          isCurrentMonth && "bg-gradient-to-br from-white via-green-50/20 to-blue-50/10 hover:from-green-50/30 hover:to-blue-50/20",
          // Other month styling
          !isCurrentMonth && "bg-gradient-to-br from-gray-50/50 to-gray-100/30 text-gray-500",
          // Today styling
          isToday && "bg-gradient-to-br from-blue-50/60 to-green-50/40 ring-2 ring-blue-200/50 shadow-sm",
          // Weekend styling
          isWeekend && isCurrentMonth && "bg-gradient-to-br from-green-50/40 to-emerald-50/20",
          // Past date styling
          isPastDate && isCurrentMonth && "bg-gradient-to-br from-orange-50/20 to-yellow-50/10",
          // Subtle hover shadow
          isCurrentMonth && "hover:shadow-md hover:shadow-green-100/50"
        )}
      >
        {/* Subtle corner accent for today */}
        {isToday && (
          <div className="absolute top-0 right-0 w-0 h-0 border-l-[20px] border-l-transparent border-t-[20px] border-t-blue-400/30 rounded-tr-lg" />
        )}

        <CalendarDayHeader
          date={date}
          isCurrentMonth={isCurrentMonth}
          isToday={isToday}
        />
        
        <CalendarDayContent
          campaigns={campaigns}
          tasks={tasks}
          selectionMode={selectionMode}
          selectedCampaigns={selectedCampaigns}
          isPastDate={isPastDate}
          draggedTask={draggedTask}
          onCampaignClick={onCampaignClick}
          onTaskClick={onTaskClick}
          isTaskSelected={isTaskSelected}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />

        {/* Subtle gradient overlay for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-transparent to-white/5 pointer-events-none rounded-sm" />
      </div>
    </CalendarDropZone>
  );
};
