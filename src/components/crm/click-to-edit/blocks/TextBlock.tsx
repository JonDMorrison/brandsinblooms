import React, { useState } from 'react';
import { ContentBlock } from '@/types/emailBuilder';
import { cn } from '@/lib/utils';
import { sanitizeWeekNumbers } from '@/utils/weekNumberSanitizer';
import { ImageTextBlock } from './ImageTextBlock';
import { CTAButton } from '@/components/ui/CTAButton';
import { TextContentSkeleton } from '@/components/ui/text-content-skeleton';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useAIImageGeneration } from '@/hooks/useAIImageGeneration';
import { useToast } from '@/hooks/use-toast';
import { getCurrentSeason } from '@/utils/seasonalUtils';

interface TextBlockProps {
  block: ContentBlock;
  onUpdate?: (updates: Partial<ContentBlock>) => void;
  isPreview?: boolean;
  onOpenAIImageDialog?: (blockId: string) => void;
}

export const TextBlock: React.FC<TextBlockProps> = ({ block, onUpdate, isPreview = true, onOpenAIImageDialog }) => {
  const [isAutoPickGenerating, setIsAutoPickGenerating] = useState(false);
  const { generateSingleImage } = useAIImageGeneration();
  const { toast } = useToast();
  
  // If this text block has an image, render as ImageTextBlock instead
  if (block.imageUrl) {
    return (
      <ImageTextBlock 
        block={block} 
        onUpdate={onUpdate} 
        isPreview={isPreview}
        onOpenAIImageDialog={onOpenAIImageDialog}
      />
    );
  }

  // Check if content is being loaded
  const isLoadingContent = (block as any).isLoadingContent === true;
  
  // Template placeholder titles that should NOT be considered real content
  const templatePlaceholders = [
    'Featured Story', 
    'Main Article', 
    'Secondary Feature', 
    'Call to Action',
    'Content Headline',
    'Seasonal Spotlight',
    'Tips & How-To',
    'Add headline'
  ];
  
  const isPlaceholderTitle = templatePlaceholders.includes(block.headline || '') || 
                            templatePlaceholders.includes(block.title || '');
  
  const hasRealContent = !isPlaceholderTitle && !!(
    (block.headline && block.headline !== '⏳ Generating content...') ||
    (block.title && block.title !== 'Add headline') ||
    (block.body && block.body !== '⏳ Creating engaging content...' && block.body.trim() !== '') ||
    (block.content && block.content !== 'Add body text' && typeof block.content === 'string' && block.content.trim() !== '')
  );

  console.log('[TextBlock] Rendering state:', {
    blockId: block.id,
    isLoadingContent,
    hasRealContent,
    isPlaceholderTitle,
    headline: block.headline?.substring(0, 30),
    body: typeof block.body === 'string' ? block.body.substring(0, 30) : block.body
  });

  // Always render as preview - editing is handled by the new mode system
  const paddingClass = {
    none: 'p-0',
    small: 'p-4',
    medium: 'p-6',
    large: 'p-8'
  }[block.padding || 'medium'];

  // Handle Auto Pick button click
  const handleAutoPick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!onUpdate) return;
    
    setIsAutoPickGenerating(true);
    
    try {
      // Check if block has content
      const blockContent = block.content || block.body || block.headline || block.title || '';
      const hasValidContent = typeof blockContent === 'string' && blockContent.trim().length > 0;
      
      let contentContext = '';
      let contentTitle = '';
      
      if (hasValidContent) {
        // Generate image based on block content
        contentContext = blockContent;
        contentTitle = (block.headline || block.title || blockContent.substring(0, 100)).toString();
      } else {
        // Generate image based on garden, flowers, and current season
        const { season } = getCurrentSeason();
        contentContext = `A beautiful garden scene with flowers and plants in ${season}. Vibrant colors and blooming flowers appropriate for the ${season} season.`;
        contentTitle = `${season.charAt(0).toUpperCase() + season.slice(1)} Garden Scene`;
      }
      
      console.log('[TextBlock] Auto Pick - Generating image:', { contentContext, contentTitle, hasValidContent });
      
      const imageUrl = await generateSingleImage({
        contentContext,
        contentTitle,
        channel: 'newsletter',
        uploadToStorage: true
      });
      
      if (imageUrl) {
        onUpdate({ imageUrl });
        toast({
          title: "Image generated!",
          description: "Your image has been added successfully.",
        });
      } else {
        throw new Error('Failed to generate image');
      }
    } catch (error) {
      console.error('[TextBlock] Auto Pick failed:', error);
      toast({
        title: "Generation failed",
        description: "Unable to generate image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAutoPickGenerating(false);
    }
  };

  // Check if this text block has content that could benefit from an image
  const hasContent = (block.title || block.content || block.body || block.headline);
  const hasRichContent = hasContent && (block.title || block.content || block.body || block.headline)!.length > 50;
  const isFromTemplate = block.source === 'template' || block.source === 'newsletter';
  
  // Show suggestion for rich content OR template-based blocks (regardless of length)
  const showAddImageSuggestion = (hasRichContent || isFromTemplate) && !block.imageUrl && isPreview && onUpdate;

  return (
    <div 
      className={cn(
        paddingClass,
        block.textAlign === 'center' && "text-center",
        block.textAlign === 'right' && "text-right"
      )}
    >
      {/* Show skeleton loader while content is being generated */}
      {isLoadingContent && !hasRealContent ? (
        <TextContentSkeleton 
          showHeadline={true}
          showBody={true}
          bodyLines={7}
          className="py-2"
        />
      ) : (
        <>
          {/* Add Image Suggestion */}
          {showAddImageSuggestion && (
        <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">💡 This content would look great with an image</span>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={handleAutoPick}
              disabled={isAutoPickGenerating}
              className="gap-2"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isAutoPickGenerating ? 'Generating...' : 'Auto Pick'}
            </Button>
          </div>
        </div>
      )}
      
      {/* Headline (if present or show placeholder) */}
      {(block.headline || block.title) ? (
        <div 
          className="text-2xl font-bold mb-4"
          style={{ 
            fontSize: block.fontSize ? `calc(${block.fontSize} * 1.5)` : '24px',
            fontFamily: block.fontFamily || 'inherit',
            color: block.textColor || 'inherit'
          }}
          dangerouslySetInnerHTML={{ 
            __html: sanitizeWeekNumbers(block.headline || block.title || '')
          }}
        />
      ) : (
        <p className="text-sm text-muted-foreground italic mb-4">Click to add heading</p>
      )}
      
      {/* Text content */}
      <div 
        className="prose max-w-none"
        style={{ 
          fontSize: block.fontSize || '16px',
          fontFamily: block.fontFamily || 'inherit'
        }}
        dangerouslySetInnerHTML={{ 
          __html: (() => {
            // Prioritize non-empty content from either field
            const content = block.content || block.body || '';
            return sanitizeWeekNumbers(content) || '<p class="text-sm text-muted-foreground italic">Click to add content</p>';
          })()
        }}
      />
      
          {/* CTA Button */}
          <CTAButton block={block} />
        </>
      )}
    </div>
  );
};
