
import { CalendarCampaignList } from "./CalendarCampaignList";
import { EnhancedCalendarTaskItem } from "./EnhancedCalendarTaskItem";
import { NewsletterCalendarBlock } from "./NewsletterCalendarBlock";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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

interface CalendarDayContentProps {
  campaigns: Campaign[];
  tasks: Task[];
  newsletters?: Newsletter[];
  holidays?: any[];
  scheduledPosts?: any[];
  selectionMode?: boolean;
  selectedCampaigns?: Campaign[];
  isPastDate: boolean;
  draggedTask?: Task;
  onCampaignClick?: (campaign: Campaign) => void;
  onTaskClick?: (task: Task) => void;
  onTaskLongPress?: (task: Task) => void;
  onNewsletterClick?: (newsletter: Newsletter) => void;
  onHolidayClick?: (holiday: any) => void;
  isTaskSelected?: (task: Task) => boolean;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
}

export const CalendarDayContent = ({
  campaigns,
  tasks,
  newsletters = [],
  holidays = [],
  scheduledPosts = [],
  selectionMode = true,
  selectedCampaigns = [],
  isPastDate,
  draggedTask,
  onCampaignClick,
  onTaskClick,
  onTaskLongPress,
  onNewsletterClick,
  onHolidayClick,
  isTaskSelected,
  onDragStart,
  onDragEnd,
}: CalendarDayContentProps) => {
  const [isTasksExpanded, setIsTasksExpanded] = useState(false);
  
  // Calculate how many items we can show based on available space
  const maxCampaignsToShow = 1;
  const maxTasksToShow = isTasksExpanded ? tasks.length : 1;
  const maxNewslettersToShow = 2;
  
  const totalItemsShown = Math.min(campaigns.length, maxCampaignsToShow) + 
                          Math.min(tasks.length, maxTasksToShow) + 
                          Math.min(newsletters.length, maxNewslettersToShow) +
                          holidays.length + 
                          Math.min(scheduledPosts.length, 2);
  const totalItems = campaigns.length + tasks.length + newsletters.length + holidays.length + scheduledPosts.length;
  const hasMoreTasks = tasks.length > 1;

  return (
    <div className="space-y-1.5">
      {/* Holidays - display first and prominently */}
      {holidays.length > 0 && (
        <div className="space-y-1">
          {holidays.map((holiday) => (
            <button
              key={holiday.id}
              onClick={(e) => {
                e.stopPropagation();
                onHolidayClick?.(holiday);
              }}
              className="w-full text-left text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-md truncate border-l-2 border-amber-500 hover:bg-amber-200 transition-colors duration-200 cursor-pointer"
              title={`Click to view content for ${holiday.holiday_name}`}
            >
              🎉 {holiday.holiday_name}
            </button>
          ))}
        </div>
      )}

      {/* Scheduled Posts */}
      {scheduledPosts.length > 0 && (
        <div className="space-y-1">
          {scheduledPosts.slice(0, 2).map((post) => (
            <div
              key={post.id}
              className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-md truncate border-l-2 border-blue-500"
              title={`${post.platform || 'Post'} at ${post.publish_at ? new Date(post.publish_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}`}
            >
              📱 {post.platform || 'Post'} {post.publish_at ? new Date(post.publish_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </div>
          ))}
        </div>
      )}

      {/* Campaigns - only show those that start on this date */}
      {campaigns.length > 0 && (
        <CalendarCampaignList
          campaigns={campaigns}
          selectionMode={selectionMode}
          selectedCampaigns={selectedCampaigns}
          onCampaignClick={onCampaignClick}
        />
      )}

      {/* Newsletters */}
      {newsletters.length > 0 && (
        <div className="space-y-1">
          {newsletters.slice(0, maxNewslettersToShow).map((newsletter) => (
            <NewsletterCalendarBlock
              key={newsletter.id}
              newsletter={newsletter}
              onClick={onNewsletterClick || (() => {})}
              isCompact={true}
            />
          ))}
        </div>
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
              onDelete={() => {
                // Refresh the parent component after deletion
                window.location.reload(); // Simple solution to refresh calendar
              }}
            />
          ))}
          
          {/* Expand/Collapse button for tasks */}
          {hasMoreTasks && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsTasksExpanded(!isTasksExpanded);
              }}
              className="w-full text-xs text-slate-600 hover:text-slate-800 py-1 px-2 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors duration-200 flex items-center justify-center gap-1"
            >
              {isTasksExpanded ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  +{tasks.length - 1} more tasks
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
