import React from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { ImageGalleryBlockEditor } from "./ImageGalleryBlockEditor";
import { ImageGalleryBlockPreview } from "./ImageGalleryBlockPreview";

interface ImageGalleryBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onClose?: () => void;
  onCancel?: () => void;
  isPreview?: boolean;
  isGenerating?: boolean;
}

export const ImageGalleryBlock: React.FC<ImageGalleryBlockProps> = ({
  block,
  onUpdate,
  onClose,
  onCancel,
  isPreview = false,
  isGenerating = false,
}) => {
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
      onClose={onClose}
      onCancel={onCancel}
      isGenerating={isGenerating}
    />
  );
};

export default ImageGalleryBlock;
