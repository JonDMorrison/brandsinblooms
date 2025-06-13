
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Calendar, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onCreateCampaign?: (date: Date) => void;
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  weekNumber?: number;
  isDragging?: boolean;
  draggedTask?: Task | null;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
  onDrop?: (date: Date) => void;
}

export const CalendarDayCell = ({
  date,
  campaigns,
  tasks = [],
  isCurrentMonth,
  isToday,
  onCampaignClick,
  onCreateCampaign,
  selectionMode = false,
  selectedCampaigns = [],
  weekNumber,
  isDragging = false,
  draggedTask,
  onDragStart,
  onDragEnd,
  onDrop
}: CalendarDayCellProps) => {
  const dayNumber = format(date, 'd');
  const isWeekend = date.getDay() === 0 || date.getDay() === 6;
  const isPastDate = date < new Date(new Date().setHours(0, 0, 0, 0));

  const isCampaignSelected = (campaign: Campaign) => {
    return selectedCampaigns.some(c => c.id === campaign.id);
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'email': return '📧';
      case 'newsletter': return '📰';
      case 'video': return '🎥';
      default: return '📝';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (onDrop && !isPastDate) {
      onDrop(date);
    }
  };

  const isValidDropTarget = isDragging && !isPastDate && isCurrentMonth;
  const isDraggedTaskInThisCell = draggedTask && tasks.some(task => task.id === draggedTask.id);

  return (
    <div
      className={cn(
        "group min-h-[140px] p-3 border transition-all duration-200 relative overflow-hidden",
        !isCurrentMonth && "text-gray-400 bg-gray-50/50",
        isCurrentMonth && "bg-white hover:bg-blue-50/30 border-gray-200",
        isToday && "bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-md",
        isWeekend && isCurrentMonth && "bg-gray-50/80",
        selectionMode && "cursor-pointer",
        isValidDropTarget && "bg-green-50 border-green-300 border-2 border-dashed",
        isPastDate && "opacity-60"
      )}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
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
      
      {/* Drop zone indicator */}
      {isValidDropTarget && (
        <div className="absolute inset-2 border-2 border-green-400 border-dashed rounded-lg bg-green-50/50 flex items-center justify-center text-green-700 text-xs font-medium">
          Drop here to reschedule
        </div>
      )}
      
      {/* Content container */}
      <div className="space-y-2">
        {/* Campaigns */}
        {campaigns.slice(0, 2).map((campaign, index) => {
          const isSelected = isCampaignSelected(campaign);
          
          return (
            <div
              key={campaign.id}
              className={cn(
                "relative text-xs p-2 rounded-lg cursor-pointer transition-all duration-200 group/campaign",
                selectionMode && isSelected 
                  ? "bg-blue-200 border-2 border-blue-400 shadow-sm transform scale-[0.98]" 
                  : "bg-gradient-to-r from-emerald-100 to-green-100 border border-emerald-200 hover:from-emerald-200 hover:to-green-200 hover:shadow-sm hover:scale-[1.02]",
                !selectionMode && "hover:shadow-md"
              )}
              onClick={() => onCampaignClick?.(campaign)}
            >
              {selectionMode && isSelected && (
                <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                  <Check className="w-3 h-3" />
                </div>
              )}
              
              <div className="flex items-start gap-2">
                <Calendar className="w-3 h-3 text-emerald-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
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
              </div>
              
              {/* Hover overlay for better interactivity */}
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover/campaign:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
            </div>
          );
        })}

        {/* Approved Content Tasks */}
        {tasks.slice(0, campaigns.length > 0 ? 2 : 3).map((task, index) => (
          <div
            key={task.id}
            draggable={!selectionMode && !isPastDate}
            onDragStart={(e) => {
              if (onDragStart && !selectionMode && !isPastDate) {
                onDragStart(task);
              }
            }}
            onDragEnd={onDragEnd}
            className={cn(
              "relative text-xs p-2 rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:from-green-100 hover:to-emerald-100 transition-all duration-200 group/task",
              !selectionMode && !isPastDate && "cursor-move hover:shadow-md",
              isDraggedTaskInThisCell && "opacity-50",
              isPastDate && "cursor-not-allowed"
            )}
          >
            <div className="flex items-start gap-2">
              <div className="flex items-center gap-1">
                {!selectionMode && !isPastDate && (
                  <GripVertical className="w-3 h-3 text-gray-400 opacity-0 group-hover/task:opacity-100 transition-opacity" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 mb-1">
                  <span>{getPostTypeIcon(task.post_type)}</span>
                  <span className="font-semibold text-green-800 capitalize">
                    {task.post_type}
                  </span>
                </div>
                <Badge className="bg-green-100 text-green-700 border-green-300 text-xs px-1 py-0.5">
                  Approved
                </Badge>
                {task.campaigns && (
                  <div className="text-green-700 truncate mt-1 leading-tight">
                    {task.campaigns.title}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Show more indicator */}
        {(campaigns.length + tasks.length) > 3 && (
          <div className="text-xs text-gray-500 text-center py-1 bg-gray-50 rounded-md border border-gray-200">
            +{(campaigns.length + tasks.length) - 3} more item{(campaigns.length + tasks.length) - 3 !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
};
