
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Edit, Save, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { useUnsplash } from '@/hooks/useUnsplash';
import { ImagePicker } from '@/components/composer/ImagePicker';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NewsletterPreview } from '@/components/newsletter/NewsletterPreview';
import { supabase } from '@/integrations/supabase/client';
import { ImageAttachment } from '@/lib/contentTypes';

interface ComposerPanelProps {
  selectedDraft?: any;
  socialConnections?: any[];
  onTaskUpdate?: () => void;
  onApproved?: (draftId: string) => void;
}

export const ComposerPanel = ({ selectedDraft, socialConnections = [], onTaskUpdate, onApproved }: ComposerPanelProps) => {
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [postWithoutImage, setPostWithoutImage] = useState(false);

  const { scheduledPosts } = useScheduledPosts();
  const { getSmartImages, searchImages, refreshImages, loading: imagesLoading } = useUnsplash();

  const relatedScheduledPosts = scheduledPosts.filter(post => 
    post.content_id === selectedDraft?.id
  );

  const isScheduled = relatedScheduledPosts.length > 0;
  const isApproved = selectedDraft?.status === 'approved';
  const isDraft = selectedDraft?.status === 'draft' || selectedDraft?.status === 'generated';

  const isInstagram = selectedDraft?.post_type?.toLowerCase().includes('instagram');
  const needsImage = isInstagram || (!postWithoutImage && selectedDraft?.post_type?.toLowerCase() === 'facebook');
  const hasValidImage = selectedImageId && images.find(img => img.id === selectedImageId);
  const canApprove = hasValidImage || (!needsImage && postWithoutImage);

  // New function to get approval button status and tooltip
  const getApprovalButtonStatus = () => {
    const issues = [];
    
    if (!selectedDraft) {
      issues.push("No draft selected - choose a draft from the tray first");
    }
    
    if (selectedDraft && !editContent.trim()) {
      issues.push("Content is empty - add some text first");
    }
    
    if (socialConnections.length === 0) {
      issues.push("No social media accounts connected - connect Instagram or Facebook first");
    }
    
    if (selectedDraft && isInstagram && !hasValidImage) {
      issues.push("Instagram posts require an image - select one from the gallery");
    }
    
    if (selectedDraft && selectedDraft.post_type?.toLowerCase() === 'facebook' && !hasValidImage && !postWithoutImage) {
      issues.push("Facebook posts need an image OR check 'Post without an image'");
    }
    
    const isDisabled = issues.length > 0 || saving || approving;
    
    return {
      isDisabled,
      issues,
      tooltipContent: issues.length > 0 ? (
        <div className="space-y-2">
          <div className="font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Requirements not met:
          </div>
          <ul className="space-y-1">
            {issues.map((issue, index) => (
              <li key={index} className="text-sm flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      ) : null
    };
  };

  const approvalStatus = getApprovalButtonStatus();

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setEditContent(selectedDraft.ai_output);
      
      // Load existing image attachment
      if (selectedDraft.attachments?.image) {
        const existingImage = selectedDraft.attachments.image;
        setImages([existingImage]);
        setSelectedImageId(existingImage.id);
      } else {
        // Fetch new images based on content
        fetchImagesForDraft();
      }
    }
  }, [selectedDraft]);

  const fetchImagesForDraft = async () => {
    if (!selectedDraft?.ai_output) return;
    
    const query = extractKeywordsFromContent(selectedDraft.ai_output);
    const fetchedImages = await getSmartImages(query);
    setImages(fetchedImages);
    
    // Auto-select first image
    if (fetchedImages.length > 0) {
      setSelectedImageId(fetchedImages[0].id);
    }
  };

  const extractKeywordsFromContent = (content: string): string => {
    // Simple keyword extraction - could be enhanced
    const words = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3);
    
    return words.join(' ') || selectedDraft?.post_type || 'lifestyle';
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImageId(imageId);
    setPostWithoutImage(false);
  };

  const handleImageRefresh = async () => {
    if (!selectedDraft?.ai_output) return;
    const query = extractKeywordsFromContent(selectedDraft.ai_output);
    const newImages = await refreshImages(query);
    setImages(newImages);
    setSelectedImageId(newImages.length > 0 ? newImages[0].id : null);
  };

  const handleImageSearch = async (query: string) => {
    const searchResults = await searchImages(query);
    setImages(searchResults);
    setSelectedImageId(searchResults.length > 0 ? searchResults[0].id : null);
  };

  const getSelectedImage = (): ImageAttachment | null => {
    return images.find(img => img.id === selectedImageId) || null;
  };

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

      toast.success('Draft saved');
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedDraft || !editContent.trim()) return;
    
    if (!canApprove) {
      toast.error(isInstagram ? 'Instagram posts require an image' : 'Please select an image or choose to post without one');
      return;
    }

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

      toast.success('Marked approved – drag to Smart-Time Ribbon to schedule');
      if (onApproved) onApproved(selectedDraft.id);
      if (onTaskUpdate) onTaskUpdate();
    } catch (error) {
      console.error('Error approving draft:', error);
      toast.error('Failed to approve draft');
    } finally {
      setApproving(false);
    }
  };

  const handleSaveEdit = async () => {
    await handleSave();
    setIsEditing(false);
  };

  const renderContent = () => {
    if (!selectedDraft) {
      return (
        <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="text-gray-500 mb-2">No draft selected</div>
            <p className="text-sm text-gray-400">Select a draft from the tray to compose or manage</p>
          </div>
        </div>
      );
    }

    const content = selectedDraft.ai_output || 'No content generated yet';
    
    if (selectedDraft.post_type === 'newsletter') {
      return (
        <div className="flex-1 overflow-y-auto min-h-[400px]">
          <NewsletterPreview 
            content={content}
            className="min-h-[200px]"
          />
        </div>
      );
    }
    
    return (
      <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto min-h-[400px]">
        <p className="whitespace-pre-wrap text-gray-700 break-words leading-relaxed">
          {content}
        </p>
      </div>
    );
  };

  const renderImageSection = () => {
    if (!selectedDraft || selectedDraft.post_type === 'newsletter') {
      return null;
    }

    return (
      <div className="mt-4 border-t pt-4 flex-shrink-0">
        <h4 className="text-sm font-medium text-[#3E5A6B] mb-3">Images</h4>
        <ImagePicker
          images={images}
          selected={selectedImageId}
          onSelect={handleImageSelect}
          onRefresh={handleImageRefresh}
          onSearch={handleImageSearch}
          loading={imagesLoading}
        />
        
        {!isInstagram && (
          <div className="flex items-center space-x-2 mt-3">
            <Checkbox
              id="post-without-image"
              checked={postWithoutImage}
              onCheckedChange={(checked) => {
                setPostWithoutImage(!!checked);
                if (checked) setSelectedImageId(null);
              }}
            />
            <label htmlFor="post-without-image" className="text-sm text-gray-600">
              Post without an image
            </label>
          </div>
        )}
        
        {isInstagram && !hasValidImage && (
          <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
            <AlertCircle className="w-4 h-4" />
            Instagram posts need an image.
          </div>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <Card className="h-full flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-[#3E5A6B]">Composer</CardTitle>
            <div className="flex items-center gap-2">
              {selectedDraft && (
                <Badge 
                  variant={isApproved ? 'default' : 'secondary'}
                  className={cn(
                    isApproved && "bg-[#68BEB9] text-white hover:bg-[#56a7a1]"
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
               'Editing draft content'}
            </span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="font-medium text-[#3E5A6B]">Content</h3>
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
              <div className="flex-1 flex flex-col overflow-hidden space-y-4">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="flex-1 min-h-[250px] resize-none"
                  placeholder="Write your content here..."
                />
              
                {renderImageSection()}
              
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
              <div className="flex-1 flex flex-col overflow-hidden">
                {renderContent()}
                {!isEditing && renderImageSection()}
              </div>
            )}

            <div className="mt-4 p-4 border-t flex-shrink-0">
              {!selectedDraft ? (
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
              ) : isScheduled ? (
                <div className="text-center">
                  <div className="text-sm text-gray-600 mb-3">
                    This content is already scheduled for posting.
                  </div>
                  <div className="text-xs text-gray-500">
                    Scheduled for: {relatedScheduledPosts[0] ? format(new Date(relatedScheduledPosts[0].publish_at), 'MMM d, yyyy \'at\' h:mm a') : 'Unknown time'}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-600 mb-3">
                    {isApproved 
                      ? "Ready to schedule! Drag this draft to the Smart-Time Ribbon above." 
                      : "Save your changes or approve when ready to schedule."}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 border-[#68BEB9] text-[#68BEB9] hover:bg-[#68BEB9] hover:text-white"
                      onClick={handleSave}
                      disabled={saving || approving}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {saving ? 'Saving...' : 'Save'}
                    </Button>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button 
                          className={cn(
                            "flex-1 relative",
                            approvalStatus.isDisabled 
                              ? "bg-gray-300 hover:bg-gray-300 text-gray-500 cursor-not-allowed" 
                              : "bg-[#68BEB9] hover:bg-[#56a7a1]"
                          )}
                          onClick={handleApprove}
                          disabled={approvalStatus.isDisabled}
                        >
                          {approvalStatus.isDisabled && approvalStatus.issues.length > 0 && (
                            <AlertCircle className="w-4 h-4 mr-2 text-orange-500" />
                          )}
                          {!approvalStatus.isDisabled && (
                            <CheckCircle className="w-4 h-4 mr-2" />
                          )}
                          {approving ? 'Approving...' : 'Approve & Post'}
                        </Button>
                      </TooltipTrigger>
                      {approvalStatus.tooltipContent && (
                        <TooltipContent side="top" className="max-w-sm">
                          {approvalStatus.tooltipContent}
                        </TooltipContent>
                      )}
                      {!approvalStatus.isDisabled && (
                        <TooltipContent side="top" className="max-w-xs">
                          <div className="text-sm">
                            This will approve your content and make it ready for scheduling in the Smart-Time Ribbon
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};
