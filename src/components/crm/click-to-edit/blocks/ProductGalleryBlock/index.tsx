import React from "react";
import { ContentBlock } from "@/types/emailBuilder";
import { ProductGalleryBlockEditor } from "./ProductGalleryBlockEditor";
import { ProductGalleryBlockPreview } from "./ProductGalleryBlockPreview";

interface ProductGalleryBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  onClose?: () => void;
  onCancel?: () => void;
  isPreview?: boolean;
  isGenerating?: boolean;
}

export const ProductGalleryBlock: React.FC<ProductGalleryBlockProps> = ({
  block,
  onUpdate,
  onClose,
  onCancel,
  isPreview = false,
  isGenerating = false,
}) => {
  if (isPreview) {
    return (
      <ProductGalleryBlockPreview
        block={block}
        onUpdate={onUpdate}
        isGenerating={isGenerating}
      />
    );
  }

  return (
    <ProductGalleryBlockEditor
      block={block}
      onUpdate={onUpdate}
      onClose={onClose}
      onCancel={onCancel}
      isGenerating={isGenerating}
    />
  );
};

export default ProductGalleryBlock;
