
import React from 'react';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { MagazineNewsletterRenderer } from '@/components/newsletter/MagazineNewsletterRenderer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TopicValidationIndicator } from '@/components/debug/TopicValidationIndicator';

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

  // Use the newsletter renderer hook
  const {
    processedNewsletter,
    images,
    featuredImage,
    loadingImages,
    imageErrors,
    handleImageSelect,
    needsRegeneration,
    isStructured,
    topicValidation
  } = useNewsletterRenderer({
    content,
    campaignTitle,
    contentTaskId,
    format: 'magazine',
    className
  });

  // Handle empty or placeholder content
  if (needsRegeneration) {
    return (
      <div className={`magazine-newsletter-display space-y-6 ${className}`}>
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Newsletter content is being prepared...</p>
        </div>
      </div>
    );
  }

  // If structured newsletter or unstructured with sections, use the magazine renderer
  if ((isStructured && processedNewsletter.blocks.length > 0) || processedNewsletter.unstructuredSections?.length > 0) {
    // Convert unstructured sections to blocks format if needed
    const blocksToRender = processedNewsletter.blocks.length > 0 
      ? processedNewsletter.blocks 
      : (processedNewsletter.unstructuredSections || []).map(section => ({
          title: section.title,
          body: section.content,
          cta: section.cta || 'Learn More',
          link: section.link || '#',
          image_prompt: section.image_prompt,
          alt_text: section.alt_text
        }));

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
          blocks={blocksToRender}
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
