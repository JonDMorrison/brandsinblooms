import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { CalendarTaskItem } from "./CalendarTaskItem";
import { useState } from "react";

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
  const [isHoveredDrop, setIsHoveredDrop] = useState(false);
  const dayNumber = format(date, 'd');
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));

  const isCampaignSelected = (campaign: Campaign) => {
    return selectedCampaigns.some(c => c.id === campaign.id);
  };

  const handleTaskClick = (task: Task, ctrlKey: boolean = false) => {
    if (ctrlKey && onTaskSelection) {
      onTaskSelection(task, ctrlKey);
    } else if (onTaskClick) {
      onTaskClick(task, ctrlKey);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isDragging && draggedTask) {
      const draggedTaskDate = format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      
      if (draggedTaskDate !== targetDate) {
        e.dataTransfer.dropEffect = 'move';
        setIsHoveredDrop(true);
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveredDrop(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveredDrop(false);
    
    if (onDrop && isDragging && draggedTask) {
      const draggedTaskDate = format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      
      // Only allow drop if it's a different date
      if (draggedTaskDate !== targetDate) {
        onDrop(date);
      }
    }
  };

  const canDrop = isDragging && draggedTask && 
    format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd');

  return (
    <div
      className={cn(
        "min-h-[120px] p-3 border transition-all duration-200 relative",
        !isCurrentMonth && "text-gray-400 bg-gray-50/50",
        isCurrentMonth && "bg-white hover:bg-gray-50/30 border-gray-200",
        isToday && "bg-blue-50/50 border-blue-200",
        isWeekend && isCurrentMonth && "bg-gray-50/20",
        isPastDate && "bg-yellow-50/20",
        // Drag and drop styling
        isDragging && canDrop && "border-dashed border-2",
        isDragging && canDrop && isHoveredDrop && "border-green-400 bg-green-50/30",
        isDragging && canDrop && !isHoveredDrop && "border-blue-300 bg-blue-50/20",
        isDragging && !canDrop && "opacity-50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop indicator overlay */}
      {isDragging && canDrop && isHoveredDrop && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-100/80 border-2 border-green-400 border-dashed rounded-lg z-10">
          <div className="text-green-700 font-medium text-sm">
            Drop here to reschedule
          </div>
        </div>
      )}

      {/* Day number header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium flex items-center justify-center w-6 h-6 rounded-full",
              isToday && "bg-blue-600 text-white",
              !isToday && isCurrentMonth && "text-gray-700",
              !isCurrentMonth && "text-gray-400"
            )}
          >
            {dayNumber}
          </span>
          {isToday && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700">
              Today
            </Badge>
          )}
        </div>
      </div>
      
      {/* Content container */}
      <div className="space-y-1.5">
        {/* Campaigns */}
        {campaigns.slice(0, 2).map((campaign) => {
          const isSelected = isCampaignSelected(campaign);
          
          return (
            <div
              key={campaign.id}
              className={cn(
                "relative p-2 rounded-md cursor-pointer transition-all duration-200 border text-xs",
                selectionMode && isSelected 
                  ? "bg-blue-50 border-blue-300" 
                  : "bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/50",
                !selectionMode && "hover:border-blue-300 hover:shadow-sm"
              )}
              onClick={() => onCampaignClick?.(campaign)}
            >
              {selectionMode && isSelected && (
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-800 truncate pr-2">
                  {campaign.title}
                </h4>
                <Badge className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 shrink-0">
                  W{campaign.week_number}
                </Badge>
              </div>
              
              {campaign.theme && campaign.theme !== campaign.title && (
                <p className="text-xs text-gray-600 truncate mt-1">
                  {campaign.theme}
                </p>
              )}
            </div>
          );
        })}

        {/* Tasks */}
        <div className="space-y-1">
          {tasks.slice(0, campaigns.length > 0 ? 2 : 3).map((task) => (
            <CalendarTaskItem
              key={task.id}
              task={task}
              isSelected={isTaskSelected?.(task) || false}
              isBeingDragged={draggedTask?.id === task.id}
              isPastDate={isPastDate}
              selectionMode={true}
              onTaskClick={handleTaskClick}
              onDragStart={onDragStart || (() => {})}
              onDragEnd={onDragEnd || (() => {})}
            />
          ))}
        </div>
        
        {/* Show more indicator */}
        {(campaigns.length + tasks.length) > 3 && (
          <div className="text-xs text-gray-500 text-center py-1 bg-gray-50/50 rounded border border-gray-100">
            +{(campaigns.length + tasks.length) - 3} more
          </div>
        )}
      </div>
    </div>
  );
};
