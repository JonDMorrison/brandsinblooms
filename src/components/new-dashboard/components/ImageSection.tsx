
import React from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, AlertCircle } from 'lucide-react';
import { ImagePicker } from '@/components/composer/ImagePicker';

interface ImageSectionProps {
  selectedDraft: any;
  images: any[];
  selectedImageId: string | null;
  postWithoutImage: boolean;
  setPostWithoutImage: (value: boolean) => void;
  imagesFetching: boolean;
  imagesLoading: boolean;
  imageError: string | null;
  hasValidImage: boolean;
  onImageSelect: (imageId: string) => void;
  onImageRefresh: () => void;
  onImageSearch: (query: string) => void;
  onFetchImages: () => void;
}

export const ImageSection = ({
  selectedDraft,
  images,
  selectedImageId,
  postWithoutImage,
  setPostWithoutImage,
  imagesFetching,
  imagesLoading,
  imageError,
  hasValidImage,
  onImageSelect,
  onImageRefresh,
  onImageSearch,
  onFetchImages
}: ImageSectionProps) => {
  if (!selectedDraft || selectedDraft.post_type === 'newsletter') {
    return null;
  }

  const isInstagram = selectedDraft.post_type?.toLowerCase().includes('instagram');
  const isLoadingImages = imagesFetching || imagesLoading;

  return (
    <div className="mt-4 border-t pt-4 flex-shrink-0">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-[#3E5A6B]">Images</h4>
        {isLoadingImages && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading images...
          </div>
        )}
      </div>
      
      {imageError && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {imageError}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onFetchImages}
            className="ml-2 h-auto p-1 text-red-600 hover:text-red-700"
          >
            Retry
          </Button>
        </div>
      )}
      
      <ImagePicker
        images={images}
        selected={selectedImageId}
        onSelect={onImageSelect}
        onRefresh={onImageRefresh}
        onSearch={onImageSearch}
        loading={isLoadingImages}
      />
      
      {!isInstagram && (
        <div className="flex items-center space-x-2 mt-3">
          <Checkbox
            id="post-without-image"
            checked={postWithoutImage}
            onCheckedChange={(checked) => {
              setPostWithoutImage(!!checked);
              if (checked) onImageSelect('');
            }}
          />
          <label htmlFor="post-without-image" className="text-sm text-gray-600">
            Post without an image
          </label>
        </div>
      )}
      
      {isInstagram && !hasValidImage && !isLoadingImages && (
        <div className="flex items-center gap-2 text-red-600 text-sm mt-2">
          <AlertCircle className="w-4 h-4" />
          Instagram posts need an image.
        </div>
      )}
    </div>
  );
};
