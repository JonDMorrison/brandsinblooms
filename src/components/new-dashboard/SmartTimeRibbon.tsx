
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { useSmartTime } from '@/hooks/useSmartTime';
import { usePublishFlow } from '@/hooks/usePublishFlow';
import { useRealtimePublishUpdates } from '@/hooks/useRealtimePublishUpdates';
import { PublishStatusPill } from '@/components/publish/PublishStatusPill';

interface SmartTimeRibbonProps {
  tasks?: any[];
  onScheduleUpdate?: () => void;
}

export const SmartTimeRibbon = ({ tasks = [], onScheduleUpdate }: SmartTimeRibbonProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const { scheduledPosts, deleteScheduledPost, refreshScheduledPosts } = useScheduledPosts();
  
  // Listen for real-time publish updates
  useRealtimePublishUpdates((update) => {
    refreshScheduledPosts();
    if (onScheduleUpdate) onScheduleUpdate();
  });

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Monday
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

  const handleDeletePost = async (scheduledId: string) => {
    await deleteScheduledPost(scheduledId);
    if (onScheduleUpdate) onScheduleUpdate();
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg shadow-2xl border-t border-white/20 p-4">
      <div className="max-w-full mx-auto">
        <div className="flex items-center justify-between mb-4">
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

        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const scheduledForDay = getScheduledPostsForDay(day);
            
            return (
              <Droppable key={dayKey} droppableId={`day-${dayKey}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-[100px] p-3 rounded-lg border-2 border-dashed transition-all duration-200",
                      snapshot.isDraggingOver 
                        ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-md" 
                        : "border-gray-200 bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5 hover:border-[#68BEB9]/50"
                    )}
                  >
                    <div className="text-center mb-2">
                      <div className="text-xs font-medium text-[#3E5A6B] mb-1">
                        {getDayName(day)}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {getDayNumber(day)}
                      </div>
                    </div>

                    {/* Scheduled Posts with Enhanced Status Pills */}
                    <div className="space-y-1">
                      {scheduledForDay.map((scheduledPost) => (
                        <div key={scheduledPost.id} className="group relative">
                          <PublishStatusPill
                            status={scheduledPost.status as any}
                            platform={scheduledPost.platform}
                            publishTime={scheduledPost.publish_at}
                            error={scheduledPost.error_message}
                          />
                          
                          {/* Quick Action Menu */}
                          <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePost(scheduledPost.id)}
                              className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Drop zone indicator */}
                    {snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-6 text-xs text-[#68BEB9] font-medium mt-1">
                        Drop to schedule
                      </div>
                    )}

                    {/* Empty state */}
                    {!snapshot.isDraggingOver && scheduledForDay.length === 0 && (
                      <div className="flex items-center justify-center h-6 mt-1">
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

        <div className="mt-3 p-2 bg-[#68BEB9]/5 rounded-lg border border-[#68BEB9]/20">
          <p className="text-xs text-[#3E5A6B]">
            <span className="font-medium">Tip:</span> Drag drafts from the tray to schedule them for specific days.
          </p>
        </div>
      </div>
    </div>
  );
};
