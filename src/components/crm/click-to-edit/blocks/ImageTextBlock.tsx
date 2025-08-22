import React from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';
import { SafeHtml } from '@/components/ui/safe-html';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
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
  const isImageLeft = block.layout === 'image-left';

  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    if (mode === 'image') {
      // For image mode, trigger the modal opening
      onModeChange?.('image');
    } else {
      onModeChange?.(editMode === mode ? null : mode);
    }
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
          isImageLeft && "md:order-2",
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
            content={(() => {
              // Handle both object-style content and direct properties
              let headline;
              if (typeof block.content === 'object' && block.content && (block.content as any).headline) {
                headline = (block.content as any).headline;
              } else if (block.headline) {
                headline = block.headline;
              } else if (block.title) {
                headline = block.title; // Fallback for newsletter conversion
              } else {
                headline = 'Add headline';
              }
              const headlineText = typeof headline === 'string' ? headline : String(headline || 'Add headline');
              return sanitizeWeekNumbers(headlineText);
            })()}
            type="newsletter"
            className="text-2xl font-bold"
          />
          
          {/* Body text */}
          <SafeHtml 
            content={(() => {
              // Handle both object-style content and direct properties
              // Prioritize non-empty content
              let body = '';
              
              if (typeof block.content === 'object' && block.content && (block.content as any).body) {
                body = (block.content as any).body;
              } else if (block.body && block.body.trim()) {
                body = block.body;
              } else if (typeof block.content === 'string' && block.content.trim()) {
                body = block.content;
              }
              
              const bodyText = body || 'Add body text';
              return sanitizeWeekNumbers(bodyText);
            })()}
            type="newsletter"
            className="text-muted-foreground"
          />
        </div>

        {/* Image */}
        <div className={cn(
          isImageLeft && "md:order-1", 
          "relative group/image cursor-pointer",
          "hover:opacity-90 transition-opacity duration-200"
        )}
        onClick={(e) => {
          e.stopPropagation();
          if (onModeChange) {
            handleModeClick('image', e);
          }
        }}
        >
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
          
          {(() => {
            // Derive image source from multiple possible locations
            const imageSrc = block.imageUrl || 
                           (typeof block.content === 'object' && block.content && (block.content as any).imageUrl) || 
                           '';
            
            return imageSrc ? (
              <img 
                src={imageSrc}
                alt={block.altText || 'Content image'}
                className="w-full h-auto rounded-lg cursor-pointer"
              />
            ) : (
              <div 
                className="w-full h-48 bg-muted rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors p-4"
              >
                <span className="text-muted-foreground mb-3">Click to add image</span>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onModeChange) {
                        handleModeClick('image', e);
                      }
                    }}
                    className="px-3 py-1 text-xs bg-background border border-border rounded hover:bg-muted transition-colors"
                  >
                    Browse
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      // Auto-pick image based on content
                      const headline = (() => {
                        if (typeof block.content === 'object' && block.content && (block.content as any).headline) {
                          return (block.content as any).headline;
                        } else if (block.headline) {
                          return block.headline;
                        } else if (block.title) {
                          return block.title;
                        }
                        return 'garden plants';
                      })();
                      
                      const { fetchSmartImage } = await import('@/services/unsplashService');
                      const imageData = await fetchSmartImage(headline, '', true);
                      
                      if (imageData?.url && onUpdate) {
                        onUpdate({
                          imageUrl: imageData.url,
                          altText: imageData.alt
                        });
                      }
                    }}
                    className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                  >
                    Auto-pick
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
};