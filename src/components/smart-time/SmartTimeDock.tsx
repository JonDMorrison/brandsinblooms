
import React, { useState, useEffect } from 'react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { CollapsedBar } from './CollapsedBar';
import { ExpandedRibbon } from './ExpandedRibbon';
import { ScheduledContentModal } from '@/components/new-dashboard/ScheduledContentModal';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboard } from '@/contexts/DashboardContext';
import { cn } from '@/lib/utils';
import './smart-time.css';

interface SmartTimeDockProps {
  scheduledByDate?: Record<string, any[]>;
  socialConnections?: any[];
  onScheduleUpdate?: () => void;
}

export const SmartTimeDock = ({ 
  scheduledByDate = {}, 
  socialConnections = [],
  onScheduleUpdate
}: SmartTimeDockProps) => {
  const { isDockOpen, openDock, closeDock, toggleDock } = useDashboard();
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
    if (isDragging && !isDockOpen) {
      openDock();
    }
  }, [isDragging, isDockOpen, openDock]);

  // Listen for drag events on the document
  useEffect(() => {
    const handleDragStart = (e: DragEvent) => {
      // Check if the dragged element is from draft tray (has data-draft-card attribute)
      const target = e.target as HTMLElement;
      if (target?.closest('[data-draft-card]') || target?.hasAttribute('data-draft-card')) {
        console.log('🎯 Draft card drag detected, expanding dock');
        setIsDragging(true);
        openDock();
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
  }, [openDock]);

  // Close dock when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const dockElement = document.querySelector('.smart-dock-container');
      
      if (isDockOpen && dockElement && !dockElement.contains(target)) {
        closeDock();
      }
    };

    if (isDockOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDockOpen, closeDock]);

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

  const handleCollapsedBarClick = () => {
    if (!isDockOpen) {
      toggleDock();
    }
  };

  return (
    <>
      <div 
        className={cn(
          "smart-dock-container fixed bottom-0 left-0 right-0 z-30 bg-white shadow-xl transition-all duration-300 ease-in-out",
          isDockOpen ? "h-56" : "h-14"
        )}
        aria-expanded={isDockOpen}
      >
        {/* Ghost outline during drag when collapsed */}
        {isDragging && !isDockOpen && (
          <div className="smartDockGhost" />
        )}
        
        {!isDockOpen && (
          <div
            className="cursor-pointer h-full"
            onClick={handleCollapsedBarClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCollapsedBarClick();
              }
            }}
            aria-label="Expand smart time dock"
          >
            <CollapsedBar
              weekLabel={weekLabel}
              bestTimes={getBestTimes()}
              onExpand={() => {}} // Handled by parent click
              onPrevWeek={() => setCurrentWeek(addWeeks(currentWeek, -1))}
              onNextWeek={() => setCurrentWeek(addWeeks(currentWeek, 1))}
            />
          </div>
        )}
        
        {isDockOpen && (
          <ExpandedRibbon
            week={currentWeek}
            scheduledByDate={scheduledByDate}
            socialConnections={socialConnections}
            onPage={setCurrentWeek}
            onClose={closeDock}
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
