import React, { useEffect, useState, useCallback } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';
import { SafeHtml } from '@/components/ui/safe-html';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { ContextualEditButton } from '../contextual/ContextualEditButton';
import { EditMode } from '@/hooks/useBlockEditMode';
import { CTAButton } from '@/components/ui/CTAButton';
import { BlockGeneratingOverlay } from './BlockGeneratingOverlay';
import { mediaSelector } from '@/utils/mediaSelector';
import { extractImageSummaryWithContext } from '@/utils/imageContentSummary';
import { useUnsplash } from '@/hooks/useUnsplash';
import { ImageSkeleton } from '@/components/ui/image-skeleton';
import { Image as ImageIcon } from 'lucide-react';

interface ImageTextBlockProps {
  block: ContentBlock;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  isGenerating?: boolean;
}

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({ 
  block, 
  onUpdate, 
  isPreview = true, 
  editMode,
  onModeChange,
  isGenerating = false
}) => {
  const { getCuratedCollectionImages } = useUnsplash();
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasImageLoaded, setHasImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  // Auto-fetch image for blocks that don't have an image
  useEffect(() => {
    if (!block.imageUrl && onUpdate) {
      setIsImageLoading(true);
      setImageError(false);
      setHasImageLoaded(false);
      
      const contentForImage = (() => {
        if (typeof block.content === 'object' && block.content && (block.content as any).headline) {
          return (block.content as any).headline;
        } else if (block.headline) {
          return block.headline;
        } else if (block.title) {
          return block.title;
        } else if (typeof block.content === 'string') {
          return block.content;
        }
        return null;
      })();

      if (contentForImage) {
        console.log('[ImageTextBlock] Auto-fetching image for content:', contentForImage);
        
        // Use smart content summary for better image selection
        const smartSummary = extractImageSummaryWithContext(contentForImage, true);
        console.log('[ImageTextBlock] Using smart summary:', smartSummary);
        
        // Try media selector first with smart summary
        mediaSelector({ 
          prompt: smartSummary,
          fallback: '/images/newsletter-fallback.jpg' 
        }).then((result) => {
          console.log('[ImageTextBlock] Auto-fetched image:', result.url);
          onUpdate({ 
            imageUrl: result.url,
            altText: result.alt || 'Auto-selected image'
          });
        }).catch(async (error) => {
          console.error('[ImageTextBlock] Media selector failed, trying curated collection:', error);
          
          // Fallback to curated collection
          try {
            const curatedImages = await getCuratedCollectionImages(1);
            if (curatedImages.length > 0) {
              console.log('[ImageTextBlock] Using curated collection image');
              onUpdate({ 
                imageUrl: curatedImages[0].download_url,
                altText: curatedImages[0].alt || 'Garden center image'
              });
            }
          } catch (curatedError) {
            console.error('[ImageTextBlock] Curated collection also failed:', curatedError);
            setIsImageLoading(false);
          }
        });
      } else {
        setIsImageLoading(false);
      }
    }
  }, [block.imageUrl, block.headline, block.title, block.content, onUpdate, getCuratedCollectionImages]);

  // Handle image loading states when imageUrl changes
  useEffect(() => {
    if (block.imageUrl) {
      setIsImageLoading(true);
      setImageError(false);
      setHasImageLoaded(false);
      
      const img = new Image();
      img.onload = () => {
        setIsImageLoading(false);
        setHasImageLoaded(true);
        setImageError(false);
      };
      img.onerror = () => {
        setIsImageLoading(false);
        setHasImageLoaded(false);
        setImageError(true);
      };
      img.src = block.imageUrl;
    } else {
      setIsImageLoading(false);
      setHasImageLoaded(false);
      setImageError(false);
    }
  }, [block.imageUrl]);

  const isImageLeft = block.layout === 'image-left' || block.layout === 'two-column-left';
  const isImageRight = block.layout === 'image-right' || block.layout === 'two-column-right';
  const isTextOnly = block.layout === 'full-width' || block.type === 'text';

  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    if (mode === 'image') {
      // For image mode, trigger the modal opening
      onModeChange?.('image');
    } else {
      onModeChange?.(editMode === mode ? null : mode);
    }
  };

  // Check if block is truly empty
  const isEmpty = !block.imageUrl && 
                  !block.headline && 
                  !block.title && 
                  (!block.body || block.body.trim() === '') &&
                  (!block.content || typeof block.content === 'string' && block.content.trim() === '') &&
                  (typeof block.content === 'object' && block.content && 
                   !(block.content as any).headline && 
                   (!(block.content as any).body || (block.content as any).body.trim() === ''));

  return (
    <div 
      className={cn(
        "relative p-6 rounded-lg group",
        isEmpty && "border-2 border-dashed border-muted-foreground/30 bg-muted/20"
      )}
      style={{ backgroundColor: isEmpty ? 'transparent' : (block.backgroundColor || 'transparent') }}
    >
      {/* Show generating overlay for empty blocks being enhanced with AI */}
      {isGenerating && isEmpty && (
        <BlockGeneratingOverlay 
          message="Creating content for this section..." 
        />
      )}
      {isEmpty && (
        <div className="text-center text-muted-foreground py-8">
          <p className="text-sm">Empty image & text block</p>
          <p className="text-xs mt-1">Click to edit or hover to delete</p>
        </div>
      )}
      
      {!isEmpty && (
        <div className={cn(
          "grid gap-6 items-center",
          (isImageLeft || isImageRight) && !isTextOnly ? "md:grid-cols-2" : "md:grid-cols-1"
        )}>
          {/* Content - shown first on mobile, positioned based on layout on desktop */}
          <div className={cn(
            "space-y-4 relative group/text",
            isImageLeft && !isTextOnly && "md:order-2",
            isImageRight && !isTextOnly && "md:order-1",
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
            
            {/* CTA Button */}
            <CTAButton block={block} />
          </div>

          {/* Image - only render for image-text layouts */}
          {!isTextOnly && (
            <div className={cn(
              isImageLeft && "md:order-1",
              isImageRight && "md:order-2", 
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
                  <div className="relative">
                    {/* Show skeleton while loading */}
                    {isImageLoading && (
                      <ImageSkeleton className="absolute inset-0 z-10" />
                    )}
                    
                    {/* Main image with fade-in effect */}
                    <img 
                      src={imageSrc}
                      alt={block.altText || 'Content image'}
                      className={cn(
                        "w-full h-auto rounded-lg cursor-pointer transition-opacity duration-300",
                        isImageLoading || !hasImageLoaded ? "opacity-0" : "opacity-100"
                      )}
                      onLoad={() => {
                        setIsImageLoading(false);
                        setHasImageLoaded(true);
                        setImageError(false);
                      }}
                      onError={() => {
                        console.error('[ImageTextBlock] Image failed to load:', imageSrc);
                        setIsImageLoading(false);
                        setHasImageLoaded(false);
                        setImageError(true);
                      }}
                    />
                    
                    {/* Error fallback */}
                    {imageError && !isImageLoading && (
                      <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center text-muted-foreground">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
                          <span className="text-sm">Image unavailable</span>
                          <p className="text-xs mt-1">Click to choose another</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div 
                    className="w-full h-48 bg-muted rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors p-4"
                  >
                    {isImageLoading ? (
                      <ImageSkeleton className="w-full h-full" />
                    ) : (
                      <>
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
                              setIsImageLoading(true);
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
                              
                              try {
                                const { fetchSmartImage } = await import('@/services/unsplashService');
                                const imageData = await fetchSmartImage(headline, '', true);
                                
                                if (imageData?.url && onUpdate) {
                                  onUpdate({
                                    imageUrl: imageData.url,
                                    altText: imageData.alt
                                  });
                                }
                              } catch (error) {
                                console.error('[ImageTextBlock] Auto-pick failed:', error);
                                setIsImageLoading(false);
                              }
                            }}
                            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
                          >
                            Auto-pick
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
};