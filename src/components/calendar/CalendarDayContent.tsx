
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
  return (
    <div className="space-y-1.5">
      {/* Campaigns */}
      <CalendarCampaignList
        campaigns={campaigns}
        selectionMode={selectionMode}
        selectedCampaigns={selectedCampaigns}
        onCampaignClick={onCampaignClick}
      />

      {/* Tasks */}
      <div className="space-y-1">
        {tasks.slice(0, campaigns.length > 0 ? 2 : 3).map((task) => (
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
      
      {/* Show more indicator */}
      {(campaigns.length + tasks.length) > 3 && (
        <div className="text-xs text-gray-500 text-center py-1 bg-gray-50/50 rounded border border-gray-100">
          +{(campaigns.length + tasks.length) - 3} more
        </div>
      )}
    </div>
  );
};
