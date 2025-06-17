
import { useState } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useEnhancedDragContext } from "./EnhancedDragContext";
import { Calendar, Clock, AlertTriangle } from "lucide-react";

interface EnhancedDropZoneProps {
  date: Date;
  onDrop: (date: Date) => void;
  className?: string;
  children: React.ReactNode;
}

export const EnhancedDropZone = ({ date, onDrop, className, children }: EnhancedDropZoneProps) => {
  const { dragState, setHoveredDropZone } = useEnhancedDragContext();
  const [isHovered, setIsHovered] = useState(false);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPastDate = date < today;
  const isSameDate = dragState.draggedTasks.some(task => task.scheduled_date === format(date, 'yyyy-MM-dd'));
  const isValidDrop = dragState.isDragging && !isPastDate && !isSameDate;
  const isInvalidDrop = dragState.isDragging && (isPastDate || isSameDate);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (isValidDrop) {
      e.dataTransfer.dropEffect = 'move';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragState.isDragging) {
      setIsHovered(true);
      setHoveredDropZone(format(date, 'yyyy-MM-dd'));
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set to false if we're leaving the drop zone entirely
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsHovered(false);
      setHoveredDropZone(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsHovered(false);
    setHoveredDropZone(null);
    
    if (isValidDrop) {
      onDrop(date);
    }
  };

  const getDropZoneMessage = () => {
    if (isSameDate) return "Already on this date";
    if (isPastDate) return "Cannot schedule in past";
    return `Drop here to schedule for ${format(date, 'MMM d')}`;
  };

  const getDropZoneIcon = () => {
    if (isSameDate) return <Calendar className="w-4 h-4" />;
    if (isPastDate) return <AlertTriangle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div
      className={cn(
        "relative transition-all duration-300",
        className
      )}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      
      {/* Enhanced drop zone overlay */}
      {dragState.isDragging && (
        <div className={cn(
          "absolute inset-0 border-2 border-dashed rounded-lg transition-all duration-300 z-40",
          isValidDrop && isHovered && "border-green-400 bg-green-50/80 shadow-lg",
          isValidDrop && !isHovered && "border-green-300 bg-green-50/40",
          isInvalidDrop && isHovered && "border-red-400 bg-red-50/80",
          isInvalidDrop && !isHovered && "border-gray-300 bg-gray-50/40"
        )}>
          {/* Drop zone indicator */}
          {isHovered && (
            <div className={cn(
              "absolute inset-0 flex items-center justify-center text-sm font-medium rounded-lg",
              isValidDrop && "text-green-700 bg-green-100/90",
              isInvalidDrop && "text-red-700 bg-red-100/90"
            )}>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-white/80 shadow-sm">
                {getDropZoneIcon()}
                <span>{getDropZoneMessage()}</span>
              </div>
            </div>
          )}
          
          {/* Subtle animation for valid drop zones */}
          {isValidDrop && isHovered && (
            <div className="absolute inset-2 border border-green-400 rounded-lg animate-pulse bg-green-200/20" />
          )}
        </div>
      )}
      
      {/* Global drag overlay hint */}
      {dragState.isDragging && !isHovered && (
        <div className="absolute inset-0 bg-blue-50/20 rounded-lg transition-all duration-300" />
      )}
    </div>
  );
};
