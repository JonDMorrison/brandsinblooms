import React, { useEffect, useState, useCallback, useRef } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';
import { SafeHtml } from '@/components/ui/safe-html';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';

import { EditMode } from '@/hooks/useBlockEditMode';
import { CTAButton } from '@/components/ui/CTAButton';
import { BlockGeneratingOverlay } from './BlockGeneratingOverlay';

import { ImageSkeleton } from '@/components/ui/image-skeleton';
import { TextContentSkeleton } from '@/components/ui/text-content-skeleton';
import { Image as ImageIcon } from 'lucide-react';
import { useBlockImageGeneration } from '@/hooks/useBlockImageGeneration';
import { AIImageLoadingOverlay } from '@/components/ui/AIImageLoadingOverlay';
import { useAIImageGeneration } from '@/hooks/useAIImageGeneration';
import { ImageActionMenu } from '../ImageActionMenu';
import { Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ImageTextBlockProps {
  block: ContentBlock;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
  editMode?: EditMode;
  onModeChange?: (mode: EditMode) => void;
  isGenerating?: boolean;
  onOpenAIImageDialog?: (blockId: string) => void;
}

export const ImageTextBlock: React.FC<ImageTextBlockProps> = ({ 
  block, 
  onUpdate, 
  isPreview = true, 
  editMode,
  onModeChange,
  isGenerating = false,
  onOpenAIImageDialog
}) => {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasImageLoaded, setHasImageLoaded] = useState(!!block.imageUrl);
  const [imageError, setImageError] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState(block.imageUrl);
  const [contentStable, setContentStable] = useState(false);
  const [isAutoPickGenerating, setIsAutoPickGenerating] = useState(false);
  const { toast } = useToast();
  
  // PHASE 6: Content persistence checkpoint - store last known good content
  const lastKnownContentRef = useRef<{ headline?: string; body?: string }>({});
  
  // AI image generation hook for Auto Pick
  const { generateSingleImage } = useAIImageGeneration();
  
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

  // Automatic AI image generation disabled - users add images manually based on their content
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
    enabled: false // Disabled - users add images manually based on their content
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
  // Text-only layout: only hide image section if no image AND it's a text block or full-width layout
  // If there's an imageUrl, always show the image regardless of block type
  const isTextOnly = !block.imageUrl && (block.layout === 'full-width' || block.type === 'text');
  // For text blocks with images added, use vertical layout (image on top, content below)
  const isTextBlockWithImage = block.type === 'text' && !!block.imageUrl;

  const handleModeClick = (mode: EditMode, event: React.MouseEvent) => {
    event.stopPropagation();
    if (mode === 'image') {
      // For image mode, trigger the modal opening
      onModeChange?.('image');
    } else {
      onModeChange?.(editMode === mode ? null : mode);
    }
  };

  // Handle Auto Pick button click
  const handleAutoPick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Always generate image directly based on content
    setIsAutoPickGenerating(true);
    
    try {
      // Check if there's content (headline, title, body, or content text)
      const headline = block.headline || block.title || '';
      const body = block.body || (typeof block.content === 'string' ? block.content : '') || 
                   (typeof block.content === 'object' && block.content ? (block.content as any).body || '' : '');
      const hasContent = headline.trim() || body.trim();
      
      // Determine content context and title
      let contentContext: string;
      let contentTitle: string | undefined;
      
      if (hasContent) {
        // Strategy 1: Use actual content for AI generation
        contentContext = body.trim() || headline.trim();
        contentTitle = headline.trim() || undefined;
        
        toast({
          title: "Generating image",
          description: "Creating an image based on your content...",
        });
      } else {
        // Strategy 2: Generate garden/seasonal fallback image
        // Detect current season
        const month = new Date().getMonth(); // 0-11
        let season = '';
        let seasonalElements = '';
        
        if (month >= 2 && month <= 4) {
          // March, April, May - Spring
          season = 'spring';
          seasonalElements = 'blooming flowers, fresh green leaves, tulips, daffodils, cherry blossoms, vibrant spring colors';
        } else if (month >= 5 && month <= 7) {
          // June, July, August - Summer
          season = 'summer';
          seasonalElements = 'lush gardens, colorful flowers in full bloom, roses, hydrangeas, bright sunlight, verdant leaves';
        } else if (month >= 8 && month <= 10) {
          // September, October, November - Fall/Autumn
          season = 'autumn';
          seasonalElements = 'fall foliage, colorful autumn leaves, chrysanthemums, harvest colors, golden tones';
        } else {
          // December, January, February - Winter
          season = 'winter';
          seasonalElements = 'winter garden, evergreen plants, frost-covered leaves, winter flowers, hellebores, winter gardening prep';
        }
        
        contentContext = `Beautiful ${season} garden scene for marketing: ${seasonalElements}. Professional garden center photography showcasing seasonal plants and flowers perfect for ${season} gardening.`;
        contentTitle = `${season.charAt(0).toUpperCase() + season.slice(1)} Garden Marketing`;
        
        toast({
          title: "Generating image",
          description: `Creating a ${season} garden image...`,
        });
      }
      
      // Determine channel - default to newsletter
      const channel = 'newsletter';
      
      // Generate the image
      const imageUrl = await generateSingleImage({
        contentContext,
        contentTitle,
        channel: channel as 'newsletter' | 'blog' | 'instagram' | 'facebook',
        uploadToStorage: true
      });
      
      if (imageUrl) {
        onUpdate?.({
          imageUrl,
          altText: contentTitle || 'AI generated garden image'
        });
        
        toast({
          title: "Image generated!",
          description: "Your image has been added successfully.",
        });
      } else {
        throw new Error('Failed to generate image');
      }
    } catch (error) {
      console.error('Auto Pick failed:', error);
      toast({
        title: "Generation failed",
        description: "Unable to generate image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAutoPickGenerating(false);
    }
  };

  // PHASE 3: Improved content detection - trust persistent flag first
  // Template placeholder titles that should NOT be considered real content
  const templatePlaceholders = [
    'Featured Story', 
    'Main Article', 
    'Secondary Feature', 
    'Call to Action',
    'Content Headline',
    'Seasonal Spotlight',
    'Tips & How-To'
  ];
  
  const isPlaceholderTitle = templatePlaceholders.includes(block.headline || '') || 
                            templatePlaceholders.includes(block.title || '');
  
  const hasRealContent = !isPlaceholderTitle && !!(
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
          "grid gap-6 items-start",
          // For text blocks with images: single column (image top, content below)
          // For regular image-text blocks: two columns on desktop
          (isImageLeft || isImageRight) && !isTextOnly && !isTextBlockWithImage ? "md:grid-cols-2" : "md:grid-cols-1"
        )}>
          {/* Image - render FIRST for text blocks with images (vertical layout: image top, content below) */}
          {isTextBlockWithImage && (
            <div 
              className="relative group/image cursor-pointer hover:opacity-90 transition-opacity duration-200"
              onClick={(e) => {
                e.stopPropagation();
                if (onModeChange) {
                  handleModeClick('image', e);
                }
              }}
            >
              {(() => {
                const isImageLoadingState = block.imageUrl === 'loading' || (block as any).isLoadingImage === true;
                const isBlockGeneratingImage = (block as any).isGeneratingImage === true;
                
                if (isGeneratingImage || isBlockGeneratingImage || isImageLoadingState || isAutoPickGenerating) {
                  return (
                    <div className="relative w-full h-64 rounded-lg bg-muted flex items-center justify-center">
                      <ImageSkeleton className="w-full h-full" />
                      <AIImageLoadingOverlay message="Generating Images" className="rounded-lg" />
                    </div>
                  );
                }
                
                const displayImageUrl = currentImageUrl || block.imageUrl;
                
                return displayImageUrl ? (
                  <div className="relative group/image-actions">
                    {/* Unified Image Action Menu - shown on hover */}
                    <div className="absolute top-2 left-2 z-20 opacity-0 group-hover/image-actions:opacity-100 transition-opacity">
                      <ImageActionMenu
                        block={block}
                        editMode={editMode}
                        onModeChange={(mode) => onModeChange?.(mode)}
                        onAutoPickImage={() => handleAutoPick({ stopPropagation: () => {} } as React.MouseEvent)}
                        onOpenAIImageDialog={onOpenAIImageDialog ? () => onOpenAIImageDialog(block.id) : undefined}
                        disabled={isAutoPickGenerating}
                      />
                    </div>
                    {isImageLoading && !currentImageUrl && (
                      <div className="absolute inset-0 z-10">
                        <ImageSkeleton className="w-full h-full" />
                      </div>
                    )}
                    {displayImageUrl && displayImageUrl !== 'loading' && (
                      <img
                        src={displayImageUrl}
                        alt={block.altText || 'Content image'}
                        className={cn(
                          "w-full h-auto rounded-lg cursor-pointer transition-opacity duration-300 relative z-0",
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
                            setIsImageLoading(false);
                            setHasImageLoaded(false);
                            setImageError(true);
                          }
                        }}
                      />
                    )}
                    {isImageLoading && currentImageUrl && (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="bg-background/80 backdrop-blur-sm rounded-full p-2">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent animate-spin rounded-full"></div>
                        </div>
                      </div>
                    )}
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
                ) : null;
              })()}
            </div>
          )}
          
          {/* Content - shown after image for text blocks with images */}
          <div 
            className={cn(
              "space-y-4 relative group/text cursor-pointer",
              // For non-text-block-with-image layouts, use original ordering
              !isTextBlockWithImage && isImageLeft && !isTextOnly && "md:order-2",
              !isTextBlockWithImage && isImageRight && !isTextOnly && "md:order-1",
              block.textAlign === 'center' && "text-center",
              block.textAlign === 'right' && "text-right",
              "hover:bg-background/50 rounded-md transition-colors duration-200 p-2 -m-2"
            )}
            onClick={(e) => {
              if (onModeChange && editMode !== 'text') {
                e.stopPropagation();
                handleModeClick('text', e);
              }
            }}
          >
            {/* ALWAYS show content if it exists or has existed before, even during image generation */}
            {hasContentLoaded ? (
              <>
                
                {/* Headline - PHASE 6: Fallback to last known content if current is empty but hasGeneratedContent */}
                <div style={{ color: '#1f2937' }}>
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
                </div>
            
                {/* Body text - PHASE 6: Fallback to last known content if current is empty but hasGeneratedContent */}
                <div style={{ color: '#475569' }}>
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
                    className="prose max-w-none prose-p:my-2 prose-strong:font-bold prose-em:italic prose-u:underline prose-ul:list-disc prose-ol:list-decimal prose-li:ml-6 prose-ul:my-2 prose-ol:my-2 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-headings:font-bold prose-headings:my-2"
                  />
                </div>
            
                {/* CTA Button */}
                <CTAButton block={block} />
              </>
            ) : isContentLoading ? (
              // Show skeleton ONLY when actively loading
              <TextContentSkeleton 
                showHeadline={true}
                showBody={true}
                bodyLines={7}
                className="py-2"
              />
            ) : (
              // Show empty state when not loading and no content
              <div 
                className="text-center py-8 space-y-2 cursor-pointer hover:bg-muted/30 rounded-md transition-colors"
                onClick={(e) => handleModeClick('text', e)}
              >
                <p className="text-muted-foreground font-medium">Click to add content</p>
                <p className="text-xs text-muted-foreground/70">Click here to add the heading and content of the block</p>
              </div>
            )}
          </div>

          {/* Image - only render for image-text layouts, skip if already rendered above for text blocks with images */}
          {!isTextOnly && !isTextBlockWithImage && (
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
              
              {(() => {
                // Check if image is loading
                const isImageLoadingState = block.imageUrl === 'loading' || (block as any).isLoadingImage === true;
                const isBlockGeneratingImage = (block as any).isGeneratingImage === true;
                
                // Show subtle skeleton for image generation with overlay
                // CRITICAL: Check both hook state AND block property for AI Writer parallel generation
                if (isGeneratingImage || isBlockGeneratingImage || isImageLoadingState || isAutoPickGenerating) {
                  return (
                    <div className="relative w-full h-64 rounded-lg bg-muted flex items-center justify-center">
                      <ImageSkeleton className="w-full h-full" />
                      <AIImageLoadingOverlay 
                        message="Generating Images"
                        className="rounded-lg"
                      />
                    </div>
                  );
                }
                
                // Show current image (keep previous visible during loading)
                const displayImageUrl = currentImageUrl || block.imageUrl;
                
                return displayImageUrl ? (
                  <div className="relative group/image-actions">
                    {/* Unified Image Action Menu - shown on hover */}
                    <div className="absolute top-2 left-2 z-20 opacity-0 group-hover/image-actions:opacity-100 transition-opacity">
                      <ImageActionMenu
                        block={block}
                        editMode={editMode}
                        onModeChange={(mode) => onModeChange?.(mode)}
                        onAutoPickImage={() => handleAutoPick({ stopPropagation: () => {} } as React.MouseEvent)}
                        onOpenAIImageDialog={onOpenAIImageDialog ? () => onOpenAIImageDialog(block.id) : undefined}
                        disabled={isAutoPickGenerating}
                      />
                    </div>
                    
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
                          "w-full h-auto rounded-lg cursor-pointer transition-opacity duration-300 relative z-0",
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
                          <span className="text-muted-foreground font-medium">Generating Images</span>
                        ) : (
                          <span className="text-muted-foreground mb-3">Click to add image</span>
                        )}
                        <div className="flex justify-center">
                          <ImageActionMenu
                            block={block}
                            editMode={editMode}
                            onModeChange={(mode) => onModeChange?.(mode)}
                            onAutoPickImage={() => handleAutoPick({ stopPropagation: () => {} } as React.MouseEvent)}
                            onOpenAIImageDialog={onOpenAIImageDialog ? () => onOpenAIImageDialog(block.id) : undefined}
                            disabled={isAutoPickGenerating}
                          />
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