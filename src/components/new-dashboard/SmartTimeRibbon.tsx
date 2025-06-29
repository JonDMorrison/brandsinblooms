
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';

interface SmartTimeRibbonProps {
  tasks?: any[];
  onScheduleUpdate?: () => void;
  onScheduledContentClick?: (task: any) => void;
}

export const SmartTimeRibbon = ({ tasks = [], onScheduleUpdate, onScheduledContentClick }: SmartTimeRibbonProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const { scheduledPosts, loading } = useScheduledPosts();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const nextWeek = () => setCurrentWeek(addWeeks(currentWeek, 1));
  const prevWeek = () => setCurrentWeek(addWeeks(currentWeek, -1));

  const getDayName = (date: Date) => format(date, 'EEE');
  const getDayNumber = (date: Date) => format(date, 'd');

  const getScheduledPostsForDay = (day: Date) => {
    return scheduledPosts.filter(post => 
      isSameDay(new Date(post.publish_at), day)
    );
  };

  // Get scheduled content tasks for a specific day
  const getScheduledTasksForDay = (day: Date) => {
    return tasks.filter(task => 
      task.status === 'scheduled' && 
      task.scheduled_date &&
      isSameDay(new Date(task.scheduled_date), day)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'QUEUED':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'PUBLISHED':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ERROR':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'scheduled':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'FB':
        return '📘';
      case 'IG_FEED':
      case 'IG_STORY':
      case 'IG_REEL':
        return '📷';
      case 'LINKEDIN':
        return '💼';
      case 'TWITTER':
        return '🐦';
      case 'facebook':
        return '📘';
      case 'instagram':
        return '📷';
      default:
        return '📱';
    }
  };

  if (loading) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-6">
        <div className="max-w-full mx-auto">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="grid grid-cols-7 gap-4">
              {[...Array(7)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-6 z-40">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-[#3E5A6B]">Smart-Time Ribbon</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={prevWeek}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-gray-600 min-w-[120px] text-center">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
            </span>
            <Button variant="ghost" size="sm" onClick={nextWeek}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-4">
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const scheduledPostsForDay = getScheduledPostsForDay(day);
            const scheduledTasksForDay = getScheduledTasksForDay(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <Droppable key={dayKey} droppableId={`day-${dayKey}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-[120px] p-3 rounded-lg border-2 border-dashed transition-all duration-200",
                      snapshot.isDraggingOver 
                        ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-md" 
                        : "border-gray-200 bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5 hover:border-[#68BEB9]/50",
                      isToday && "ring-2 ring-[#68BEB9]/30"
                    )}
                  >
                    <div className="text-center mb-3">
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isToday ? "text-[#68BEB9]" : "text-[#3E5A6B]"
                      )}>
                        {getDayName(day)}
                      </div>
                      <div className={cn(
                        "text-lg font-semibold",
                        isToday ? "text-[#68BEB9]" : "text-gray-900"
                      )}>
                        {getDayNumber(day)}
                      </div>
                    </div>

                    {/* Scheduled Content Tasks (clickable) */}
                    <div className="space-y-2">
                      {scheduledTasksForDay.map((scheduledTask) => (
                        <div
                          key={`task-${scheduledTask.id}`}
                          onClick={() => onScheduledContentClick?.(scheduledTask)}
                          className={cn(
                            "text-xs p-2 rounded border cursor-pointer hover:shadow-sm transition-all",
                            getStatusColor('scheduled')
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span>{getPlatformIcon(scheduledTask.post_type)}</span>
                            <span className="font-medium truncate">
                              {scheduledTask.post_type || 'Content'}
                            </span>
                          </div>
                          <div className="text-xs opacity-75 truncate">
                            {scheduledTask.ai_output?.substring(0, 30) || 'Scheduled content'}...
                          </div>
                        </div>
                      ))}

                      {/* Scheduled Posts */}
                      {scheduledPostsForDay.map((scheduledPost) => (
                        <div
                          key={`post-${scheduledPost.id}`}
                          className={cn(
                            "text-xs p-2 rounded border",
                            getStatusColor(scheduledPost.status)
                          )}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <span>{getPlatformIcon(scheduledPost.platform)}</span>
                            <span className="font-medium truncate">
                              {format(new Date(scheduledPost.publish_at), 'h:mm a')}
                            </span>
                          </div>
                          <div className="text-xs opacity-75 truncate">
                            {scheduledPost.status}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Drop zone indicator */}
                    {snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-8 text-sm text-[#68BEB9] font-medium mt-2">
                        Drop to schedule
                      </div>
                    )}

                    {/* Empty state */}
                    {!snapshot.isDraggingOver && scheduledPostsForDay.length === 0 && scheduledTasksForDay.length === 0 && (
                      <div className="flex items-center justify-center h-8 mt-2">
                        <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                      </div>
                    )}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-[#68BEB9]/5 rounded-lg border border-[#68BEB9]/20">
          <p className="text-sm text-[#3E5A6B]">
            <span className="font-medium">Tip:</span> Drag approved drafts from the tray to schedule them for specific days. Click on scheduled content to edit.
          </p>
        </div>
      </div>
    </div>
  );
};
