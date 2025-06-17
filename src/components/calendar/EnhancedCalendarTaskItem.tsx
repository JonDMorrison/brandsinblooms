
import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { GripVertical, Check, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEnhancedDragContext } from "./EnhancedDragContext";

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
  onTaskClick: (task: Task, ctrlKey: boolean) => void;
  onSelectionToggle: (task: Task) => void;
  isTaskSelected: (task: Task) => boolean;
  selectedTasks: Task[];
}

export const EnhancedCalendarTaskItem = ({
  task,
  isSelected,
  isPastDate,
  onTaskClick,
  onSelectionToggle,
  isTaskSelected,
  selectedTasks
}: EnhancedCalendarTaskItemProps) => {
  const { dragState, startDrag, endDrag } = useEnhancedDragContext();
  const [isDragHover, setIsDragHover] = useState(false);
  const [showCheckbox, setShowCheckbox] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

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
      case 'posted':
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

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartRef.current) {
      const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
      const deltaY = Math.abs(e.clientY - dragStartRef.current.y);
      
      // Start drag if mouse moved more than 5px
      if (deltaX > 5 || deltaY > 5) {
        const tasksToMove = isSelected && selectedTasks.length > 1 
          ? selectedTasks 
          : [task];
        startDrag(tasksToMove, dragStartRef.current);
        dragStartRef.current = null;
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (dragStartRef.current) {
      // This was a click, not a drag
      handleClick(e);
    }
    dragStartRef.current = null;
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.ctrlKey || e.metaKey) {
      onSelectionToggle(task);
    } else {
      onTaskClick(task, false);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectionToggle(task);
  };

  const statusBadge = getStatusBadge(task.status);
  const isBeingDragged = dragState.draggedTasks.some(t => t.id === task.id);

  return (
    <div
      ref={dragRef}
      className={cn(
        "relative text-xs p-3 rounded-lg transition-all duration-200 group/task cursor-pointer",
        "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200",
        !isBeingDragged && "hover:from-green-100 hover:to-emerald-100 hover:shadow-lg hover:-translate-y-1",
        isSelected && "ring-2 ring-blue-500 bg-blue-50 border-blue-300",
        isBeingDragged && "opacity-30 shadow-xl scale-105 rotate-2 z-50",
        isPastDate && "opacity-75",
        isDragHover && "bg-blue-100 border-blue-400"
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseEnter={() => {
        setShowCheckbox(true);
        setIsDragHover(true);
      }}
      onMouseLeave={() => {
        setShowCheckbox(false);
        setIsDragHover(false);
      }}
    >
      {/* Enhanced selection indicator */}
      {isSelected && (
        <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg z-10 animate-scale-in">
          <Check className="w-3 h-3" />
        </div>
      )}

      {/* Checkbox overlay for multi-selection */}
      {(showCheckbox || isSelected) && !isBeingDragged && (
        <div 
          className={cn(
            "absolute top-2 left-2 w-5 h-5 rounded border-2 bg-white shadow-sm cursor-pointer transition-all duration-200 z-20",
            isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300 hover:border-blue-400",
            showCheckbox ? "opacity-100 scale-100" : "opacity-0 scale-75"
          )}
          onClick={handleCheckboxClick}
        >
          {isSelected && <Check className="w-3 h-3 text-white m-0.5" />}
        </div>
      )}

      <div className="flex items-start gap-2 ml-1">
        {/* Enhanced drag handle */}
        <div className="flex items-center gap-1">
          <GripVertical className={cn(
            "w-3 h-3 text-gray-400 transition-all duration-200 cursor-grab active:cursor-grabbing",
            !isBeingDragged && "opacity-40 group-hover/task:opacity-100 group-hover/task:text-blue-500 group-hover/task:scale-110",
            isBeingDragged && "opacity-100 text-blue-600 scale-125",
            isPastDate && !isBeingDragged && "group-hover/task:text-orange-500"
          )} />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{getPostTypeIcon(task.post_type)}</span>
            <span className="font-semibold text-green-800 capitalize">
              {task.post_type}
            </span>
            {isPastDate && (
              <Badge className="text-xs px-1 py-0.5 bg-orange-100 text-orange-700 border-orange-300">
                Past
              </Badge>
            )}
          </div>
          
          <Badge className={`text-xs px-2 py-0.5 ${statusBadge.className} mb-2`}>
            {statusBadge.text}
          </Badge>
          
          {task.campaigns && (
            <div className="text-green-700 truncate leading-tight">
              {task.campaigns.title}
            </div>
          )}
        </div>
      </div>

      {/* Drag ripple effect */}
      {isBeingDragged && (
        <div className="absolute inset-0 bg-blue-400 opacity-20 rounded-lg animate-ping pointer-events-none" />
      )}

      {/* Enhanced hover overlay */}
      {!isBeingDragged && (
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 to-white/20 opacity-0 group-hover/task:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
      )}

      {/* Loading state for drag operations */}
      {isBeingDragged && (
        <div className="absolute bottom-1 right-1">
          <Clock className="w-3 h-3 text-blue-600 animate-spin" />
        </div>
      )}
    </div>
  );
};
