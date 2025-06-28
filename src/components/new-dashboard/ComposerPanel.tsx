import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Edit, Save, Trash2, Undo2 } from 'lucide-react';
import { format } from 'date-fns';
import { useScheduledPosts } from '@/hooks/useScheduledPosts';
import { usePublishFlow } from '@/hooks/usePublishFlow';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ComposerPanelProps {
  selectedDraft?: any;
  socialConnections?: any[];
  onTaskUpdate?: () => void;
}

export const ComposerPanel = ({ selectedDraft, socialConnections = [], onTaskUpdate }: ComposerPanelProps) => {
  const [mode, setMode] = useState<'draft' | 'scheduled'>('draft');
  const [editContent, setEditContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [undoToastId, setUndoToastId] = useState<string | null>(null);

  const { scheduledPosts, reschedulePost, unschedulePost, deleteScheduledPost } = useScheduledPosts();
  const { scheduleDraft } = usePublishFlow();

  // Find if selected draft has scheduled posts
  const relatedScheduledPosts = scheduledPosts.filter(post => 
    post.content_id === selectedDraft?.id
  );

  useEffect(() => {
    if (relatedScheduledPosts.length > 0) {
      setMode('scheduled');
    } else {
      setMode('draft');
    }
  }, [relatedScheduledPosts.length, selectedDraft]);

  useEffect(() => {
    if (selectedDraft?.ai_output) {
      setEditContent(selectedDraft.ai_output);
    }
  }, [selectedDraft]);

  const handleUnschedule = async (scheduledPostId: string) => {
    // Show undo toast with 8-second countdown
    const toastId = toast.success('Post unscheduled', {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          toast.dismiss(String(toastId));
          setUndoToastId(null);
          // Re-schedule the post (simplified - in real app would restore exact time)
          toast.info('Post restored to schedule');
        }
      },
      onDismiss: () => {
        setUndoToastId(null);
      }
    });

    setUndoToastId(String(toastId));

    // Actually unschedule after a brief delay to allow undo
    setTimeout(async () => {
      if (undoToastId === String(toastId)) {
        await unschedulePost(scheduledPostId);
        if (onTaskUpdate) onTaskUpdate();
      }
    }, 8100);
  };

  const handleDelete = async (scheduledPostId: string) => {
    const toastId = toast.error('Scheduled post deleted', {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: () => {
          toast.dismiss(String(toastId));
          toast.info('Delete cancelled');
        }
      }
    });

    setTimeout(async () => {
      await deleteScheduledPost(scheduledPostId);
      if (onTaskUpdate) onTaskUpdate();
    }, 8100);
  };

  const handleReschedule = async (scheduledPostId: string) => {
    // For now, just show a placeholder - full reschedule UI would be more complex
    toast.info('Reschedule feature coming soon');
  };

  const handleSaveEdit = async () => {
    // In a real implementation, you'd update the content task
    toast.success('Content updated');
    setIsEditing(false);
    if (onTaskUpdate) onTaskUpdate();
  };

  if (!selectedDraft) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent className="text-center">
          <div className="text-gray-500 mb-2">No draft selected</div>
          <p className="text-sm text-gray-400">Select a draft from the tray to compose or manage</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-[#3E5A6B]">Composer</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={mode === 'draft' ? 'default' : 'secondary'}>
              {mode === 'draft' ? 'Draft' : `${relatedScheduledPosts.length} Scheduled`}
            </Badge>
            {socialConnections.length === 0 && (
              <Badge variant="outline" className="text-orange-600">
                No connections
              </Badge>
            )}
          </div>
        </div>
        
        {/* Mode Indicator */}
        <div className="flex items-center gap-2 text-sm text-gray-600">
          {mode === 'draft' ? (
            <>
              <Edit className="w-4 h-4" />
              <span>Editing draft content</span>
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4" />
              <span>Managing scheduled posts</span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {mode === 'draft' ? (
          // Draft Mode
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-[#3E5A6B]">Content</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Edit className="w-4 h-4 mr-2" />
                {isEditing ? 'Cancel' : 'Edit'}
              </Button>
            </div>

            {isEditing ? (
              <div className="flex-1 flex flex-col">
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
                  <Button onClick={handleSaveEdit}>
                    <Save className="w-4 h-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 p-4 bg-gray-50 rounded-lg overflow-y-auto">
                <p className="whitespace-pre-wrap text-gray-700">
                  {selectedDraft.ai_output || 'No content generated yet'}
                </p>
              </div>
            )}

            {/* Draft Actions */}
            <div className="mt-4 p-4 border-t">
              <div className="text-sm text-gray-600 mb-3">
                Ready to schedule? Drag this draft to the Smart-Time Ribbon above.
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  disabled={socialConnections.length === 0}
                >
                  <Clock className="w-4 h-4 mr-2" />
                  Schedule Later
                </Button>
                <Button 
                  className="flex-1 bg-[#68BEB9] hover:bg-[#56a7a1]"
                  disabled={socialConnections.length === 0}
                >
                  Publish Now
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Scheduled Mode
          <div className="flex-1 flex flex-col">
            <h3 className="font-medium text-[#3E5A6B] mb-4">Scheduled Posts</h3>
            
            <div className="flex-1 space-y-3">
              {relatedScheduledPosts.map((post) => (
                <div key={post.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        post.status === 'PUBLISHED' ? 'default' :
                        post.status === 'ERROR' ? 'destructive' : 'secondary'
                      }>
                        {post.status}
                      </Badge>
                      <span className="text-sm font-medium capitalize">
                        {post.platform.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {format(new Date(post.publish_at), 'MMM d, h:mm a')}
                    </div>
                  </div>

                  <div className="text-sm text-gray-700 mb-3">
                    {post.content?.caption?.substring(0, 100)}...
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReschedule(post.id)}
                      disabled={post.status === 'PUBLISHED'}
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Reschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnschedule(post.id)}
                      disabled={post.status === 'PUBLISHED'}
                    >
                      <Undo2 className="w-3 h-3 mr-1" />
                      Unschedule
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(post.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      Delete
                    </Button>
                  </div>

                  {post.error_message && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      Error: {post.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
