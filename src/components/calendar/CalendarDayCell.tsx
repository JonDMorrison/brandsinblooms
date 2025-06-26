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
          // Base styling with improved shadows and borders
          "border-r border-b border-green-100/60 shadow-sm",
          // Current month styling with subtle gradients
          isCurrentMonth && "bg-gradient-to-br from-white via-green-50/30 to-blue-50/20 hover:from-green-50/40 hover:to-blue-50/30 hover:shadow-md",
          // Other month styling
          !isCurrentMonth && "bg-gradient-to-br from-gray-50/70 to-gray-100/50 text-gray-500",
          // Today styling with enhanced visual prominence
          isToday && "bg-gradient-to-br from-blue-50/80 to-green-50/60 ring-2 ring-blue-200/60 shadow-md",
          // Weekend styling
          isWeekend && isCurrentMonth && "bg-gradient-to-br from-green-50/50 to-emerald-50/30",
          // Past date styling
          isPastDate && isCurrentMonth && "bg-gradient-to-br from-orange-50/30 to-yellow-50/20",
          // Enhanced hover effects
          isCurrentMonth && "hover:shadow-lg hover:shadow-green-100/30 hover:scale-[1.02] hover:z-10"
        )}
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
      </div>
    </CalendarDropZone>
  );
};
