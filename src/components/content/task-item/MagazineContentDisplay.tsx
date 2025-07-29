
import React, { useMemo, useState } from 'react';
import { cleanContentForDisplay } from '@/utils/contentUtils';
import { cleanVideoContent, isVideoScriptContent } from '@/utils/videoContentCleaner';
import { SafeHtml } from '@/components/ui/safe-html';
import { stripEmojis } from '@/utils/contentValidation';
import { validateFormattedContent, repairFormattedContent } from '@/utils/contentFormatValidator';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { useNewsletterImages } from '@/components/content-sidebar/newsletter/useNewsletterImages';
import { MagazineNewsletterRenderer } from '@/components/newsletter/MagazineNewsletterRenderer';
import { PlainEmailRenderer } from '@/components/newsletter/PlainEmailRenderer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MagazineContentDisplayProps {
  content: string;
  postType: string;
  contentTaskId?: string;
  campaignTitle?: string;
  task?: any;
  className?: string;
}

export const MagazineContentDisplay = ({ 
  content, 
  postType, 
  contentTaskId, 
  campaignTitle, 
  task,
  className = ""
}: MagazineContentDisplayProps) => {
  
  // State for format toggle
  const [format, setFormat] = useState<'magazine' | 'plain'>('magazine');
  
  console.log('🔍 [MagazineContentDisplay] Input:', {
    contentLength: content?.length || 0,
    postType,
    contentPreview: content?.substring(0, 100) + '...',
    hasContent: !!content
  });

  // Process newsletter content using structured processor
  const processedNewsletter = useMemo(() => {
    if (postType === 'newsletter') {
      return processNewsletterContent(content, campaignTitle);
    }
    return null;
  }, [content, campaignTitle, postType]);

  // Generate featured image prompt for newsletters
  const featuredImagePrompt = useMemo(() => {
    if (postType === 'newsletter') {
      if (campaignTitle) {
        return `${campaignTitle} garden center newsletter hero image professional`;
      }
      const firstLine = content?.split('\n')[0]?.replace(/[#*]/g, '').trim();
      return firstLine ? `${firstLine} garden newsletter hero` : 'garden center newsletter hero professional';
    }
    return undefined;
  }, [campaignTitle, content, postType]);

  // Load images for newsletter content
  const { 
    images, 
    featuredImage, 
    loadingImages, 
    imageErrors 
  } = useNewsletterImages(
    processedNewsletter?.blocks || [],
    processedNewsletter?.needsRegeneration || false,
    contentTaskId,
    processedNewsletter?.meta.theme,
    processedNewsletter?.unstructuredSections,
    featuredImagePrompt
  );

  if (!content) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
        <div className="text-gray-400 italic text-sm">
          No content available
        </div>
      </div>
    );
  }

  // Handle newsletter content with rich block display
  if (postType === 'newsletter' && processedNewsletter) {
    // Handle newsletter content being prepared
    if (processedNewsletter.needsRegeneration) {
      return (
        <div className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}>
          <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-muted-foreground">Newsletter content is being prepared...</p>
          </div>
        </div>
      );
    }

    // Handle image selection
    const handleImageSelect = (blockIndex: number, prompt: string) => {
      console.log(`[NEWSLETTER] Image selection for block ${blockIndex}:`, prompt);
      // This could open an image selection modal or trigger image generation
    };

    // If structured newsletter, use conditional renderer based on format
    if (processedNewsletter.isStructured && processedNewsletter.blocks.length > 0) {
      return (
        <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
          {/* Format Toggle */}
          <div className="flex justify-end p-4 pb-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setFormat(format === 'magazine' ? 'plain' : 'magazine')}
                    className="text-sm px-3 py-1 border border-border rounded bg-background hover:bg-muted transition-colors"
                  >
                    {format === 'magazine' ? 'Switch to Plain Email' : 'Switch to Magazine Format'}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {format === 'magazine'
                    ? 'Show as simple email (text only, stacked format)'
                    : 'Show with images and blocks like a printed magazine'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          <div className="p-6 pt-2">
            {loadingImages && format === 'magazine' && (
              <div className="text-center py-4 mb-6">
                <LoadingSpinner />
                <p className="text-sm text-muted-foreground mt-2">Loading newsletter images...</p>
              </div>
            )}
            
            {format === 'magazine' ? (
              <MagazineNewsletterRenderer
                title={campaignTitle || processedNewsletter.meta.week_focus}
                blocks={processedNewsletter.blocks}
                meta={processedNewsletter.meta}
                featuredImage={featuredImage}
                blockImages={images}
                onImageSelect={handleImageSelect}
                className="space-y-8"
              />
            ) : (
              <PlainEmailRenderer
                title={campaignTitle || processedNewsletter.meta.week_focus}
                blocks={processedNewsletter.blocks}
                meta={processedNewsletter.meta}
                className="space-y-6"
              />
            )}
          </div>
        </div>
      );
    }

    // Fallback for unstructured newsletter content
    return (
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        <div className="p-6">
          <div className="prose prose-lg max-w-none">
            <h1 className="text-4xl font-bold text-foreground mb-6">
              {campaignTitle || processedNewsletter.meta.week_focus}
            </h1>
            <div 
              className="text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ 
                __html: processedNewsletter.newsletter_md.replace(/\n/g, '<br/>') 
              }} 
            />
          </div>
        </div>
      </div>
    );
  }

  // Minimal content processing for non-newsletter content - avoid over-cleaning
  let processedContent = content;
  
  try {
    // Special handling for video content only
    if (postType === 'video') {
      console.log('🎬 Processing video content for display');
      processedContent = cleanVideoContent(content);
    } else {
      // For other content types, use minimal processing to preserve content
      console.log('📝 Preserving content with minimal processing:', {
        postType,
        originalLength: content.length
      });
      processedContent = content; // Use original content to prevent over-processing
    }

    // Final safety check - always ensure we have content
    if (!processedContent.trim()) {
      console.warn('⚠️ Content became empty, reverting to original');
      processedContent = content;
    }

  } catch (error) {
    console.error('❌ Content processing failed, using original:', error);
    processedContent = content;
  }

  console.log('✅ Final processed content:', {
    finalLength: processedContent.length,
    isEmpty: !processedContent.trim(),
    preview: processedContent.substring(0, 100) + '...'
  });

  // Final safety check - if processed content is empty, show raw content with warning
  if (!processedContent.trim()) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
        <div className="p-6">
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
            ⚠️ Content processing encountered issues. Showing raw content.
          </div>
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="p-6">
        {postType === 'video' ? (
          // Video content gets special formatting as conversational script
          <div className="prose prose-lg max-w-none">
            <div className="text-sm text-gray-600 mb-3 font-medium">
              🎬 Teaching Script
            </div>
            <div className="text-gray-800 whitespace-pre-wrap leading-relaxed">
              {processedContent}
            </div>
          </div>
        ) : postType === 'blog' ? (
          // Blog content uses SafeHtml for rich formatting
          <div className="prose prose-lg max-w-none">
            <SafeHtml 
              content={processedContent} 
              className="text-sm"
              type="newsletter"
            />
          </div>
        ) : postType === 'newsletter' ? (
          // This should not be reached as newsletters are handled above
          <div className="prose prose-lg max-w-none">
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {processedContent}
            </div>
          </div>
        ) : (
          // Other content types use simple text display with fallback
          <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
            {processedContent.replace(/<[^>]*>/g, '') || content}
          </div>
        )}
      </div>
    </div>
  );
};
