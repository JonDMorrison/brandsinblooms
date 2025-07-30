import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';
import { SafeHtml } from '@/components/ui/safe-html';
import { ContextualEditButton } from '../contextual/ContextualEditButton';
import { EditMode } from '@/hooks/useBlockEditMode';

interface ImageTextBlockProps {
  block: ContentBlock;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
}

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({ 
  block, 
  onUpdate, 
  isPreview = true, 
  editMode,
  onModeChange 
}) => {
  const isImageLeft = block.layout === 'image-left' || !block.layout;

  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    onModeChange?.(editMode === mode ? null : mode);
  };

  // Always render as preview - editing is handled by the new mode system
  return (
    <div 
      className="relative p-6 rounded-lg group"
      style={{ backgroundColor: block.backgroundColor || 'transparent' }}
    >
      <div className={cn(
        "grid gap-6 items-center",
        isImageLeft ? "md:grid-cols-2" : "md:grid-cols-2"
      )}>
        {/* Content - shown first on mobile, positioned based on layout on desktop */}
        <div className={cn(
          "space-y-4 relative group/text",
          !isImageLeft && "md:order-1",
          block.textAlign === 'center' && "text-center",
          block.textAlign === 'right' && "text-right",
          "hover:bg-background/50 rounded-md transition-colors duration-200 p-2 -m-2"
        )}>
          {/* Contextual Text Edit Button */}
          {onModeChange && (
            <ContextualEditButton
              mode="text"
              isActive={editMode === 'text'}
              onClick={(e) => handleModeClick('text', e)}
              variant="text"
              position="top-right"
              className="group-hover/text:opacity-100"
            />
          )}
          
          {/* Headline */}
          <SafeHtml 
            content={
              (typeof block.content === 'object' && block.content && (block.content as any).headline) || 
              block.headline || 
              'Add headline'
            }
            type="newsletter"
            className="text-2xl font-bold"
          />
          
          {/* Body text */}
          <SafeHtml 
            content={
              (typeof block.content === 'object' && block.content && (block.content as any).body) || 
              block.body || 
              'Add body text'
            }
            type="newsletter"
            className="text-muted-foreground"
          />
        </div>

        {/* Image */}
        <div className={cn(
          !isImageLeft && "md:order-2", 
          "relative group/image",
          "hover:opacity-90 transition-opacity duration-200"
        )}>
          {/* Contextual Image Edit Button */}
          {onModeChange && (
            <ContextualEditButton
              mode="image"
              isActive={editMode === 'image'}
              onClick={(e) => handleModeClick('image', e)}
              variant="image"
              position="top-right"
              className="group-hover/image:opacity-100"
            />
          )}
          
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