
import React from 'react';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, Calendar, GripVertical } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DraftTrayProps {
  tasks: any[];
  selectedDraft: any;
  onSelectDraft: (draft: any) => void;
  justApprovedId?: string | null;
}

export const DraftTray = ({ 
  tasks, 
  selectedDraft, 
  onSelectDraft, 
  justApprovedId
}: DraftTrayProps) => {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'approved':
        return { 
          icon: CheckCircle, 
          color: 'bg-green-100 text-green-700 border-green-300',
          label: 'Approved',
          draggable: true
        };
      case 'generated':
        return { 
          icon: Clock, 
          color: 'bg-blue-100 text-blue-700 border-blue-300',
          label: 'Generated',
          draggable: false
        };
      case 'scheduled':
        return { 
          icon: Calendar, 
          color: 'bg-purple-100 text-purple-700 border-purple-300',
          label: 'Scheduled',
          draggable: true
        };
      default:
        return { 
          icon: Clock, 
          color: 'bg-gray-100 text-gray-700 border-gray-300',
          label: status,
          draggable: false
        };
    }
  };

  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case 'facebook': return '📘';
      case 'instagram': return '📷';
      case 'newsletter': return '📰';
      case 'email': return '📧';
      default: return '📝';
    }
  };

  return (
    <Card className="h-full bg-gradient-to-b from-[#68BEB9]/10 to-[#68BEB9]/5">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#3E5A6B]">Content Drafts</h2>
          <Badge variant="secondary" className="bg-white/60">
            {tasks.length}
          </Badge>
        </div>

        <Droppable droppableId="draft-tray">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={cn(
                "flex-1 space-y-3 overflow-y-auto",
                snapshot.isDraggingOver && "bg-[#68BEB9]/10 rounded-lg"
              )}
            >
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-8">
                  <div className="text-4xl mb-4">📝</div>
                  <p className="text-gray-500 text-sm">No drafts available</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Generate content to see drafts here
                  </p>
                </div>
              ) : (
                tasks.map((task, index) => {
                  const statusInfo = getStatusInfo(task.status);
                  const StatusIcon = statusInfo.icon;
                  const isSelected = selectedDraft?.id === task.id;
                  const isJustApproved = justApprovedId === task.id;

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
                            snapshot.isDragging && "shadow-lg rotate-2 scale-105 z-50",
                            !statusInfo.draggable && "opacity-75"
                          )}
                          onClick={() => onSelectDraft(task)}
                        >
                          {/* Drag Handle - only show for draggable items */}
                          {statusInfo.draggable && (
                            <div
                              {...provided.dragHandleProps}
                              className={cn(
                                "absolute left-2 top-1/2 transform -translate-y-1/2",
                                "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                                "text-gray-400 hover:text-[#68BEB9] cursor-grab active:cursor-grabbing"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <GripVertical className="w-4 h-4" />
                            </div>
                          )}

                          <div className={cn(
                            "flex items-start gap-3",
                            statusInfo.draggable && "ml-6"
                          )}>
                            <div className="text-xl flex-shrink-0 mt-1">
                              {getPostTypeIcon(task.post_type)}
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
                                {statusInfo.draggable && (
                                  <Badge variant="outline" className="text-xs px-2 py-1 bg-blue-50 text-blue-600 border-blue-200">
                                    Draggable
                                  </Badge>
                                )}
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

                          {/* Drag feedback overlay */}
                          {snapshot.isDragging && (
                            <div className="absolute inset-0 bg-[#68BEB9]/10 rounded-lg border-2 border-[#68BEB9] border-dashed" />
                          )}
                        </div>
                      )}
                    </Draggable>
                  );
                })
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>

        {/* Instructions */}
        <div className="mt-4 p-3 bg-white/60 rounded-lg border border-white/40">
          <p className="text-xs text-[#3E5A6B] text-center">
            <span className="font-medium">Drag approved drafts</span> to the Smart-Time dock to schedule them
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
