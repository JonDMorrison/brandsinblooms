
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
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
        "group min-h-[140px] p-3 border transition-all duration-200 relative",
        !isCurrentMonth && "text-gray-400 bg-gray-50/50",
        isCurrentMonth && "bg-white hover:bg-gray-50/50 border-gray-200",
        isToday && "bg-blue-50 border-blue-200 shadow-sm",
        isWeekend && isCurrentMonth && "bg-gray-50/30",
        selectionMode && "cursor-pointer",
        isPastDate && "bg-yellow-50/30 border-yellow-200/50"
      )}
    >
      {/* Day number header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-semibold flex items-center justify-center w-6 h-6 rounded-full transition-colors",
              isToday && "bg-blue-600 text-white",
              !isToday && isCurrentMonth && "text-gray-700",
              !isCurrentMonth && "text-gray-400",
              isPastDate && isCurrentMonth && "text-yellow-700"
            )}
          >
            {dayNumber}
          </span>
          {isToday && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 border-0">
              Today
            </Badge>
          )}
          {isPastDate && !isToday && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 border-0">
              Past
            </Badge>
          )}
        </div>
      </div>
      
      {/* Content container */}
      <div className="space-y-2">
        {/* Campaigns - Clean card design */}
        {campaigns.slice(0, 2).map((campaign) => {
          const isSelected = isCampaignSelected(campaign);
          
          return (
            <div
              key={campaign.id}
              className={cn(
                "relative p-2.5 rounded-md cursor-pointer transition-all duration-200 border",
                selectionMode && isSelected 
                  ? "bg-blue-50 border-blue-300 shadow-sm" 
                  : "bg-white border-gray-200 hover:border-green-300 hover:bg-green-50/50 hover:shadow-sm",
                !selectionMode && "hover:border-green-300"
              )}
              onClick={() => onCampaignClick?.(campaign)}
            >
              {selectionMode && isSelected && (
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center">
                  <Check className="w-2.5 h-2.5" />
                </div>
              )}
              
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-gray-800 truncate pr-2">
                    {campaign.title}
                  </h4>
                  <Badge className="text-xs bg-green-100 text-green-700 border-0 px-1.5 py-0.5 shrink-0">
                    W{campaign.week_number}
                  </Badge>
                </div>
                
                {campaign.theme && campaign.theme !== campaign.title && (
                  <p className="text-xs text-gray-600 truncate leading-relaxed">
                    {campaign.theme}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {/* Enhanced Content Tasks - Clean design */}
        <div className="space-y-1.5">
          {tasks.slice(0, campaigns.length > 0 ? 2 : 3).map((task) => (
            <div
              key={task.id}
              className={cn(
                "p-2 rounded-md border cursor-pointer transition-all duration-200",
                "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm",
                isTaskSelected?.(task) && "border-blue-300 bg-blue-50"
              )}
              onClick={() => handleTaskClick(task, false)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="text-sm">
                    {task.post_type === 'facebook' && '📘'}
                    {task.post_type === 'instagram' && '📷'}
                    {task.post_type === 'email' && '📧'}
                    {task.post_type === 'newsletter' && '📰'}
                    {task.post_type === 'video' && '🎥'}
                    {(!task.post_type || !['facebook', 'instagram', 'email', 'newsletter', 'video'].includes(task.post_type)) && '📝'}
                  </div>
                  <span className="text-xs font-medium text-gray-700 capitalize truncate">
                    {task.post_type}
                  </span>
                </div>
                
                <Badge 
                  className={cn(
                    "text-xs px-1.5 py-0.5 border-0 shrink-0",
                    task.status === 'posted' && "bg-green-100 text-green-700",
                    task.status === 'scheduled' && "bg-blue-100 text-blue-700",
                    task.status === 'published' && "bg-purple-100 text-purple-700",
                    !['posted', 'scheduled', 'published'].includes(task.status) && "bg-gray-100 text-gray-600"
                  )}
                >
                  {task.status === 'posted' ? 'Ready' : 
                   task.status === 'scheduled' ? 'Scheduled' :
                   task.status === 'published' ? 'Published' : 
                   task.status}
                </Badge>
              </div>
              
              {task.campaigns && (
                <p className="text-xs text-gray-600 truncate mt-1">
                  {task.campaigns.title}
                </p>
              )}
            </div>
          ))}
        </div>
        
        {/* Show more indicator - Cleaner design */}
        {(campaigns.length + tasks.length) > 3 && (
          <div className="text-xs text-gray-500 text-center py-1.5 bg-gray-50 rounded-md border border-gray-100 hover:bg-gray-100 transition-colors cursor-pointer">
            +{(campaigns.length + tasks.length) - 3} more
          </div>
        )}
      </div>
    </EnhancedDropZone>
  );
};
