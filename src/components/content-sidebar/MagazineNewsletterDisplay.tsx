
import React from 'react';
import { useNewsletterRenderer } from '@/hooks/useNewsletterRenderer';
import { MagazineNewsletterRenderer } from '@/components/newsletter/MagazineNewsletterRenderer';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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

  // If structured newsletter, use the magazine renderer
  if (isStructured && processedNewsletter.blocks.length > 0) {
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
