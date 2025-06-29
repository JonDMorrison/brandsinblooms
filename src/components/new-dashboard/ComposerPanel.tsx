
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Edit, Save, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { usePublishFlow } from '@/hooks/usePublishFlow';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { NewsletterPreview } from '@/components/newsletter/NewsletterPreview';
import { supabase } from '@/integrations/supabase/client';

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

  const { scheduledPosts } = useScheduledPosts();

  // Find if selected draft has scheduled posts
  const relatedScheduledPosts = scheduledPosts.filter(post => 
    post.content_id === selectedDraft?.id
  );

  const isScheduled = relatedScheduledPosts.length > 0;
  const isApproved = selectedDraft?.status === 'approved';
  const isDraft = selectedDraft?.status === 'draft' || selectedDraft?.status === 'generated';

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setEditContent(selectedDraft.ai_output);
    }
  }, [selectedDraft]);

  const handleSave = async () => {
    if (!selectedDraft || !editContent.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: editContent,
          status: 'draft'
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

    setApproving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: editContent,
          status: 'approved'
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
        <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto flex items-center justify-center">
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
        <div className="flex-1 overflow-y-auto">
          <NewsletterPreview 
            content={content}
            className="min-h-[200px]"
          />
        </div>
      );
    }
    
    // Regular content display for other post types
    return (
      <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto">
        <p className="whitespace-pre-wrap text-gray-700 break-words">
          {content}
        </p>
      </div>
    );
  };

  return (
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
        
        {/* Mode Indicator */}
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
          <div className="flex items-center justify-between mb-4">
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
            <div className="flex-1 flex flex-col overflow-hidden">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 min-h-[200px] resize-none"
                placeholder="Write your content here..."
              />
              <div className="flex justify-end gap-2 mt-4">
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
            renderContent()
          )}

          {/* Action Bar - Always visible but content changes based on state */}
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
                  <Button 
                    className="flex-1 bg-gray-300 text-gray-500"
                    disabled
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve & Post
                  </Button>
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
                    disabled={saving || approving || socialConnections.length === 0}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button 
                    className="flex-1 bg-[#68BEB9] hover:bg-[#56a7a1]"
                    onClick={handleApprove}
                    disabled={saving || approving || socialConnections.length === 0}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {approving ? 'Approving...' : 'Approve & Post'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
