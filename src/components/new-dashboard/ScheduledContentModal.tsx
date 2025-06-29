
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, X } from 'lucide-react';
import { FacebookPostPreview } from './FacebookPostPreview';
import { InstagramPostPreview } from './InstagramPostPreview';
import { ImagePicker } from '@/components/composer/ImagePicker';
import { useUnsplash } from '@/hooks/useUnsplash';
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
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { getSmartImages, searchImages, refreshImages, loading: imagesLoading } = useUnsplash();

  useEffect(() => {
    if (scheduledTask?.ai_output) {
      setContent(scheduledTask.ai_output);
      
      // Load existing image attachment
      if (scheduledTask.attachments?.image) {
        const existingImage = scheduledTask.attachments.image;
        setImages([existingImage]);
        setSelectedImageId(existingImage.id);
      } else {
        // Fetch new images based on content
        fetchImagesForContent();
      }
    }
  }, [scheduledTask]);

  const fetchImagesForContent = async () => {
    if (!scheduledTask?.ai_output) return;
    
    const query = extractKeywordsFromContent(scheduledTask.ai_output);
    const fetchedImages = await getSmartImages(query);
    setImages(fetchedImages);
    
    // Auto-select first image
    if (fetchedImages.length > 0) {
      setSelectedImageId(fetchedImages[0].id);
    }
  };

  const extractKeywordsFromContent = (content: string): string => {
    const words = content
      .replace(/<[^>]*>/g, ' ')
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 3);
    
    return words.join(' ') || scheduledTask?.post_type || 'business';
  };

  const handleImageSelect = (imageId: string) => {
    setSelectedImageId(imageId);
  };

  const handleImageRefresh = async () => {
    if (!scheduledTask?.ai_output) return;
    const query = extractKeywordsFromContent(scheduledTask.ai_output);
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
    if (!scheduledTask || !content.trim()) return;

    setSaving(true);
    try {
      const selectedImage = getSelectedImage();
      const attachments = selectedImage ? { image: selectedImage } : null;

      const { error } = await supabase
        .from('content_tasks')
        .update({ 
          ai_output: content,
          attachments
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
  const selectedImage = getSelectedImage();
  const imageForPreview = selectedImage ? {
    url: selectedImage.url,
    alt: selectedImage.alt
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
              <ImagePicker
                images={images}
                selected={selectedImageId}
                onSelect={handleImageSelect}
                onRefresh={handleImageRefresh}
                onSearch={handleImageSearch}
                loading={imagesLoading}
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
