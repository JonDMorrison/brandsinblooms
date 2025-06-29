import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Image, Video, Mail, CheckCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { cn } from '@/lib/utils';
import { extractNewsletterThumbnail } from '@/utils/renderMarkdown';

interface DraftTrayProps {
  tasks?: any[];
  selectedDraft?: any;
  onSelectDraft?: (draft: any) => void;
  justApprovedId?: string | null;
}

export const DraftTray = ({ tasks = [], selectedDraft, onSelectDraft, justApprovedId }: DraftTrayProps) => {
  const [showDragHint, setShowDragHint] = useState<string | null>(null);

  useEffect(() => {
    if (justApprovedId) {
      setShowDragHint(justApprovedId);
      // Hide hint after 5 seconds
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
    return draft.status === 'approved';
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Approved', variant: 'default' as const, className: 'bg-[#68BEB9] text-white' };
      case 'scheduled':
        return { label: 'Scheduled', variant: 'secondary' as const, className: 'bg-blue-500 text-white' };
      case 'draft':
      case 'generated':
        return { label: 'Draft', variant: 'secondary' as const, className: '' };
      default:
        return { label: status, variant: 'outline' as const, className: '' };
    }
  };

  // Filter out scheduled tasks - they should not appear in the draft tray
  const availableDrafts = tasks
    .filter(task => 
      (task.status === 'approved' || task.status === 'generated' || task.status === 'draft') &&
      task.status !== 'scheduled' // Explicitly exclude scheduled tasks
    )
    .sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (b.status === 'approved' && a.status !== 'approved') return 1;
      return 0;
    });

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="text-lg font-semibold text-[#3E5A6B]">Draft Tray</CardTitle>
        <p className="text-sm text-gray-600">
          {availableDrafts.length} draft{availableDrafts.length !== 1 ? 's' : ''} ready to edit
        </p>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
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
              {availableDrafts.length === 0 ? (
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
                availableDrafts.map((draft, index) => {
                  const statusInfo = getStatusDisplay(draft.status);
                  const canDrag = isDraggable(draft);
                  const showHint = showDragHint === draft.id;
                  const imageThumb = draft.attachments?.image?.thumb;
                  
                  return (
                    <Draggable
                      key={draft.id}
                      draggableId={draft.id}
                      index={index}
                      isDragDisabled={!canDrag}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
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
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {/* Image thumbnail */}
                              {imageThumb && (
                                <img 
                                  src={imageThumb} 
                                  alt="Draft image" 
                                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                                />
                              )}
                              {getPostTypeIcon(draft.post_type)}
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", getPostTypeColor(draft.post_type))}
                              >
                                {draft.post_type || 'Post'}
                              </Badge>
                              {draft.status === 'approved' && (
                                <div className="flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3 text-[#68BEB9]" />
                                  <Badge className={statusInfo.className}>
                                    {statusInfo.label}
                                  </Badge>
                                </div>
                              )}
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
      </CardContent>
    </Card>
  );
};
