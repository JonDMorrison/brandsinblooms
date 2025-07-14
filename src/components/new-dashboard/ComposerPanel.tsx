import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, Save, CheckCircle, Loader2, Instagram, Facebook, Mail, BookOpen, Video, FileText, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { cn } from '@/lib/utils';

import { supabase } from '@/integrations/supabase/client';
import { Draggable, Droppable } from 'react-beautiful-dnd';
import { useDashboardContext } from '@/contexts/DashboardContext';
import { useComposerImages } from './hooks/useComposerImages';
import { ApprovalButton } from './components/ApprovalButton';
import { ContentDisplay } from './components/ContentDisplay';
import { ImageSection } from './components/ImageSection';

interface ComposerPanelProps {
  selectedDraft?: any;
  socialConnections?: any[];
  onTaskUpdate?: () => void;
  onApproved?: (draftId: string) => void;
}

const getPostTypeIcon = (postType: string) => {
  switch (postType?.toLowerCase()) {
    case 'instagram': return Instagram;
    case 'facebook': return Facebook;
    case 'email': return Mail;
    case 'newsletter': return BookOpen;
    case 'video': return Video;
    default: return FileText;
  }
};

const getPostTypeLabel = (postType: string) => {
  if (!postType) return 'Content';
  return postType.charAt(0).toUpperCase() + postType.slice(1);
};

