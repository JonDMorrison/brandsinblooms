import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';

interface ImageTextBlockProps {
  block: ContentBlock;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
}

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({ block, onUpdate, isPreview = true }) => {
  const isImageLeft = block.layout === 'image-left' || !block.layout;

  // Always render as preview - editing is handled by the new mode system
  return (
    <div 
      className="relative p-6 rounded-lg"
      style={{ backgroundColor: block.backgroundColor || 'transparent' }}
    >
      <div className={cn(
        "grid gap-6 items-center",
        isImageLeft ? "md:grid-cols-2" : "md:grid-cols-2"
      )}>
        {/* Content - shown first on mobile, positioned based on layout on desktop */}
        <div className={cn(
          "space-y-4",
          !isImageLeft && "md:order-1",
          block.textAlign === 'center' && "text-center",
          block.textAlign === 'right' && "text-right"
        )}>
          {/* Headline */}
          <h2 className="text-2xl font-bold">
            {block.headline || 'Add headline'}
          </h2>
          
          {/* Body text */}
          <div className="text-muted-foreground whitespace-pre-wrap">
            {block.body || 'Add body text'}
          </div>
        </div>

        {/* Image */}
        <div className={cn(!isImageLeft && "md:order-2", "relative")}>
          {block.imageUrl ? (
            <img 
              src={block.imageUrl}
              alt={block.altText || 'Content image'}
              className="w-full h-auto rounded-lg"
            />
          ) : (
            <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
              <span className="text-muted-foreground">Click Edit Image to add</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};