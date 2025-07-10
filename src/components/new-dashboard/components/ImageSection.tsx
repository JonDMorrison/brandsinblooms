
import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';
import { ImageSelectButton } from '@/components/image';

interface ImageSectionProps {
  selectedDraft: any;
  postWithoutImage: boolean;
  setPostWithoutImage: (value: boolean) => void;
  hasValidImage: boolean;
}

export const ImageSection = ({
  selectedDraft,
  postWithoutImage,
  setPostWithoutImage,
  hasValidImage
}: ImageSectionProps) => {
  if (!selectedDraft || selectedDraft.post_type === 'newsletter') {
    return null;
  }

  const isInstagram = selectedDraft.post_type?.toLowerCase().includes('instagram');

  return (
    <div className="mt-4 border-t pt-4 flex-shrink-0">
      <div className="mb-3">
        <h4 className="text-sm font-medium text-[#3E5A6B]">Images</h4>
      </div>
      
      <ImageSelectButton
        mode="inline"
        onImageSelect={async (imageUrl, metadata) => {
          console.log('Image selected in composer:', imageUrl, metadata);
          
          // Update the task with the new image
          if (selectedDraft?.id) {
            const currentAttachment = selectedDraft.attachments?.[0];
            const isDifferentImage = !currentAttachment || currentAttachment.url !== imageUrl;
            
            // If it's a different image and task is currently approved, set to review
            const shouldRequireReApproval = isDifferentImage && selectedDraft.status === 'approved';
            
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
              ]
            };

            // If changing image on approved content, require re-approval
            if (shouldRequireReApproval) {
              updateData.status = 'review';
            }

            try {
              const { supabase } = await import('@/integrations/supabase/client');
              const { error } = await supabase
                .from('content_tasks')
                .update(updateData)
                .eq('id', selectedDraft.id);

              if (error) throw error;

              // Trigger refresh
              window.dispatchEvent(new CustomEvent('draft-updated'));
            } catch (error) {
              console.error('Error updating image:', error);
            }
          }
        }}
        selectedImageUrl={selectedDraft?.attachments?.[0]?.url}
        contentContext={selectedDraft?.ai_output}
        buttonText="Choose an Image"
      />
      
      {!isInstagram && (
        <div className="flex items-center space-x-2 mt-3">
          <Checkbox
            id="post-without-image"
            checked={postWithoutImage}
            onCheckedChange={(checked) => {
              setPostWithoutImage(!!checked);
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
