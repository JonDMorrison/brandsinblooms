import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addWeeks, startOfWeek, addDays, isSameDay } from 'date-fns';
import { Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { ScheduledContentModal } from './ScheduledContentModal';
import { ScheduledContentPill } from './ScheduledContentPill';
import { scheduleDraft } from '@/lib/dashboardAPI';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

interface SmartTimeRibbonProps {
  scheduledByDate?: Record<string, any[]>;
  socialConnections?: any[];
  onScheduleUpdate?: () => void;
  onDragEnd?: (result: any) => void;
}

export const SmartTimeRibbon = ({ 
  scheduledByDate = {}, 
  socialConnections = [],
  onScheduleUpdate,
  onDragEnd
}: SmartTimeRibbonProps) => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const { scheduledPosts, loading } = useScheduledPosts();
  const queryClient = useQueryClient();

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

  // Get scheduled content tasks for a specific day from the new data structure
  const getScheduledTasksForDay = (day: Date) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return scheduledByDate[dateKey] || [];
  };

  const handleTaskClick = (task: any) => {
    console.log('🖱️ Clicked scheduled task:', task);
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleModalUpdate = () => {
    console.log('📝 Content updated, refreshing data...');
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    if (onScheduleUpdate) onScheduleUpdate();
  };

  // Handle drag and drop
  const handleDragEnd = async (result: any) => {
    console.log('🎯 Drag ended:', result);
    
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    
    // Extract date from droppable ID: "day-YYYY-MM-DD"
    const dateMatch = destination.droppableId.match(/day-(.+)/);
    if (!dateMatch) return;
    
    const targetDate = dateMatch[1];
    const publishAt = new Date(`${targetDate}T14:00:00`).toISOString(); // Default to 2 PM
    
    console.log('📅 Scheduling for date:', targetDate, 'at:', publishAt);
    
    // Determine platform - for now default to Facebook, but this should come from the task or user selection
    const platform = 'FACEBOOK'; // TODO: Get from task.post_type or let user choose
    
    try {
      const result = await scheduleDraft({
        taskId: draggableId,
        publishAt,
        platform
      });
      
      if (result) {
        console.log('✅ Successfully scheduled:', result);
        
        // Optimistically update the cache
        queryClient.setQueryData(['dashboard-data'], (oldData: any) => {
          if (!oldData) return oldData;
          
          // Move task from drafts to scheduled
          const updatedTasks = oldData.tasks.map((task: any) => 
            task.id === draggableId 
              ? { ...task, status: 'scheduled', scheduled_date: publishAt }
              : task
          );
          
          const updatedDrafts = oldData.drafts.filter((task: any) => task.id !== draggableId);
          const updatedScheduledTasks = [...oldData.scheduledTasks, result.updatedTask];
          
          // Update scheduledByDate
          const updatedScheduledByDate = { ...oldData.scheduledByDate };
          const dateKey = format(new Date(publishAt), 'yyyy-MM-dd');
          if (!updatedScheduledByDate[dateKey]) {
            updatedScheduledByDate[dateKey] = [];
          }
          updatedScheduledByDate[dateKey].push({
            ...result.updatedTask,
            scheduledMeta: {
              platform: result.scheduledPost.platform,
              publish_at: result.scheduledPost.publish_at,
              status: result.scheduledPost.status
            }
          });
          
          return {
            ...oldData,
            tasks: updatedTasks,
            drafts: updatedDrafts,
            scheduledTasks: updatedScheduledTasks,
            scheduledByDate: updatedScheduledByDate
          };
        });
        
        // Also trigger a background refetch to ensure consistency
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
        }, 1000);
        
        if (onScheduleUpdate) onScheduleUpdate();
      }
    } catch (error) {
      console.error('❌ Failed to schedule:', error);
      toast.error('Failed to schedule post');
    }
    
    if (onDragEnd) onDragEnd(result);
  };

  const hasConnections = socialConnections.length > 0;

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
    <>
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

          {!hasConnections && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800 text-center">
                <span className="font-medium">No social connections:</span> Connect your social accounts to schedule posts
              </p>
            </div>
          )}

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
                        snapshot.isDraggingOver && hasConnections
                          ? "border-[#68BEB9] bg-[#68BEB9]/10 shadow-md" 
                          : hasConnections
                          ? "border-gray-200 bg-gradient-to-br from-[#F9FAFB] to-[#68BEB9]/5 hover:border-[#68BEB9]/50"
                          : "border-red-200 bg-red-50/30",
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

                      {/* Scheduled Content Tasks using new pill component */}
                      <div className="space-y-2">
                        {scheduledTasksForDay.map((scheduledTaskData) => (
                          <ScheduledContentPill
                            key={`task-${scheduledTaskData.id}`}
                            task={scheduledTaskData}
                            scheduledMeta={scheduledTaskData.scheduledMeta}
                            onClick={() => handleTaskClick(scheduledTaskData)}
                          />
                        ))}

                        {/* Legacy Scheduled Posts from Supabase (keeping for compatibility) */}
                        {scheduledPostsForDay.map((scheduledPost) => (
                          <ScheduledContentPill
                            key={`post-${scheduledPost.id}`}
                            task={{
                              id: scheduledPost.id,
                              post_type: scheduledPost.platform?.toLowerCase(),
                              scheduled_date: scheduledPost.publish_at
                            }}
                            scheduledMeta={{
                              platform: scheduledPost.platform,
                              publish_at: scheduledPost.publish_at,
                              status: scheduledPost.status
                            }}
                            onClick={() => {
                              console.log('Legacy scheduled post clicked:', scheduledPost);
                              // Handle legacy posts if needed
                            }}
                          />
                        ))}
                      </div>

                      {/* Drop zone indicator */}
                      {snapshot.isDraggingOver && hasConnections && (
                        <div className="flex items-center justify-center h-8 text-sm text-[#68BEB9] font-medium mt-2">
                          Drop to schedule
                        </div>
                      )}

                      {/* No connections warning when dragging */}
                      {snapshot.isDraggingOver && !hasConnections && (
                        <div className="flex items-center justify-center h-8 text-sm text-red-600 font-medium mt-2">
                          Connect social accounts first
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

      {/* Scheduled Content Edit Modal */}
      <ScheduledContentModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        scheduledTask={selectedTask}
        onUpdate={handleModalUpdate}
      />
    </>
  );
};
