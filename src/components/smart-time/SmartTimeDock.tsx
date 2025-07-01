import React, { useState, useEffect, useRef } from 'react';
import { format, addWeeks, startOfWeek, addDays } from 'date-fns';
import { CollapsedBar } from './CollapsedBar';
import { ExpandedRibbon } from './ExpandedRibbon';
import { ScheduledContentModal } from '@/components/new-dashboard/ScheduledContentModal';
import { useQueryClient } from '@tanstack/react-query';
import { useDashboardContext } from '@/contexts/DashboardContext';
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
  const { isDockOpen, openDock, closeDock, toggleDock, isDragging, startDragging, stopDragging } = useDashboardContext();
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  
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

  // Keep dock open whenever dragging is active and ensure it opens
  useEffect(() => {
    if (isDragging) {
      console.log('🎯 SmartTimeDock: Dragging detected, ensuring dock is open');
      if (!isDockOpen) {
        console.log('🎯 SmartTimeDock: Opening dock for drag operation');
        openDock();
      }
    } else {
      console.log('🎯 SmartTimeDock: Drag ended, clearing drag over state');
      setDragOverDay(null);
    }
  }, [isDragging, isDockOpen, openDock]);

  // Add keyboard escape functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDockOpen && !isDragging) {
        closeDock();
      }
    };

    if (isDockOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isDockOpen, closeDock, isDragging]);

  // Close dock when clicking outside, but only if not dragging
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDragging) {
        console.log('🎯 SmartTimeDock: Ignoring click outside - drag in progress');
        return;
      }
      
      const target = e.target as HTMLElement;
      const dockElement = document.querySelector('.smart-dock-container');
      
      if (isDockOpen && dockElement && !dockElement.contains(target)) {
        console.log('🎯 SmartTimeDock: Clicking outside dock, closing');
        closeDock();
      }
    };

    if (isDockOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDockOpen, closeDock, isDragging]);

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

  /** Explicit toggle click */
  const handleToggle = () => {
    if (isDragging) {
      console.log('🎯 SmartTimeDock: Ignoring toggle during drag');
      return;
    }
    console.log('🎯 SmartTimeDock: Toggle clicked', { isDockOpen });
    isDockOpen ? closeDock() : openDock();
  };

  const handleCollapsedBarClick = () => {
    if (!isDockOpen && !isDragging) {
      console.log('🎯 SmartTimeDock: Collapsed bar clicked, opening dock');
      handleToggle();
    }
  };

  // Handle drag over for day drop zones
  const handleDayDragOver = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverDay !== dayKey) {
      console.log('🎯 SmartTimeDock: Drag over day', dayKey);
      setDragOverDay(dayKey);
    }
  };

  const handleDayDragLeave = (e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    // Only clear if we're actually leaving this day zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      if (dragOverDay === dayKey) {
        console.log('🎯 SmartTimeDock: Drag leave day', dayKey);
        setDragOverDay(null);
      }
    }
  };

  return (
    <>
      <div 
        className={cn(
          "smart-dock-container fixed bottom-0 left-0 right-0 z-50",
          "bg-white shadow-xl border-t border-gray-200",
          "transition-all duration-300 ease-in-out",
          isDockOpen ? "h-80 max-h-80" : "h-14"
        )}
        style={{
          maxHeight: isDockOpen ? '320px' : '56px',
          height: isDockOpen ? '320px' : '56px'
        }}
        aria-expanded={isDockOpen}
      >
        {/* Enhanced ghost outline during drag when collapsed */}
        {isDragging && !isDockOpen && (
          <div className="absolute inset-x-0 -top-80 h-80 bg-white/60 border-2 border-dashed border-[#68BEB9]/70 rounded-t-xl pointer-events-none opacity-50 animate-pulse">
            <div className="flex items-center justify-center h-full">
              <div className="text-[#68BEB9] font-medium text-lg">
                Drop here to schedule
              </div>
            </div>
          </div>
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
          <div className="h-full max-h-full overflow-hidden flex flex-col">
            <ExpandedRibbon
              week={currentWeek}
              scheduledByDate={scheduledByDate}
              socialConnections={socialConnections}
              onPage={setCurrentWeek}
              onClose={closeDock}
              onTaskClick={handleTaskClick}
              dragOverDay={dragOverDay}
              onDayDragOver={handleDayDragOver}
              onDayDragLeave={handleDayDragLeave}
            />
          </div>
        )}

        {/* Global drag feedback overlay */}
        {isDragging && (
          <div className="fixed inset-0 bg-blue-50/20 pointer-events-none z-40">
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-white/90 backdrop-blur-sm rounded-lg px-6 py-3 shadow-lg border border-[#68BEB9]/30">
                <div className="text-[#68BEB9] font-medium">
                  Drop on a day to schedule
                </div>
              </div>
            </div>
          </div>
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
