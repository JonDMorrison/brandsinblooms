
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

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveredDrop(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHoveredDrop(false);
    
    if (onDrop && isDragging && draggedTask) {
      const draggedTaskDate = format(new Date(draggedTask.scheduled_date), 'yyyy-MM-dd');
      const targetDate = format(date, 'yyyy-MM-dd');
      
      if (draggedTaskDate !== targetDate) {
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
        // Enhanced drag and drop styling
        isDragging && canDrop && "border-2 border-dashed transition-all duration-300",
        isDragging && canDrop && isHoveredDrop && "border-green-400 bg-gradient-to-br from-green-100/80 to-emerald-100/60 shadow-lg",
        isDragging && canDrop && !isHoveredDrop && "border-blue-300 bg-gradient-to-br from-blue-50/60 to-green-50/40",
        isDragging && !canDrop && "opacity-60"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Enhanced drop indicator overlay */}
      {isDragging && canDrop && isHoveredDrop && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-green-100/90 to-emerald-100/80 border-2 border-green-400 border-dashed rounded-lg z-10 backdrop-blur-sm">
          <div className="bg-white/90 text-green-700 font-semibold text-sm px-4 py-2 rounded-lg shadow-lg border border-green-200">
            📅 Drop here to reschedule
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
