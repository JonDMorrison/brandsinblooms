
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
          "min-h-[120px] p-3 border transition-all duration-200",
          !isCurrentMonth && "text-gray-400 bg-gray-50/50",
          isCurrentMonth && "bg-white hover:bg-gray-50/30 border-gray-200",
          isToday && "bg-blue-50/50 border-blue-200",
          isWeekend && isCurrentMonth && "bg-gray-50/20",
          isPastDate && "bg-yellow-50/20"
        )}
      >
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
