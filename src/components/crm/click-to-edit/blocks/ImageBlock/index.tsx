import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { ImageBlockEditor } from './ImageBlockEditor';
import { ImageBlockPreview } from './ImageBlockPreview';

interface ImageBlockProps {
  block: ContentBlock;
  onUpdate: (updates: Partial<ContentBlock>) => void;
  isPreview: boolean;
}

export const ImageBlock: React.FC<ImageBlockProps> = ({ block, onUpdate, isPreview }) => {
  if (isPreview) {
    return <ImageBlockPreview block={block} onUpdate={onUpdate} />;
  }

  return <ImageBlockEditor block={block} onUpdate={onUpdate} />;
};