import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { ImageGalleryBlockEditor } from './ImageGalleryBlockEditor';
import { ImageGalleryBlockPreview } from './ImageGalleryBlockPreview';
import { ProductGalleryBlock } from '../ProductGalleryBlock';

interface ImageGalleryBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
  isGenerating?: boolean;
}

/**
 * Determines if the block should render as a Product Gallery (2x2 grid with badges)
 * vs the standard Image Gallery (3/6/9 images grid)
 */
function isProductGalleryMode(block: ContentBlock): boolean {
  // If galleryItems array exists and has items, or galleryImages is empty,
  // and we have no galleryLayout set to image gallery layouts, use product mode
  const hasGalleryItems = Array.isArray(block.galleryItems) && block.galleryItems.length > 0;
  const hasGalleryImages = Array.isArray((block as any).galleryImages) && (block as any).galleryImages.length > 0;
  
  // Product gallery mode if we have galleryItems OR if both are empty and no gallery layout
  if (hasGalleryItems) return true;
  if (hasGalleryImages) return false;
  
  // Check if this was explicitly set up as product gallery (by checking for typical product fields)
  // If neither has content, default to product gallery for new blocks with headline/body set
  return !!(block.headline || block.body) && !(block as any).galleryLayout;
}

export const ImageGalleryBlock: React.FC<ImageGalleryBlockProps> = ({
  block,
  onUpdate,
  isPreview = false,
  isGenerating = false,
}) => {
  // Detect if this should render as product gallery
  if (isProductGalleryMode(block)) {
    return (
      <ProductGalleryBlock
        block={block}
        onUpdate={onUpdate}
        isPreview={isPreview}
        isGenerating={isGenerating}
      />
    );
  }

  // Standard image gallery mode
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
