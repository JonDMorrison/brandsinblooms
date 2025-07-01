
import { Badge } from "@/components/ui/badge";
import { GripVertical, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLongPress } from "@/hooks/useLongPress";
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

interface EnhancedCalendarTaskItemProps {
  task: Task;
  isSelected: boolean;
  isPastDate: boolean;
  onTaskClick: (task: Task) => void;
  onLongPress: (task: Task) => void;
  onDragStart?: (task: Task) => void;
  onDragEnd?: () => void;
}

export const EnhancedCalendarTaskItem = ({
  task,
  isSelected,
  isPastDate,
  onTaskClick,
  onLongPress,
  onDragStart,
  onDragEnd
}: EnhancedCalendarTaskItemProps) => {
  const [isDragReady, setIsDragReady] = useState(false);

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'email': return '📧';
      case 'newsletter': return '📰';
      case 'video': return '🎥';
      default: return '📝';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
      case 'completed':
      case 'approved':
        return { text: 'Approved', className: 'bg-green-100 text-green-700 border-green-300' };
      case 'scheduled':
        return { text: 'Scheduled', className: 'bg-blue-100 text-blue-700 border-blue-300' };
      case 'published':
        return { text: 'Published', className: 'bg-purple-100 text-purple-700 border-purple-300' };
      default:
        return { text: status, className: 'bg-gray-100 text-gray-700 border-gray-300' };
    }
  };

  const handleLongPressStart = () => {
    console.log('Long press detected, enabling drag for task:', task.id);
    setIsDragReady(true);
    onLongPress(task);
    if (onDragStart) {
      onDragStart(task);
    }
  };

  const handleClick = () => {
    if (!isDragReady) {
      console.log('Quick click detected, opening modal for task:', task.id);
      onTaskClick(task);
    }
  };

  const longPressProps = useLongPress({
    onLongPress: handleLongPressStart,
    onClick: handleClick,
    longPressThreshold: 300
  });

  const handleDragStart = (e: React.DragEvent) => {
    console.log('Drag start event triggered for task:', task.id);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    
    // Create custom drag image
    const dragElement = e.currentTarget.cloneNode(true) as HTMLElement;
    dragElement.style.transform = 'rotate(2deg) scale(1.05)';
    dragElement.style.opacity = '0.9';
    dragElement.style.position = 'absolute';
    dragElement.style.top = '-1000px';
    dragElement.style.left = '-1000px';
    dragElement.style.pointerEvents = 'none';
    dragElement.style.zIndex = '9999';
    
    document.body.appendChild(dragElement);
    e.dataTransfer.setDragImage(dragElement, 50, 25);
    
    setTimeout(() => {
      if (document.body.contains(dragElement)) {
        document.body.removeChild(dragElement);
      }
    }, 100);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    console.log('Drag end event triggered for task:', task.id);
    setIsDragReady(false);
    if (onDragEnd) {
      onDragEnd();
    }
  };

  const statusBadge = getStatusBadge(task.status);

  return (
    <div
      {...longPressProps}
      draggable={isDragReady}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        "relative text-xs p-3 rounded-lg transition-all duration-200 group/task cursor-pointer select-none",
        "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200",
        !isDragReady && "hover:from-green-100 hover:to-emerald-100 hover:shadow-md hover:-translate-y-0.5",
        isDragReady && "cursor-move bg-blue-50 border-blue-300 shadow-lg scale-105 z-50",
        isSelected && "ring-2 ring-blue-500 bg-blue-50 border-blue-300",
        isPastDate && "opacity-75",
        longPressProps.isPressed && "scale-95 bg-blue-100"
      )}
    >
      {/* Long press visual feedback */}
      {longPressProps.isPressed && (
        <div className="absolute inset-0 bg-blue-400 opacity-20 rounded-lg animate-pulse pointer-events-none" />
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm z-10">
          <Check className="w-3 h-3" />
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1">
          {isDragReady && (
            <GripVertical className="w-3 h-3 text-blue-500 animate-pulse" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <span>{getPostTypeIcon(task.post_type)}</span>
            <span className="font-semibold text-green-800 capitalize">
              {task.post_type}
            </span>
            {isPastDate && (
              <span className="text-xs text-orange-600 font-medium">Past</span>
            )}
            {isDragReady && (
              <Clock className="w-3 h-3 text-blue-600 animate-spin ml-auto" />
            )}
          </div>
          
          <Badge className={`text-xs px-1 py-0.5 ${statusBadge.className}`}>
            {statusBadge.text}
          </Badge>
          
          {task.campaigns && (
            <div className="text-green-700 truncate mt-1 leading-tight">
              {task.campaigns.title}
            </div>
          )}
        </div>
      </div>

      {/* Hover overlay */}
      {!isDragReady && (
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/task:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
      )}
    </div>
  );
};
