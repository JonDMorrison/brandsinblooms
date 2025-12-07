import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { ImageGalleryBlockEditor } from './ImageGalleryBlockEditor';
import { ImageGalleryBlockPreview } from './ImageGalleryBlockPreview';

interface ImageGalleryBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
  isGenerating?: boolean;
}

export const ImageGalleryBlock: React.FC<ImageGalleryBlockProps> = ({
  block,
  onUpdate,
  isPreview = false,
  isGenerating = false,
}) => {
  if (isPreview) {
    return (
      <ImageGalleryBlockPreview 
        block={block} 
        onUpdate={onUpdate}
        isGenerating={isGenerating}
      />
    );
  }

  return (
    <ImageGalleryBlockEditor 
      block={block} 
      onUpdate={onUpdate}
      isGenerating={isGenerating}
    />
  );
};

export default ImageGalleryBlock;
