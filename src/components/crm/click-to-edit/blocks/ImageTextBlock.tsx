import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';
import { SafeHtml } from '@/components/ui/safe-html';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { ContextualEditButton } from '../contextual/ContextualEditButton';
import { EditMode } from '@/hooks/useBlockEditMode';
import { CTAButton } from '@/components/ui/CTAButton';
import { BlockGeneratingOverlay } from './BlockGeneratingOverlay';

import { ImageSkeleton } from '@/components/ui/image-skeleton';
import { TextContentSkeleton } from '@/components/ui/text-content-skeleton';
import { Image as ImageIcon } from 'lucide-react';
import { useBlockImageGeneration } from '@/hooks/useBlockImageGeneration';
import { AIImageLoadingOverlay } from '@/components/ui/AIImageLoadingOverlay';

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
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasImageLoaded, setHasImageLoaded] = useState(!!block.imageUrl);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(block.imageUrl);
  const [contentStable, setContentStable] = useState(false);
  
  // PHASE 6: Content persistence checkpoint - store last known good content
  const lastKnownContentRef = useRef<{ headline?: string; body?: string }>({});
  
  // Extract content for image generation
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
    return '';
  })();

  // Use AI image generation hook
  const { isGeneratingImage } = useBlockImageGeneration({
    blockId: block.id,
    blockType: block.type,
    content: contentForImage,
    currentImageUrl: block.imageUrl,
    isContentGenerating: isGenerating,
    onImageReady: (imageUrl, metadata) => {
      onUpdate?.({
        imageUrl,
        altText: metadata?.alt || 'AI generated garden image'
      });
    },
    enabled: !block.imageUrl && !!onUpdate
  });

  // Handle image URL changes and preloading
  useEffect(() => {
    if (block.imageUrl && block.imageUrl !== currentImageUrl) {
      setIsImageLoading(true);
      setImageError(false);
      
      const img = new Image();
      const currentUrl = block.imageUrl;
      
      img.onload = () => {
        // Only update if this is still the current image
        if (block.imageUrl === currentUrl) {
          setCurrentImageUrl(currentUrl);
          setIsImageLoading(false);
          setHasImageLoaded(true);
          setImageError(false);
        }
      };
      
      img.onerror = () => {
        if (block.imageUrl === currentUrl) {
          setIsImageLoading(false);
          setHasImageLoaded(false);
          setImageError(true);
        }
      };
      
      img.src = currentUrl;
    } else if (!block.imageUrl) {
      setCurrentImageUrl('');
      setIsImageLoading(false);
      setHasImageLoaded(false);
      setImageError(false);
    }
  }, [block.imageUrl, currentImageUrl]);

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

  // PHASE 3: Improved content detection - trust persistent flag first
  const hasRealContent = !!(
    (block as any).hasGeneratedContent || // TRUST THE PERSISTENT FLAG FIRST!
    (block.headline && 
     block.headline !== '⏳ Generating content...' && 
     block.headline !== 'Add headline' &&
     block.headline !== 'Content Headline') || 
    (block.body && 
     block.body !== '⏳ Creating engaging content...' && 
     block.body !== 'Add body text' &&
     block.body !== 'Add your content here') || 
    (block.title && block.title !== 'Add headline') ||
    (typeof block.content === 'object' && block.content && (
      ((block.content as any).headline && 
       (block.content as any).headline !== '⏳ Generating content...') || 
      ((block.content as any).body && 
       (block.content as any).body !== '⏳ Creating engaging content...')
    ))
  );
  
  // PHASE 3: Add content stability guard - once shown, content never disappears
  const contentShownRef = useRef(false);
  
  // PHASE 6: Store last known good content whenever content exists
  useEffect(() => {
    if (block.headline || block.body) {
      lastKnownContentRef.current = {
        headline: block.headline,
        body: block.body
      };
    }
  }, [block.headline, block.body]);
  
  useEffect(() => {
    if (hasRealContent) {
      contentShownRef.current = true;
      
      // Mark content as generated in parent if not already marked
      if (!(block as any).hasGeneratedContent && onUpdate) {
        console.log('[ImageTextBlock] Marking content as permanently generated for block:', block.id);
        onUpdate({
          hasGeneratedContent: true,
          contentGeneratedAt: Date.now()
        } as any);
      }
    }
  }, [hasRealContent, block.id, onUpdate, (block as any).hasGeneratedContent]);
  
  // Check if block is actively loading content
  const isActivelyLoading = (block as any).isLoadingContent === true || isGenerating;
  
  // Content is considered loaded if we have real content OR it was shown before
  const hasContentLoaded = hasRealContent || contentShownRef.current;
  
  // Smooth content stabilization after generation
  useEffect(() => {
    if (!isActivelyLoading && hasContentLoaded) {
      const timer = setTimeout(() => setContentStable(true), 100);
      return () => clearTimeout(timer);
    } else {
      setContentStable(false);
    }
  }, [isActivelyLoading, hasContentLoaded]);
  
  // Show loading skeleton ONLY if actively loading AND no real content exists yet
  const isContentLoading = isActivelyLoading && !hasContentLoaded;

  // PHASE 4: Check if block is truly empty - NEVER show empty state once content has loaded
  const isEmpty = !hasContentLoaded &&
                  !(block as any).hasGeneratedContent &&
                  !contentShownRef.current &&
                  !isContentLoading &&
                  !block.imageUrl &&
                  !block.headline && 
                  !block.title && 
                  (!block.body || block.body.trim() === '') &&
                  (!block.content || typeof block.content === 'string' && block.content.trim() === '') &&
                  (typeof block.content === 'object' && block.content && 
                   !(block.content as any).headline && 
                   (!(block.content as any).body || (block.content as any).body.trim() === ''));

  // PHASE 5: Enhanced debug logging with content persistence tracking
  useEffect(() => {
    console.log('[ImageTextBlock Lifecycle]', {
      blockId: block.id,
      hasRealContent,
      hasContentLoaded,
      contentShownBefore: contentShownRef.current,
      persistentFlag: (block as any).hasGeneratedContent,
      isActivelyLoading,
      isContentLoading,
      isEmpty,
      contentStable,
      headline: block.headline?.substring(0, 30),
      body: block.body?.substring(0, 30),
      contentGeneratedAt: (block as any).contentGeneratedAt,
      timestamp: Date.now()
    });
  }, [hasRealContent, hasContentLoaded, isActivelyLoading, isContentLoading, isEmpty, contentStable, block.id, block.headline, block.body, (block as any).hasGeneratedContent]);

  return (
    <div 
      className={cn(
        "relative p-6 rounded-lg group",
        isEmpty && "border-2 border-dashed border-muted-foreground/30 bg-muted/20"
      )}
      style={{ backgroundColor: isEmpty ? 'transparent' : (block.backgroundColor || 'transparent') }}
    >
      {/* PHASE 4: Show generating overlay ONLY if no content has ever been shown */}
      {isGenerating && isEmpty && !(block as any).hasGeneratedContent && !contentShownRef.current && (
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
            {/* ALWAYS show content if it exists or has existed before, even during image generation */}
            {hasContentLoaded ? (
              <>
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
                
                {/* Headline - PHASE 6: Fallback to last known content if current is empty but hasGeneratedContent */}
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
                } else if ((block as any).hasGeneratedContent && lastKnownContentRef.current.headline) {
                  // PHASE 6: Use last known content if current is empty but content was generated
                  headline = lastKnownContentRef.current.headline;
                } else {
                  headline = 'Add headline';
                }
                const headlineText = typeof headline === 'string' ? headline : String(headline || 'Add headline');
                return sanitizeWeekNumbers(headlineText);
              })()}
              type="newsletter"
              className="text-2xl font-bold prose prose-headings:font-bold prose-strong:font-bold prose-em:italic prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6"
            />
            
            {/* Body text - PHASE 6: Fallback to last known content if current is empty but hasGeneratedContent */}
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
                } else if ((block as any).hasGeneratedContent && lastKnownContentRef.current.body) {
                  // PHASE 6: Use last known content if current is empty but content was generated
                  body = lastKnownContentRef.current.body;
                }
                
                const bodyText = body || 'Add body text';
                return sanitizeWeekNumbers(bodyText);
              })()}
              type="newsletter"
              className="text-muted-foreground prose max-w-none prose-p:my-2 prose-strong:font-bold prose-em:italic prose-u:underline prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 prose-ul:my-2 prose-ol:my-2 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-headings:font-bold prose-headings:my-2"
            />
            
                {/* CTA Button */}
                <CTAButton block={block} />
              </>
            ) : (
              // Show skeleton only if content has NEVER loaded
              <TextContentSkeleton 
                showHeadline={true}
                showBody={true}
                bodyLines={6}
                className="py-2"
              />
            )}
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
                // Check if image is loading
                const isImageLoadingState = block.imageUrl === 'loading' || (block as any).isLoadingImage === true;
                
                // Show AI image loading overlay
                if (isGeneratingImage) {
                  return (
                    <div className="relative w-full h-64 rounded-lg bg-muted">
                      <AIImageLoadingOverlay message="Generating image with AI..." />
                    </div>
                  );
                }
                
                // Show image skeleton if loading
                if (isImageLoadingState) {
                  return (
                    <ImageSkeleton 
                      className="w-full h-64 rounded-lg"
                      aspectRatio="video"
                      showIcon={true}
                    />
                  );
                }
                
                // Show current image (keep previous visible during loading)
                const displayImageUrl = currentImageUrl || block.imageUrl;
                
                return displayImageUrl ? (
                  <div className="relative">
                    {/* Show skeleton overlay only when loading and no current image */}
                    {isImageLoading && !currentImageUrl && (
                      <div className="absolute inset-0 z-10">
                        <ImageSkeleton className="w-full h-full" />
                      </div>
                    )}
                    
                    {/* Main image - keep previous visible during transitions */}
                    {/* Only render img if we have a valid URL (not empty, undefined, or 'loading') */}
                    {displayImageUrl && displayImageUrl !== 'loading' && (
                      <img
                        src={displayImageUrl}
                        alt={block.altText || 'Content image'}
                        className={cn(
                          "w-full h-auto rounded-lg cursor-pointer transition-opacity duration-300",
                          isImageLoading && currentImageUrl ? "opacity-70" : "opacity-100"
                        )}
                        onLoad={() => {
                          if (displayImageUrl === block.imageUrl) {
                            setCurrentImageUrl(block.imageUrl);
                            setIsImageLoading(false);
                            setHasImageLoaded(true);
                            setImageError(false);
                          }
                        }}
                        onError={() => {
                          if (displayImageUrl === block.imageUrl) {
                            console.error('[ImageTextBlock] Image failed to load:', displayImageUrl);
                            setIsImageLoading(false);
                            setHasImageLoaded(false);
                            setImageError(true);
                          }
                        }}
                      />
                    )}
                    
                    {/* Image Overlay */}
                    {block.overlayOpacity && block.overlayOpacity > 0 && (
                      <div
                        className="absolute inset-0 rounded-lg pointer-events-none"
                        style={{
                          backgroundColor: block.overlayColor || '#000000',
                          opacity: block.overlayOpacity / 100
                        }}
                      />
                    )}
                    
                    {/* Loading indicator for when updating existing image */}
                    {isImageLoading && currentImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-background/80 backdrop-blur-sm rounded-full p-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
                        </div>
                      </div>
                    )}
                    
                    {/* Error fallback */}
                    {imageError && !isImageLoading && !currentImageUrl && (
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
                    className="w-full h-48 bg-muted rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors p-4 animate-gentle-pulse"
                  >
                    {isImageLoading ? (
                      <ImageSkeleton className="w-full h-full" />
                    ) : (
                      <>
                        <ImageIcon className="w-12 h-12 text-muted-foreground mb-3 animate-gentle-pulse" />
                        {isGeneratingImage ? (
                          <span className="text-muted-foreground font-medium">Generating image with AI...</span>
                        ) : (
                          <span className="text-muted-foreground mb-3">Click to add image</span>
                        )}
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