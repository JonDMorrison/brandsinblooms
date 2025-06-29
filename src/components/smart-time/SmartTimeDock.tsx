
import React, { useState, useEffect, useRef } from 'react';
import { useDragLayer } from 'react-beautiful-dnd';
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
  
  const queryClient = useQueryClient();
  const idleRef = useRef<NodeJS.Timeout>();

  // Get drag state - we'll need to add this to the drag context
  const isDragging = false; // TODO: Connect to drag layer when available

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

  // Auto-expand on drag
  useEffect(() => {
    if (isDragging && !open) {
      setOpen(true);
    }
  }, [isDragging, open]);

  // Auto-collapse after 6s idle
  useEffect(() => {
    if (!open) return;
    
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      if (!isDragging) {
        setOpen(false);
      }
    }, 6000);
    
    return () => clearTimeout(idleRef.current);
  }, [open, isDragging]);

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

  // Handle drag and drop
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;
    
    const { draggableId, destination } = result;
    
    const dateMatch = destination.droppableId.match(/day-(.+)/);
    if (!dateMatch) return;
    
    const targetDate = dateMatch[1];
    const publishAt = new Date(`${targetDate}T14:00:00`).toISOString();
    const platform = 'FACEBOOK';
    
    try {
      const result = await scheduleDraft({
        taskId: draggableId,
        publishAt,
        platform
      });
      
      if (result) {
        // Optimistically update the cache
        queryClient.setQueryData(['dashboard-data'], (oldData: any) => {
          if (!oldData) return oldData;
          
          const updatedTasks = oldData.tasks.map((task: any) => 
            task.id === draggableId 
              ? { ...task, status: 'scheduled', scheduled_date: publishAt }
              : task
          );
          
          const updatedDrafts = oldData.drafts.filter((task: any) => task.id !== draggableId);
          const updatedScheduledTasks = [...oldData.scheduledTasks, result.updatedTask];
          
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
