import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { useDashboardContext } from '@/context/DashboardContext';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { useSmartTime } from '@/hooks/useSmartTime';
import { usePublishFlow } from '@/hooks/usePublishFlow';
import { useRealtimePublishUpdates } from '@/hooks/useRealtimePublishUpdates';
import { TimePopover } from './TimePopover';
import { ScheduledContentPill } from './ScheduledContentPill';
import { PublishStatusPill } from '../publish/PublishStatusPill';

export const SmartTimeRibbon = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showTimePopover, setShowTimePopover] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [targetDate, setTargetDate] = useState<Date>(new Date());

  const { scheduleDraft, setActiveDraft } = useDashboardContext();
  const { scheduledPosts, schedulePost, reschedulePost, unschedulePost, deleteScheduledPost, refreshScheduledPosts } = useScheduledPosts();
  const { getBestTimesForPlatform } = useSmartTime();
  const { approveDraft, scheduleDraft: scheduleApprovedContent } = usePublishFlow();
  
  // Listen for real-time publish updates
  useRealtimePublishUpdates((update) => {
    refreshScheduledPosts();
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

  const handleDrop = async (dayKey: string, taskId: string) => {
    const dateStr = dayKey.replace('calendar-day-', '');
    const dropDate = new Date(dateStr + 'T12:00:00');
    
    setDraggedTaskId(taskId);
    setTargetDate(dropDate);
    setShowTimePopover(true);
  };

  const handleSchedule = async (date: Date, time: 'now' | 'best' | string) => {
    if (!draggedTaskId) return;

    let scheduledDate = date;
    
    if (time === 'best') {
      const bestTimes = getBestTimesForPlatform('facebook');
      const [hours, minutes] = bestTimes[0].split(':').map(Number);
      scheduledDate = new Date(date);
      scheduledDate.setHours(hours, minutes, 0, 0);
    } else if (time !== 'now' && typeof time === 'string') {
      const [hours, minutes] = time.split(':').map(Number);
      scheduledDate = new Date(date);
      scheduledDate.setHours(hours, minutes, 0, 0);
    }

    // First approve the draft to create generated content
    const contentId = await approveDraft(draggedTaskId);
    if (contentId) {
      // Then schedule the approved content
      await scheduleApprovedContent(contentId, scheduledDate, 'facebook');
    }
    
    setDraggedTaskId(null);
    setShowTimePopover(false);
  };

  const handleEditScheduledPost = (scheduledPost: any) => {
    // Convert scheduled post back to draft format for editing
    const draftData = {
      id: scheduledPost.content_id,
      ai_output: scheduledPost.content?.caption || '',
      post_type: scheduledPost.platform,
      status: 'scheduled' as const,
      scheduled_date: format(new Date(scheduledPost.publish_at), 'yyyy-MM-dd'),
      created_at: new Date().toISOString(), // Add required created_at field
      _scheduledPostId: scheduledPost.id // Keep reference for updates
    };
    
    setActiveDraft(draftData);
  };

  const handleReschedulePost = (scheduledId: string) => {
    // For now, just show a toast - full reschedule UI can be added later
    console.log('Reschedule post:', scheduledId);
  };

  return (
    <>
      <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 border border-white/20">
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
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const scheduledForDay = getScheduledPostsForDay(day);
            
            return (
              <Droppable key={dayKey} droppableId={`calendar-day-${dayKey}`}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "min-h-[120px] p-3 rounded-lg border-2 border-dashed transition-all duration-200",
                      snapshot.isDraggingOver 
                        ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-md" 
                        : "border-gray-200 bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5 hover:border-[#68BEB9]/50"
                    )}
                  >
                    <div className="text-center mb-3">
                      <div className="text-xs font-medium text-[#3E5A6B] mb-1">
                        {getDayName(day)}
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {getDayNumber(day)}
                      </div>
                    </div>

                    {/* Scheduled Posts with Enhanced Status Pills */}
                    <div className="space-y-2">
                      {scheduledForDay.map((scheduledPost) => (
                        <PublishStatusPill
                          key={scheduledPost.id}
                          status={scheduledPost.status as any}
                          platform={scheduledPost.platform}
                          publishTime={scheduledPost.publish_at}
                          error={scheduledPost.error_message}
                        />
                      ))}
                    </div>

                    {/* Drop zone indicator */}
                    {snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-8 text-sm text-[#68BEB9] font-medium mt-2">
                        Drop to schedule
                      </div>
                    )}

                    {/* Empty state */}
                    {!snapshot.isDraggingOver && scheduledForDay.length === 0 && (
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
            <span className="font-medium">Tip:</span> Drag drafts from the tray to schedule them for specific days.
          </p>
        </div>
      </div>

      <TimePopover
        isOpen={showTimePopover}
        onClose={() => setShowTimePopover(false)}
        onSchedule={handleSchedule}
        targetDate={targetDate}
        bestTimes={getBestTimesForPlatform('facebook')}
      />
    </>
  );
};
