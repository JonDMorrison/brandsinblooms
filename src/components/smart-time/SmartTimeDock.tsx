
import React, { useState, useEffect, useRef } from 'react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { CollapsedBar } from './CollapsedBar';
import { ExpandedRibbon } from './ExpandedRibbon';
import { ScheduledContentModal } from '@/components/new-dashboard/ScheduledContentModal';
import { scheduleDraft } from '@/lib/dashboardAPI';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import './smart-time.css';

interface SmartTimeDockProps {
  scheduledByDate?: Record<string, any[]>;
  socialConnections?: any[];
  onScheduleUpdate?: () => void;
  onDragEnd?: (result: any) => void;
}

export const SmartTimeDock = ({ 
  scheduledByDate = {}, 
  socialConnections = [],
  onScheduleUpdate,
  onDragEnd
}: SmartTimeDockProps) => {
  const [open, setOpen] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const queryClient = useQueryClient();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d')}`;

  // Generate best times from scheduled content
  const getBestTimes = () => {
    const times: string[] = [];
    Object.entries(scheduledByDate).forEach(([date, tasks]) => {
      tasks.forEach(task => {
        if (task.scheduledMeta?.publish_at) {
          const publishDate = new Date(task.scheduledMeta.publish_at);
          const dayName = format(publishDate, 'EEE');
          const timeStr = format(publishDate, 'h:mm a');
          times.push(`${dayName} ${timeStr}`);
        }
      });
    });
    return times.slice(0, 2);
  };

  // Auto-expand on drag start
  useEffect(() => {
    if (isDragging && !open) {
      setOpen(true);
    }
  }, [isDragging, open]);

  // Listen for drag events on the document
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      // Check if the dragged element is from draft tray (has data-draft-card attribute)
      const target = e.target as HTMLElement;
      if (target?.closest('[data-draft-card]') || target?.hasAttribute('data-draft-card')) {
        console.log('🎯 Draft card drag detected, expanding dock');
        setIsDragging(true);
      }
    };

    const handleDragEnd = () => {
      console.log('🎯 Drag ended, resetting state');
      setIsDragging(false);
    };

    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('dragend', handleDragEnd);

    return () => {
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('dragend', handleDragEnd);
    };
  }, []);

  const handleTaskClick = (task: any) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTask(null);
  };

  const handleModalUpdate = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
    if (onScheduleUpdate) onScheduleUpdate();
  };

  // Handle drag and drop with mode-aware logic
  const handleDragEnd = async (result: any) => {
    console.log('🎯 SmartTimeDock handleDragEnd called:', result);
    
    if (!result.destination) {
      console.log('🎯 No destination, cancelling drop');
      return;
    }
    
    const { draggableId, destination } = result;
    
    const dateMatch = destination.droppableId.match(/day-(.+)/);
    if (!dateMatch) {
      console.log('🎯 Invalid droppable ID format:', destination.droppableId);
      return;
    }
    
    const targetDate = dateMatch[1];
    const publishAt = new Date(`${targetDate}T14:00:00`).toISOString();
    const platform = 'FACEBOOK';
    
    console.log('🎯 Attempting to schedule:', { draggableId, targetDate, publishAt, platform });
    
    try {
      const scheduledResult = await scheduleDraft({
        taskId: draggableId,
        publishAt,
        platform
      });
      
      if (scheduledResult) {
        console.log('✅ Successfully scheduled:', scheduledResult);
        
        // Optimistically update the cache
        queryClient.setQueryData(['dashboard-data'], (oldData: any) => {
          if (!oldData) return oldData;
          
          const updatedTasks = oldData.tasks.map((task: any) => 
            task.id === draggableId 
              ? { ...task, status: 'scheduled', scheduled_date: publishAt }
              : task
          );
          
          const updatedDrafts = oldData.drafts.filter((task: any) => task.id !== draggableId);
          const updatedScheduledTasks = [...oldData.scheduledTasks, scheduledResult.updatedTask];
          
          const updatedScheduledByDate = { ...oldData.scheduledByDate };
          const dateKey = format(new Date(publishAt), 'yyyy-MM-dd');
          if (!updatedScheduledByDate[dateKey]) {
            updatedScheduledByDate[dateKey] = [];
          }
          updatedScheduledByDate[dateKey].push({
            ...scheduledResult.updatedTask,
            scheduledMeta: {
              platform: scheduledResult.scheduledPost.platform,
              publish_at: scheduledResult.scheduledPost.publish_at,
              status: scheduledResult.scheduledPost.status,
              mode: scheduledResult.mode
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
        
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-data'] });
        }, 1000);
        
        if (onScheduleUpdate) onScheduleUpdate();
        
        toast.success(`Scheduled for ${format(new Date(publishAt), 'MMM d, yyyy')} at ${format(new Date(publishAt), 'h:mm a')}`);
      }
    } catch (error) {
      console.error('❌ Failed to schedule:', error);
      toast.error('Failed to schedule post');
    }
    
    if (onDragEnd) onDragEnd(result);
  };

  return (
    <>
      <div className="smartDockTransition">
        {/* Ghost outline during drag when collapsed */}
        {isDragging && !open && (
          <div className="smartDockGhost" />
        )}
        
        {!open && (
          <CollapsedBar
            weekLabel={weekLabel}
            bestTimes={getBestTimes()}
            onExpand={() => setOpen(true)}
            onPrevWeek={() => setCurrentWeek(addWeeks(currentWeek, -1))}
            onNextWeek={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          />
        )}
        
        {open && (
          <ExpandedRibbon
            week={currentWeek}
            scheduledByDate={scheduledByDate}
            socialConnections={socialConnections}
            onPage={setCurrentWeek}
            onClose={() => setOpen(false)}
            onTaskClick={handleTaskClick}
            onDragEnd={handleDragEnd}
          />
        )}
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
