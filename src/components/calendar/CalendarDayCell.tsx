import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedCalendarTaskItem } from "./EnhancedCalendarTaskItem";
import { EnhancedDropZone } from "./EnhancedDropZone";

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
}: CalendarDayCellProps) => {
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

  const handleTaskSelectionToggle = (task: Task) => {
    if (onTaskSelection) {
      onTaskSelection(task, true);
    }
  };

  const handleDrop = (targetDate: Date) => {
    if (onDrop) {
      onDrop(targetDate);
    }
  };

  return (
    <EnhancedDropZone
      date={date}
      onDrop={handleDrop}
      className={cn(
        "group min-h-[140px] p-3 border transition-all duration-300 relative overflow-hidden",
        !isCurrentMonth && "text-gray-400 bg-gray-50/50",
        isCurrentMonth && "bg-white hover:bg-blue-50/30 border-gray-200",
        isToday && "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-md",
        isWeekend && isCurrentMonth && "bg-gray-50/80",
        selectionMode && "cursor-pointer",
        isPastDate && "opacity-60"
      )}
    >
      {/* Day number */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold flex items-center justify-center w-7 h-7 rounded-full transition-colors",
              isToday && "bg-blue-600 text-white shadow-sm",
              !isToday && isCurrentMonth && "text-gray-700 hover:bg-gray-100",
              !isCurrentMonth && "text-gray-400"
            )}
          >
            {dayNumber}
          </span>
          {isToday && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 border-blue-200">
              Today
            </Badge>
          )}
        </div>
      </div>
      
      {/* Content container */}
      <div className="space-y-2">
        {/* Campaigns */}
        {campaigns.slice(0, 2).map((campaign) => {
          const isSelected = isCampaignSelected(campaign);
          
          return (
            <div
              key={campaign.id}
              className={cn(
                "relative text-xs p-2 rounded-lg cursor-pointer transition-all duration-200 group/campaign",
                selectionMode && isSelected 
                  ? "bg-blue-200 border-2 border-blue-400 shadow-sm transform scale-[0.98]" 
                  : "bg-gradient-to-r from-emerald-100 to-green-100 border border-emerald-200 hover:from-emerald-200 hover:to-green-200 hover:shadow-sm hover:-translate-y-0.5",
                !selectionMode && "hover:shadow-md"
              )}
              onClick={() => onCampaignClick?.(campaign)}
            >
              {selectionMode && isSelected && (
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                  <Check className="w-3 h-3" />
                </div>
              )}
              
              <div className="w-full">
                <div className="font-semibold text-emerald-800 truncate leading-tight">
                  {campaign.title}
                </div>
                {campaign.theme && campaign.theme !== campaign.title && (
                  <div className="text-emerald-700 truncate mt-0.5 leading-tight">
                    {campaign.theme}
                  </div>
                )}
                <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <span>Week {campaign.week_number}</span>
                </div>
              </div>
              
              {/* Hover overlay for better interactivity */}
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/campaign:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
            </div>
          );
        })}

        {/* Enhanced Content Tasks */}
        {tasks.slice(0, campaigns.length > 0 ? 2 : 3).map((task) => (
          <EnhancedCalendarTaskItem
            key={task.id}
            task={task}
            isSelected={isTaskSelected?.(task) || false}
            isPastDate={isPastDate}
            onTaskClick={handleTaskClick}
            onSelectionToggle={handleTaskSelectionToggle}
            isTaskSelected={isTaskSelected || (() => false)}
            selectedTasks={selectedTasks || []}
          />
        ))}
        
        {/* Show more indicator */}
        {(campaigns.length + tasks.length) > 3 && (
          <div className="text-xs text-gray-500 text-center py-1 bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
            +{(campaigns.length + tasks.length) - 3} more item{(campaigns.length + tasks.length) - 3 !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </EnhancedDropZone>
  );
};
