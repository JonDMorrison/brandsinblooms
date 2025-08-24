
import React from 'react';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { MagazineNewsletterRenderer } from '@/components/newsletter/MagazineNewsletterRenderer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { TopicValidationIndicator } from '@/components/debug/TopicValidationIndicator';
import { SafeHtml } from '@/components/ui/safe-html';

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
  // Use the newsletter renderer hook
  const {
    processedNewsletter,
    images,
    featuredImage,
    loadingImages,
    imageErrors,
    handleImageSelect,
    needsRegeneration,
    isStructured
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

  // Always try to render blocks - the improved processor ensures we have them
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

  // If we still don't have blocks, show a better error state
  if (blocksToRender.length === 0) {
    return (
      <div className={`magazine-newsletter-display space-y-6 ${className}`}>
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed border-muted-foreground/30">
          <h3 className="text-lg font-semibold text-foreground mb-2">Content Processing</h3>
          <p className="text-muted-foreground mb-4">The newsletter content is being optimized for display...</p>
          <div className="prose prose-sm max-w-none text-left bg-background p-4 rounded border">
            <SafeHtml content={content.replace(/\n/g, '<br/>')} type="newsletter-clean" />
          </div>
        </div>
      </div>
    );
  }

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
};
