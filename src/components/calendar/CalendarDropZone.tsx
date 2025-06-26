
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
        "relative",
        // Drag and drop styling
        isDragging && canDrop && "border-dashed border-2",
        isDragging && canDrop && isHoveredDrop && "border-green-400 bg-green-50/30",
        isDragging && canDrop && !isHoveredDrop && "border-blue-300 bg-blue-50/20",
        isDragging && !canDrop && "opacity-50"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drop indicator overlay */}
      {isDragging && canDrop && isHoveredDrop && (
        <div className="absolute inset-0 flex items-center justify-center bg-green-100/80 border-2 border-green-400 border-dashed rounded-lg z-10">
          <div className="text-green-700 font-medium text-sm">
            Drop here to reschedule
          </div>
        </div>
      )}

      {children}
    </div>
  );
};
