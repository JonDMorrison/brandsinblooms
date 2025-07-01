
import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { Badge } from '@/components/ui/badge';
import { Calendar, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { getStatusInfo, getPostTypeIcon, getPostTypeColor } from './utils';

interface DraftTrayItemProps {
  task: any;
  index: number;
  isSelected: boolean;
  isJustApproved: boolean;
  onSelectDraft: (draft: any) => void;
}

export const DraftTrayItem = ({ 
  task, 
  index, 
  isSelected, 
  isJustApproved, 
  onSelectDraft 
}: DraftTrayItemProps) => {
  const statusInfo = getStatusInfo(task.status);
  const StatusIcon = statusInfo.icon;
  const PostTypeIcon = getPostTypeIcon(task.post_type);
  const postTypeColor = getPostTypeColor(task.post_type);

  const handleCardClick = (e: React.MouseEvent) => {
    // Only prevent default if we're actually handling the click
    // Don't use stopPropagation as it can interfere with drag events
    console.log('🎯 Draft card clicked:', task.id, task.post_type);
    console.log('🎯 Current selected state:', isSelected);
    
    // Call the selection handler
    onSelectDraft(task);
  };

  const handleDragHandleClick = (e: React.MouseEvent) => {
    // Only prevent clicks on the drag handle itself, not drag events
    if (!statusInfo.draggable) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <Draggable
      key={task.id}
      draggableId={`task-${task.id}`}
      index={index}
      isDragDisabled={!statusInfo.draggable}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "group relative p-4 rounded-lg border transition-all duration-200 cursor-pointer",
            "bg-white/80 border-gray-200 hover:border-[#68BEB9]/50 hover:shadow-md",
            isSelected && "border-[#68BEB9] shadow-md bg-[#68BEB9]/5",
            isJustApproved && "animate-pulse border-green-400 bg-green-50",
            // Enhanced drag styling with proper z-index
            snapshot.isDragging && "shadow-2xl rotate-2 scale-105 z-[9999] bg-white border-[#68BEB9]",
            !statusInfo.draggable && "opacity-75",
            // Ensure proper stacking context
            "transform-gpu"
          )}
          style={{
            ...provided.draggableProps.style,
            // Override any transform issues
            ...(snapshot.isDragging && {
              transform: `${provided.draggableProps.style?.transform} rotate(2deg) scale(1.05)`,
              zIndex: 9999,
              position: 'fixed' // Ensure it's positioned correctly
            })
          }}
          onClick={handleCardClick}
        >
          {/* Drag Handle - Always show it but make it functional only when draggable */}
          <div
            {...(statusInfo.draggable ? provided.dragHandleProps : {})}
            className={cn(
              "absolute left-1 top-1/2 transform -translate-y-1/2",
              "transition-all duration-200",
              "z-20 touch-none bg-white rounded-md px-2 py-2 border-2 shadow-sm",
              "flex items-center justify-center",
              statusInfo.draggable 
                ? "opacity-100 text-gray-600 hover:text-[#68BEB9] cursor-grab active:cursor-grabbing border-gray-300 hover:bg-[#68BEB9]/10 hover:border-[#68BEB9] hover:shadow-md" 
                : "opacity-40 text-gray-400 cursor-not-allowed border-gray-200"
            )}
            onClick={handleDragHandleClick}
            title={statusInfo.draggable ? "Drag to schedule" : "Approve content to enable dragging"}
          >
            <GripVertical className="w-4 h-4" />
          </div>

          <div className="flex items-start gap-3 ml-8">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
              postTypeColor
            )}>
              <PostTypeIcon className="w-5 h-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="outline" 
                  className={cn("text-xs px-2 py-1", statusInfo.color)}
                >
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
              
              <p className="text-sm text-gray-700 line-clamp-3 leading-relaxed">
                {task.ai_output || 'No content generated yet'}
              </p>
              
              {task.scheduled_date && (
                <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(task.scheduled_date), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          </div>

          {/* Enhanced drag feedback overlay */}
          {snapshot.isDragging && (
            <div className="absolute inset-0 bg-[#68BEB9]/10 rounded-lg border-2 border-[#68BEB9] border-dashed pointer-events-none" />
          )}
        </div>
      )}
    </Draggable>
  );
};
