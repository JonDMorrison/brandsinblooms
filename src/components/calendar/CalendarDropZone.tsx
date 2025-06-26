
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useState } from "react";

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

interface CalendarDropZoneProps {
  date: Date;
  isDragging?: boolean;
  draggedTask?: Task;
  onDrop?: (date: Date) => void;
  children: React.ReactNode;
}

export const CalendarDropZone = ({
  date,
  isDragging = false,
  draggedTask,
  onDrop,
  children,
}: CalendarDropZoneProps) => {
  const [isHoveredDrop, setIsHoveredDrop] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDragging && draggedTask) {
      const draggedTaskDate = format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      
      if (draggedTaskDate !== targetDate) {
        e.dataTransfer.dropEffect = 'move';
        setIsHoveredDrop(true);
      } else {
        e.dataTransfer.dropEffect = 'none';
      }
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDragging && draggedTask) {
      const draggedTaskDate = format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      
      if (draggedTaskDate !== targetDate) {
        setIsHoveredDrop(true);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're actually leaving the drop zone
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsHoveredDrop(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('CalendarDropZone: Drop event triggered', { 
      isDragging, 
      draggedTask: draggedTask?.id,
      targetDate: format(date, 'yyyy-MM-dd')
    });
    
    setIsHoveredDrop(false);
    
    if (onDrop && isDragging && draggedTask) {
      const draggedTaskDate = format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      
      if (draggedTaskDate !== targetDate) {
        console.log('CalendarDropZone: Executing drop for task:', draggedTask.id, 'to date:', targetDate);
        onDrop(date);
      }
    }
  };

  const canDrop = isDragging && draggedTask && 
    format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd') !== format(date, 'yyyy-MM-dd');

  return (
    <div
      className={cn(
        "relative h-full",
        isDragging && canDrop && "transition-all duration-300",
        isDragging && canDrop && isHoveredDrop && "bg-green-100/50 border-2 border-dashed border-green-400 rounded-lg",
        isDragging && canDrop && !isHoveredDrop && "bg-blue-50/30 border border-dashed border-blue-300 rounded-lg",
        isDragging && !canDrop && "opacity-60"
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop indicator overlay */}
      {isDragging && canDrop && isHoveredDrop && (
        <div className="absolute inset-2 flex items-center justify-center bg-green-100/90 border-2 border-green-400 border-dashed rounded-lg z-20 pointer-events-none">
          <div className="bg-white/95 text-green-700 font-semibold text-sm px-4 py-2 rounded-lg shadow-md border border-green-200">
            📅 Drop here to reschedule
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
