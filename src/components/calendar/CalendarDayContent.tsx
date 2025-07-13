
import { CalendarCampaignList } from "./CalendarCampaignList";
import { EnhancedCalendarTaskItem } from "./EnhancedCalendarTaskItem";

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

interface CalendarDayContentProps {
  campaigns: Campaign[];
  tasks: Task[];
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  isPastDate: boolean;
  draggedTask?: Task;
  onCampaignClick?: (campaign: Campaign) => void;
  onTaskClick?: (task: Task) => void;
  onTaskLongPress?: (task: Task) => void;
  isTaskSelected?: (task: Task) => boolean;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
}

export const CalendarDayContent = ({
  campaigns,
  tasks,
  selectionMode = true,
  selectedCampaigns = [],
  isPastDate,
  draggedTask,
  onCampaignClick,
  onTaskClick,
  onTaskLongPress,
  isTaskSelected,
  onDragStart,
  onDragEnd,
}: CalendarDayContentProps) => {
  // Calculate how many items we can show based on available space
  const maxCampaignsToShow = 2;
  const maxTasksToShow = campaigns.length > 0 ? 2 : 3;
  
  const totalItemsShown = Math.min(campaigns.length, maxCampaignsToShow) + Math.min(tasks.length, maxTasksToShow);
  const totalItems = campaigns.length + tasks.length;
  const hasMoreItems = totalItems > totalItemsShown;

  

  return (
    <div className="space-y-1.5">
      {/* Campaigns - only show those that start on this date */}
      {campaigns.length > 0 && (
        <CalendarCampaignList
          campaigns={campaigns}
          selectionMode={selectionMode}
          selectedCampaigns={selectedCampaigns}
          onCampaignClick={onCampaignClick}
        />
      )}

      {/* Tasks */}
      {tasks.length > 0 && (
        <div className="space-y-1">
          {tasks.slice(0, maxTasksToShow).map((task) => (
            <EnhancedCalendarTaskItem
              key={task.id}
              task={task}
              isSelected={isTaskSelected?.(task) || false}
              isPastDate={isPastDate}
              onTaskClick={onTaskClick || (() => {})}
              onLongPress={onTaskLongPress || (() => {})}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          ))}
        </div>
      )}
      
      {/* Show more indicator - only if there are actually more items */}
      {hasMoreItems && (
        <div className="text-xs text-gray-500 text-center py-1 bg-gray-50/50 rounded border border-gray-100">
          +{totalItems - totalItemsShown} more
        </div>
      )}
    </div>
  );
};
