
import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';
import { UniversalImageSelector } from '@/components/publish/EnhancedImageSelector';

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
      
      <UniversalImageSelector
        task={selectedDraft}
        onImageChange={(imageUrl) => {
          console.log('Image selected in composer:', imageUrl);
          // The component handles database updates internally for tasks
        }}
        contentContext={selectedDraft?.ai_output}
        showTabs={true}
        defaultTab="find"
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
