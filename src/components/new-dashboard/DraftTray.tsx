import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageEditOverlay } from '@/components/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, FileText, Image, Video, Mail, CheckCircle, ArrowRight, Clock, Send, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { extractNewsletterThumbnail } from '@/utils/renderMarkdown';
import { TASK_STATUS, type TaskStatus } from '@/constants/taskStatus';
import { useDashboardContext } from '@/contexts/DashboardContext';

interface DraftTrayProps {
  tasks?: any[];
  selectedDraft?: any;
  onSelectDraft?: (draft: any) => void;
  justApprovedId?: string | null;
}

export const DraftTray = ({ tasks = [], selectedDraft, onSelectDraft, justApprovedId }: DraftTrayProps) => {
  const { openDock, startDragging, stopDragging, handleClickToPost, openTimePopover } = useDashboardContext();
  const [showDragHint, setShowDragHint] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'drafts' | 'scheduled'>('drafts');

  useEffect(() => {
    if (justApprovedId) {
      setShowDragHint(justApprovedId);
      const timer = setTimeout(() => {
        setShowDragHint(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [justApprovedId]);

  const getPostTypeIcon = (postType: string) => {
    switch (postType?.toLowerCase()) {
      case 'video':
      case 'reel':
        return <Video className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'newsletter':
        return <Mail className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getPostTypeColor = (postType: string) => {
    switch (postType?.toLowerCase()) {
      case 'facebook':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'instagram':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'newsletter':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'video':
      case 'reel':
        return 'bg-pink-100 text-pink-800 border-pink-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getContentPreview = (draft: any) => {
    if (draft.post_type === 'newsletter') {
      return extractNewsletterThumbnail(draft.ai_output || '', 120);
    }
    return draft.ai_output?.substring(0, 120) + '...';
  };

  const isDraggable = (draft: any) => {
    return draft.status === TASK_STATUS.APPROVED;
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case TASK_STATUS.APPROVED:
        return { label: 'Approved', variant: 'default' as const, className: 'bg-[#68BEB9] text-white' };
      case TASK_STATUS.SCHEDULED:
        return { label: 'Scheduled', variant: 'secondary' as const, className: 'bg-blue-500 text-white' };
      case TASK_STATUS.GENERATED:
      case 'draft':
        return { label: 'Draft', variant: 'secondary' as const, className: '' };
      default:
        return { label: status, variant: 'outline' as const, className: '' };
    }
  };

  const handleDragStart = () => {
    console.log('🎯 Draft drag started, opening dock and setting drag state');
    startDragging();
    openDock();
  };


  // Filter tasks based on active tab
  const draftTasks = tasks.filter(task => task.status !== TASK_STATUS.SCHEDULED);
  const scheduledTasks = tasks.filter(task => task.status === TASK_STATUS.SCHEDULED);
  
  const currentTasks = activeTab === 'drafts' ? draftTasks : scheduledTasks;
  const draftCount = draftTasks.length;
  const scheduledCount = scheduledTasks.length;

  // Group scheduled tasks by date
  const groupedScheduled = scheduledTasks.reduce((acc, task) => {
    if (task.scheduled_date) {
      const dateKey = format(new Date(task.scheduled_date), 'MMM d, yyyy');
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(task);
    }
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg font-semibold text-[#3E5A6B] flex items-center justify-between">
          Your Drafts
          <Badge variant="outline" className="text-xs">
            {draftCount} ready
          </Badge>
        </CardTitle>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('drafts')}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === 'drafts'
                ? "bg-white text-[#3E5A6B] shadow-sm"
                : "text-gray-600 hover:text-[#3E5A6B]"
            )}
          >
            Drafts ({draftCount})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={cn(
              "flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === 'scheduled'
                ? "bg-white text-[#3E5A6B] shadow-sm"
                : "text-gray-600 hover:text-[#3E5A6B]"
            )}
          >
            Scheduled ({scheduledCount})
          </button>
        </div>

        <p className="text-sm text-gray-600">
          {activeTab === 'drafts'
            ? `${draftCount} draft${draftCount !== 1 ? 's' : ''} ready for publishing`
            : `${scheduledCount} post${scheduledCount !== 1 ? 's' : ''} scheduled`
          }
        </p>
      </CardHeader>

      <CardContent className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'drafts' ? (
          <Droppable droppableId="draft-tray">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={cn(
                  "h-full overflow-y-auto space-y-3",
                  snapshot.isDraggingOver && "bg-[#68BEB9]/5 rounded-lg"
                )}
              >
                {currentTasks.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div>
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No drafts ready</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Generate content to see drafts here
                      </p>
                    </div>
                  </div>
                ) : (
                  currentTasks.map((draft, index) => {
                    const statusInfo = getStatusDisplay(draft.status);
                    const canDrag = isDraggable(draft);
                    const showHint = showDragHint === draft.id;
                    const imageThumb = draft.attachments?.image?.thumb;
                    
                    return (
                      <Draggable
                        key={draft.id}
                        draggableId={`task-${draft.id}`}
                        index={index}
                        isDragDisabled={!canDrag}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            data-draft-card="true"
                            className={cn(
                              "relative p-4 border-2 rounded-lg transition-all duration-200",
                              selectedDraft?.id === draft.id 
                                ? "border-[#68BEB9] bg-[#68BEB9]/5 shadow-md" 
                                : "border-gray-200 hover:border-[#68BEB9]/50 hover:shadow-sm",
                              snapshot.isDragging && "shadow-lg scale-105 rotate-2 bg-white border-[#68BEB9]",
                              canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-not-allowed opacity-75",
                              draft.status === 'approved' && "border-l-4 border-l-[#68BEB9]"
                            )}
                            onClick={() => onSelectDraft?.(draft)}
                            onDragStart={handleDragStart}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {draft.attachments?.[0]?.url && draft.status === 'approved' ? (
                                  <ImageEditOverlay
                                    imageUrl={draft.attachments[0].url}
                                    onImageSelect={async (imageUrl, metadata) => {
                                      // Update image and set status to review for approved content
                                      const updateData: any = {
                                        attachments: [
                                          {
                                            type: 'image',
                                            url: imageUrl,
                                            alt: metadata?.alt || 'Selected image',
                                            photographer: metadata?.photographer,
                                            source: metadata?.source || 'unknown',
                                            unsplash_id: metadata?.unsplash_id
                                          }
                                        ],
                                        status: 'review' // Move back to review when changing approved content
                                      };

                                      try {
                                        const { supabase } = await import('@/integrations/supabase/client');
                                        const { toast } = await import('sonner');
                                        
                                        const { error } = await supabase
                                          .from('content_tasks')
                                          .update(updateData)
                                          .eq('id', draft.id);

                                        if (error) throw error;

                                        toast.success('Image updated! Content moved to review for re-approval.');
                                        
                                        // Trigger refresh
                                        window.dispatchEvent(new CustomEvent('draft-updated'));
                                      } catch (error) {
                                        console.error('Error updating image:', error);
                                      }
                                    }}
                                    contentContext={draft.ai_output}
                                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                                  />
                                ) : imageThumb ? (
                                  <img 
                                    src={imageThumb} 
                                    alt="Draft image" 
                                    className="w-8 h-8 rounded object-cover flex-shrink-0"
                                  />
                                ) : null}
                                {getPostTypeIcon(draft.post_type)}
                                <Badge 
                                  variant="outline" 
                                  className={cn("text-xs", getPostTypeColor(draft.post_type))}
                                >
                                  {draft.post_type || 'Post'}
                                </Badge>
                              </div>
                              {draft.status !== 'approved' && (
                                <Badge variant={statusInfo.variant} className={statusInfo.className}>
                                  {statusInfo.label}
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm text-gray-700 line-clamp-3 mb-2">
                              {getContentPreview(draft)}
                            </p>

                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(draft.created_at), 'MMM d')}
                              </div>
                              {draft.campaigns?.title && (
                                <span className="truncate max-w-[100px]">
                                  {draft.campaigns.title}
                                </span>
                              )}
                            </div>

                            {/* Click to Post Buttons */}
                            {draft.status === TASK_STATUS.APPROVED && (
                              <div className="mt-3 space-y-2">
                                <Button
                                  size="sm"
                                  className="w-full bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClickToPost(draft);
                                  }}
                                >
                                  <Send className="w-3 h-3 mr-2" />
                                  Click to Post
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full text-xs text-gray-600 hover:text-[#68BEB9]"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openTimePopover(draft);
                                  }}
                                >
                                  <Settings className="w-3 h-3 mr-1" />
                                  Custom Time
                                </Button>
                              </div>
                            )}

                            {showHint && (
                              <div className="absolute inset-0 bg-[#68BEB9]/90 rounded-lg flex items-center justify-center text-white font-medium text-sm animate-in fade-in-0 slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                  <span>Ready to schedule – drag me</span>
                                  <ArrowRight className="w-4 h-4" />
                                </div>
                              </div>
                            )}

                            {snapshot.isDragging && (
                              <div className="absolute -top-2 -right-2 bg-[#68BEB9] text-white text-xs px-2 py-1 rounded-full">
                                Scheduling...
                              </div>
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
        ) : (
          // Scheduled tab content
          <div className="h-full overflow-y-auto space-y-4">
            {scheduledCount === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div>
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No scheduled posts</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Drag drafts to schedule them
                  </p>
                </div>
              </div>
            ) : (
              Object.entries(groupedScheduled).map(([date, tasksForDate]: [string, any[]]) => (
                <div key={date}>
                  <h4 className="text-sm font-medium text-[#3E5A6B] mb-2">{date}</h4>
                  <div className="space-y-2">
                    {tasksForDate.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => onSelectDraft?.(task)}
                        className="p-3 border rounded-lg cursor-pointer hover:border-[#68BEB9]/50 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getPostTypeIcon(task.post_type)}
                          <Badge variant="outline" className={getPostTypeColor(task.post_type)}>
                            {task.post_type}
                          </Badge>
                          <Badge className="bg-blue-500 text-white">Scheduled</Badge>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {getContentPreview(task)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
