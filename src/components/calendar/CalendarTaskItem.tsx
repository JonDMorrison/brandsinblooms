import { Badge } from "@/components/ui/badge";
import { GripVertical, Check } from "lucide-react";
import { cn } from "@/lib/utils";

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

interface CalendarTaskItemProps {
  task: Task;
  isSelected: boolean;
  isBeingDragged: boolean;
  isPastDate: boolean;
  selectionMode: boolean;
  onTaskClick: (task: Task, ctrlKey: boolean) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
}

export const CalendarTaskItem = ({
  task,
  isSelected,
  isBeingDragged,
  isPastDate,
  selectionMode,
  onTaskClick,
  onDragStart,
  onDragEnd
}: CalendarTaskItemProps) => {
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

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTaskClick(task, e.ctrlKey || e.metaKey);
  };

  const handleDragStart = (e: React.DragEvent) => {
    if (selectionMode) {
      // Set drag data
      e.dataTransfer.setData('text/plain', task.id);
      e.dataTransfer.effectAllowed = 'move';
      
      // Create a custom drag image
      const dragElement = e.currentTarget.cloneNode(true) as HTMLElement;
      dragElement.style.transform = 'rotate(3deg)';
      dragElement.style.opacity = '0.9';
      dragElement.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
      dragElement.style.background = 'white';
      dragElement.style.border = '2px solid #3B82F6';
      dragElement.style.borderRadius = '8px';
      
      // Position off-screen temporarily
      dragElement.style.position = 'absolute';
      dragElement.style.top = '-1000px';
      dragElement.style.left = '-1000px';
      document.body.appendChild(dragElement);
      
      // Set custom drag image
      e.dataTransfer.setDragImage(dragElement, 50, 25);
      
      // Clean up after drag starts
      setTimeout(() => {
        if (document.body.contains(dragElement)) {
          document.body.removeChild(dragElement);
        }
      }, 0);
      
      onDragStart(task);
    } else {
      e.preventDefault();
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    onDragEnd();
  };

  const isDraggable = selectionMode;

  const tooltipText = isPastDate 
    ? `Click to view/edit • ${isDraggable ? 'Drag to reschedule to future dates' : ''}`
    : `Click to view/edit • ${isDraggable ? 'Drag to reschedule' : ''}`;

  return (
    <div
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      className={cn(
        "relative text-xs p-2 rounded-lg transition-all duration-200 group/task cursor-pointer",
        "bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200",
        // Hover states when not being dragged
        !isBeingDragged && "hover:from-green-100 hover:to-emerald-100 hover:shadow-md hover:-translate-y-0.5",
        isDraggable && !isBeingDragged && "hover:cursor-move",
        isSelected && "ring-2 ring-blue-500 bg-blue-50 border-blue-300",
        // Drag state styling
        isBeingDragged && "opacity-60 shadow-lg scale-105 z-50 pointer-events-none",
        isPastDate && "opacity-75"
      )}
      title={tooltipText}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm z-10">
          <Check className="w-3 h-3" />
        </div>
      )}

      <div className="flex items-start gap-2">
        <div className="flex items-center gap-1">
          {isDraggable && (
            <GripVertical className={cn(
              "w-3 h-3 text-gray-400 transition-all duration-200",
              !isBeingDragged && "opacity-0 group-hover/task:opacity-100 group-hover/task:text-blue-500",
              isBeingDragged && "opacity-100 text-blue-600",
              isPastDate && !isBeingDragged && "group-hover/task:text-orange-500"
            )} />
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

      {/* Subtle hover overlay - only when not being dragged */}
      {!isBeingDragged && (
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/task:opacity-100 transition-opacity duration-200 rounded-lg pointer-events-none" />
      )}
    </div>
  );
};