export const ComposerPanel = ({ selectedDraft, socialConnections = [], onTaskUpdate, onApproved }: ComposerPanelProps) => {
  const { handleClickToPost, openTimePopover } = useDashboardContext();
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);

  const { scheduledPosts } = useScheduledPosts();
  
  const {
    images,
    selectedImageId,
    postWithoutImage,
    setPostWithoutImage,
    imagesFetching,
    imageError,
    imagesLoading,
    handleImageSelect,
    handleImageRefresh,
    handleImageSearch,
    getSelectedImage
  } = useComposerImages(selectedDraft);

  const relatedScheduledPosts = scheduledPosts.filter(post => 
    post.content_id === selectedDraft?.id
  );

  const isScheduled = relatedScheduledPosts.length > 0;
  const isApproved = selectedDraft?.status === 'approved';
  const isDraft = !isApproved && selectedDraft?.status !== 'posted';

  const isInstagram = selectedDraft?.post_type?.toLowerCase().includes('instagram');
  const needsImage = isInstagram || (!postWithoutImage && selectedDraft?.post_type?.toLowerCase() === 'facebook');
  const hasValidImage = Boolean(selectedImageId && images.find(img => img.id === selectedImageId));
  const canApprove = hasValidImage || (!needsImage && postWithoutImage);

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setEditContent(selectedDraft.ai_output);
    }
  }, [selectedDraft]);

  const handleSave = async () => {
    if (!selectedDraft) return;

    setSaving(true);
    try {
      const selectedImage = getSelectedImage();
      const attachments = selectedImage ? { image: selectedImage as any } : null;

      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: editContent,
          status: 'draft',
          attachments
        })
        .eq('id', selectedDraft.id);

      if (error) throw error;

      
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error saving draft:', error);
      
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDraft || !editContent.trim()) return;
    
    if (!canApprove) {
      
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to approve this content? It will be ready for scheduling after approval.'
    );
    
    if (!confirmed) return;

    setApproving(true);
    try {
      const selectedImage = getSelectedImage();
      const attachments = selectedImage ? { image: selectedImage as any } : null;

      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: editContent,
          status: 'approved',
          attachments
        })
        .eq('id', selectedDraft.id);

      if (error) throw error;

      
      if (onApproved) onApproved(selectedDraft.id);
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error approving draft:', error);
      
    } finally {
      setApproving(false);
    }
  };

  const handleSaveEdit = async () => {
    await handleSave();
    setIsEditing(false);
  };


  const renderActionButtons = () => {
    if (!selectedDraft) {
      return (
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-3">
            This is where you'll edit and approve your content before scheduling.
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 border-gray-300 text-gray-500"
              disabled
            >
              <Save className="w-4 h-4 mr-2" />
              Save Draft
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  className="flex-1 bg-gray-300 text-gray-500"
                  disabled
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve & Post
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <div className="text-sm">
                  Select a draft from the tray to get started
                </div>
              </TooltipContent>
            </Tooltip>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Select a draft from the tray to get started
          </p>
        </div>
      );
    }

    if (isScheduled) {
      return (
        <div className="text-center">
          <div className="text-sm text-gray-600 mb-3">
            This content is already scheduled for posting.
          </div>
          <div className="text-xs text-gray-500">
            Scheduled for: {relatedScheduledPosts[0] ? format(new Date(relatedScheduledPosts[0].publish_at), 'MMM d, yyyy \'at\' h:mm a') : 'Unknown time'}
          </div>
        </div>
      );
    }

    // Show click-to-post interface for approved content
    if (isApproved) {
      return (
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-600 mb-3">
            Content approved! Ready to schedule for posting.
          </div>
          
          <Button
            className="w-full bg-[#68BEB9] hover:bg-[#56a7a1] text-white"
            onClick={() => handleClickToPost(selectedDraft)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Click to Post
          </Button>
          
          <Button
            variant="outline"
            className="w-full border-[#68BEB9] text-[#68BEB9] hover:bg-[#68BEB9] hover:text-white"
            onClick={() => openTimePopover(selectedDraft)}
          >
            <Calendar className="w-4 h-4 mr-2" />
            Custom Date & Time
          </Button>
          
          <p className="text-xs text-gray-500">
            Click to Post uses AI to pick the optimal time, or choose a custom schedule
          </p>
        </div>
      );
    }

    // Show normal approve/save interface for draft content
    return (
      <div>
        <div className="text-sm text-gray-600 mb-3">
          Review your content and approve when ready to schedule.
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1 border-[#68BEB9] text-[#68BEB9] hover:bg-[#68BEB9] hover:text-white"
            onClick={handleSave}
            disabled={saving || approving}
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>
          
          <ApprovalButton
            selectedDraft={selectedDraft}
            editContent={editContent}
            socialConnections={socialConnections}
            hasValidImage={hasValidImage}
            postWithoutImage={postWithoutImage}
            approving={approving}
            saving={saving}
            onApprove={handleApprove}
          />
        </div>
      </div>
    );
  };

  const PostTypeIcon = getPostTypeIcon(selectedDraft?.post_type);
  const postTypeLabel = getPostTypeLabel(selectedDraft?.post_type);

  return (
    <TooltipProvider>
      <Card className={cn(
        "h-full flex flex-col overflow-hidden transition-all duration-300",
        isDragMode && "transform scale-95 shadow-xl border-[#68BEB9]"
      )}>
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#3E5A6B]">Composer</CardTitle>
            <div className="flex items-center gap-2">
              {selectedDraft && (
                <Badge 
                  variant={isApproved ? 'default' : 'secondary'}
                  className={cn(
                    isApproved && "bg-[#68BEB9] text-white hover:bg-[#56a7a1]",
                    isDraft && "bg-yellow-100 text-yellow-800"
                  )}
                >
                  {isScheduled ? 'SCHEDULED' : isApproved ? 'APPROVED' : 'DRAFT'}
                </Badge>
              )}
              {socialConnections.length === 0 && (
                <Badge variant="outline" className="text-orange-600">
                  No connections
                </Badge>
              )}
            </div>
          </div>
        
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Edit className="w-4 h-4" />
            <span>
              {!selectedDraft ? 'Select a draft to start editing' :
               isScheduled ? 'Managing scheduled content' : 
               isApproved ? 'Approved content ready for scheduling' : 
               'Draft content - review and approve when ready'}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-y-auto min-h-[600px]">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                {selectedDraft && (
                  <>
                    <PostTypeIcon className="w-4 h-4 text-[#3E5A6B]" />
                    <h3 className="font-medium text-[#3E5A6B]">{postTypeLabel} Content</h3>
                  </>
                )}
                {!selectedDraft && (
                  <h3 className="font-medium text-[#3E5A6B]">Content</h3>
                )}
              </div>
              {selectedDraft && !isScheduled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {isEditing ? 'Cancel' : 'Edit'}
                </Button>
              )}
            </div>

            {isEditing && selectedDraft ? (
              <div className="flex-1 flex flex-col overflow-hidden space-y-4 min-h-[500px]">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 min-h-[350px] resize-none"
                  placeholder="Write your content here..."
                />
              
                <div className="flex justify-end gap-2 mt-4 flex-shrink-0">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={saving}>
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-y-auto min-h-[500px]">
                <ContentDisplay selectedDraft={selectedDraft} />
              </div>
            )}

            <ImageSection
              selectedDraft={selectedDraft}
              postWithoutImage={postWithoutImage}
              setPostWithoutImage={setPostWithoutImage}
              hasValidImage={hasValidImage}
            />

            <div className="mt-4 p-4 border-t flex-shrink-0">
              {renderActionButtons()}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
