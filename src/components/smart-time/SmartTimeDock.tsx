
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
  const [isStuck, setIsStuck] = useState(false);
  
  const queryClient = useQueryClient();
  const dockRef = useRef<HTMLDivElement>(null);
  const stuckTimeoutRef = useRef<NodeJS.Timeout>();

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

  // Monitor for stuck states and provide recovery
  useEffect(() => {
    if (isDragging) {
      console.log('🎯 SmartTimeDock: Monitoring drag state for stuck condition');
      
      // Set stuck detection timer
      stuckTimeoutRef.current = setTimeout(() => {
        console.log('🎯 SmartTimeDock: Drag state appears stuck, attempting recovery');
        setIsStuck(true);
        
        // Auto-recovery after showing stuck state
        setTimeout(() => {
          console.log('🎯 SmartTimeDock: Auto-recovering from stuck state');
          stopDragging();
          setDragOverDay(null);
          setIsStuck(false);
          closeDock();
        }, 5000);
      }, 15000); // 15 seconds
      
      // Ensure dock is open for drag operations
      if (!isDockOpen) {
        console.log('🎯 SmartTimeDock: Opening dock for drag operation');
        openDock();
      }
    } else {
      // Clear stuck detection when drag ends normally
      if (stuckTimeoutRef.current) {
        clearTimeout(stuckTimeoutRef.current);
        stuckTimeoutRef.current = undefined;
      }
      setIsStuck(false);
      setDragOverDay(null);
    }

    return () => {
      if (stuckTimeoutRef.current) {
        clearTimeout(stuckTimeoutRef.current);
      }
    };
  }, [isDragging, isDockOpen, openDock, stopDragging, closeDock]);

  // Add keyboard escape functionality
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isDragging || isStuck) {
          console.log('🎯 SmartTimeDock: Escape pressed, recovering from stuck state');
          stopDragging();
          setDragOverDay(null);
          setIsStuck(false);
        }
        if (isDockOpen && !isDragging) {
          closeDock();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDockOpen, closeDock, isDragging, isStuck, stopDragging]);

  // Close dock when clicking outside, but only if not dragging
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDragging || isStuck) {
        console.log('🎯 SmartTimeDock: Ignoring click outside - drag/stuck state active');
        return;
      }
      
      const target = e.target as HTMLElement;
      
      if (isDockOpen && dockRef.current && !dockRef.current.contains(target)) {
        console.log('🎯 SmartTimeDock: Clicking outside dock, closing');
        closeDock();
      }
    };

    if (isDockOpen) {
      // Delay to prevent immediate closing
      const timeout = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeout);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isDockOpen, closeDock, isDragging, isStuck]);

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

  const handleToggle = () => {
    if (isDragging || isStuck) {
      console.log('🎯 SmartTimeDock: Ignoring toggle during drag/stuck state');
      return;
    }
    console.log('🎯 SmartTimeDock: Toggle clicked', { isDockOpen });
    isDockOpen ? closeDock() : openDock();
  };

  const handleCollapsedBarClick = () => {
    if (!isDockOpen && !isDragging && !isStuck) {
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

  const handleStuckRecovery = () => {
    console.log('🎯 SmartTimeDock: Manual stuck recovery triggered');
    stopDragging();
    setDragOverDay(null);
    setIsStuck(false);
    closeDock();
  };

  return (
    <>
      <div 
        ref={dockRef}
        className={cn(
          "smart-dock-container fixed bottom-0 left-0 right-0 z-50",
          "bg-white shadow-xl border-t border-gray-200",
          "transition-all duration-300 ease-in-out",
          isDockOpen ? "h-80 max-h-80" : "h-14",
          isStuck && "border-red-300 bg-red-50"
        )}
        style={{
          maxHeight: isDockOpen ? '320px' : '56px',
          height: isDockOpen ? '320px' : '56px'
        }}
        aria-expanded={isDockOpen}
      >
        {/* Stuck State Recovery UI */}
        {isStuck && (
          <div className="absolute top-0 left-0 right-0 bg-red-100 border-b border-red-300 p-2 z-60">
            <div className="flex items-center justify-between">
              <span className="text-red-800 text-sm">Content card appears stuck. This sometimes happens during drag operations.</span>
              <button
                onClick={handleStuckRecovery}
                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
              >
                Fix It
              </button>
            </div>
          </div>
        )}

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
              onExpand={() => {}}
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
                  {isStuck ? 'Card appears stuck - press Escape or click Fix It' : 'Drop on a day to schedule'}
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
