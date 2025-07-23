
import React, { useMemo } from 'react';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { useNewsletterImages } from './newsletter/useNewsletterImages';
import { MagazineNewsletterRenderer } from '@/components/newsletter/MagazineNewsletterRenderer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { ImageSelectButton } from '@/components/image/ImageSelectButton';

interface MagazineNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
  taskStatus?: string;
}

export const MagazineNewsletterDisplay = ({ 
  content, 
  className = '',
  contentTaskId,
  campaignTitle,
  taskStatus 
}: MagazineNewsletterDisplayProps) => {
  console.log('[MAGAZINE NEWSLETTER] Rendering with:', {
    contentLength: content?.length || 0,
    isPlaceholder: !content || content.length < 100,
    campaignTitle,
    taskStatus
  });

  // Process the newsletter content using the unified processor
  const processedNewsletter = useMemo(() => 
    processNewsletterContent(content, campaignTitle), 
    [content, campaignTitle]
  );

  // Generate featured image prompt
  const featuredImagePrompt = useMemo(() => {
    if (campaignTitle) {
      return `${campaignTitle} garden center newsletter hero image professional`;
    }
    const firstLine = content?.split('\n')[0]?.replace(/[#*]/g, '').trim();
    return firstLine ? `${firstLine} garden newsletter hero` : 'garden center newsletter hero professional';
  }, [campaignTitle, content]);

  // Load images for the newsletter
  const { 
    images, 
    featuredImage, 
    loadingImages, 
    imageErrors 
  } = useNewsletterImages(
    processedNewsletter.blocks,
    processedNewsletter.needsRegeneration,
    contentTaskId,
    processedNewsletter.meta.theme,
    processedNewsletter.unstructuredSections,
    featuredImagePrompt
  );

  // Handle empty or placeholder content
  if (processedNewsletter.needsRegeneration) {
    return (
      <div className={`magazine-newsletter-display space-y-6 ${className}`}>
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Newsletter content is being prepared...</p>
        </div>
      </div>
    );
  }

  // Handle image selection
  const handleImageSelect = (blockIndex: number, prompt: string) => {
    console.log(`[MAGAZINE NEWSLETTER] Image selection for block ${blockIndex}:`, prompt);
    // This could open an image selection modal or trigger the ImageSelectButton
  };

  // If structured newsletter, use the magazine renderer
  if (processedNewsletter.isStructured && processedNewsletter.blocks.length > 0) {
    return (
      <div className={`magazine-newsletter-display ${className}`}>
        {loadingImages && (
          <div className="text-center py-4 mb-6">
            <LoadingSpinner />
            <p className="text-sm text-muted-foreground mt-2">Loading newsletter images...</p>
          </div>
        )}
        
        <MagazineNewsletterRenderer
          title={campaignTitle || processedNewsletter.meta.week_focus}
          blocks={processedNewsletter.blocks}
          meta={processedNewsletter.meta}
          featuredImage={featuredImage}
          blockImages={images}
          onImageSelect={handleImageSelect}
          className="space-y-8"
        />
      </div>
    );
  }

  // Fallback for unstructured content - render as simple formatted content
  return (
    <div className={`magazine-newsletter-display space-y-6 ${className}`}>
      <div className="prose prose-lg max-w-none">
        <h1 className="text-4xl font-bold text-foreground mb-6">
          {campaignTitle || 'Newsletter'}
        </h1>
        <div 
          className="text-muted-foreground leading-relaxed"
          dangerouslySetInnerHTML={{ 
            __html: content.replace(/\n/g, '<br/>') 
          }} 
        />
      </div>
    </div>
  );
};
