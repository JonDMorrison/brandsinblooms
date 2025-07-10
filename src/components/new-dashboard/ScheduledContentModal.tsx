
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, X } from 'lucide-react';
import { FacebookPostPreview } from './FacebookPostPreview';
import { InstagramPostPreview } from './InstagramPostPreview';
import { ImageSelectButton } from '@/components/image';
import { ImageAttachment } from '@/lib/contentTypes';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ScheduledContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  scheduledTask: any;
  onUpdate?: () => void;
}

export const ScheduledContentModal = ({ 
  isOpen, 
  onClose, 
  scheduledTask,
  onUpdate 
}: ScheduledContentModalProps) => {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);

  

  useEffect(() => {
    if (scheduledTask?.ai_output) {
      setContent(scheduledTask.ai_output);
      
      // The UniversalImageSelector handles all image management now
    }
  }, [scheduledTask]);


  const handleSave = async () => {
    if (!scheduledTask || !content.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: content
        })
        .eq('id', scheduledTask.id);

      if (error) throw error;

      toast.success('Content updated successfully');
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating content:', error);
      toast.error('Failed to update content');
    } finally {
      setSaving(false);
    }
  };

  if (!scheduledTask) return null;

  const isInstagram = scheduledTask.post_type?.toLowerCase().includes('instagram');
  const imageForPreview = scheduledTask.attachments?.[0] ? {
    url: scheduledTask.attachments[0].url,
    alt: scheduledTask.attachments[0].alt
  } : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Edit {scheduledTask.post_type || 'Post'}</span>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Preview Section */}
          <div className="space-y-4">
            <h3 className="font-medium text-[#3E5A6B]">Preview</h3>
            {isInstagram ? (
              <InstagramPostPreview 
                content={content}
                image={imageForPreview}
              />
            ) : (
              <FacebookPostPreview 
                content={content}
                image={imageForPreview}
                scheduledTime={scheduledTask.scheduled_date}
              />
            )}
          </div>

          {/* Edit Section */}
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-medium text-[#3E5A6B]">Content</h3>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[120px] resize-none"
                placeholder="Write your content here..."
              />
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-[#3E5A6B]">Images</h3>
              <ImageSelectButton
                onImageSelect={async (imageUrl, metadata) => {
                  console.log('Image selected in scheduled modal:', imageUrl);
                  // The component handles database updates internally for tasks
                }}
                contentContext={scheduledTask?.ai_output}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !content.trim()}
                className="bg-[#68BEB9] hover:bg-[#56a7a1]"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
