import React from 'react';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
import { processNewsletterContent, convertNewsletterMarkdownToHtml } from '@/utils/newsletterContentProcessor';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import { NewsletterRegenerator } from './NewsletterRegenerator';
import { NewsletterContentBlock } from './NewsletterContentBlock';
import { useNewsletterImages } from './useNewsletterImages';
import {
  calculateReadingTime,
  extractTitleFromContent,
  generateIntroFromContent,
  checkIsPlaceholderContent
} from './NewsletterHelpers';

interface OptimizedNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
}

export const OptimizedNewsletterDisplay = ({ 
  content, 
  className,
  contentTaskId,
  campaignTitle 
}: OptimizedNewsletterDisplayProps) => {
  const isPlaceholderContent = checkIsPlaceholderContent(content);
  
  console.log('[NEWSLETTER] OptimizedNewsletterDisplay processing:', {
    hasContent: !!content,
    contentLength: content?.length || 0,
    isPlaceholder: isPlaceholderContent,
    contentTaskId,
    campaignTitle
  });

  // Process the newsletter content
  const processedNewsletter = processNewsletterContent(content || '', campaignTitle);
  
  // Use the specialized newsletter images hook for structured newsletters only
  const { images, loadingImages, imageErrors } = useNewsletterImages(
    processedNewsletter.blocks,
    isPlaceholderContent || !processedNewsletter.isStructured,
    contentTaskId
  );

  // Extract main headline from processed content
  const headline = extractTitleFromContent(content, campaignTitle) || campaignTitle || 'Newsletter Update';
  
  // Extract intro from content
  const intro = generateIntroFromContent(content, campaignTitle);

  // If content is placeholder or incomplete, show regeneration option
  if (isPlaceholderContent) {
    console.log('[NEWSLETTER] Showing regeneration component for placeholder content');
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <NewsletterRegenerator
          contentTaskId={contentTaskId}
          campaignTitle={campaignTitle || 'Roses Week'}
          regenerating={false}
          setRegenerating={() => {}}
        />
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto ${className || ''}`}>
      {/* Header Section */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="outline" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {processedNewsletter.meta.reading_time}
          </Badge>
          {processedNewsletter.meta.theme && (
            <Badge variant="secondary">
              {processedNewsletter.meta.theme}
            </Badge>
          )}
          <Badge variant="outline">
            Newsletter
          </Badge>
          {contentTaskId && (
            <NewsletterRegenerator
              contentTaskId={contentTaskId}
              campaignTitle={campaignTitle}
              regenerating={false}
              setRegenerating={() => {}}
            />
          )}
        </div>
        
        <h1 className="text-4xl font-bold text-slate-900 leading-tight mb-4">
          {headline}
        </h1>
        
        {intro && (
          <p className="text-xl text-slate-600 leading-relaxed font-light">
            {intro}
          </p>
        )}
      </div>

      {/* Main Content */}
      {processedNewsletter.isStructured && processedNewsletter.blocks.length > 0 ? (
        /* Structured Newsletter - Use block-based display */
        <div className="space-y-12">
          {processedNewsletter.blocks.map((block, index) => (
            <NewsletterContentBlock
              key={index}
              block={block}
              index={index}
              isStructuredNewsletter={true}
              images={images}
              imageErrors={imageErrors}
              loadingImages={loadingImages}
            />
          ))}
        </div>
      ) : processedNewsletter.newsletter_md ? (
        /* Enhanced Markdown Content */
        <div className="prose prose-lg max-w-none mb-12 newsletter-enhanced-content">
          <div 
            className="newsletter-content"
            dangerouslySetInnerHTML={{ 
              __html: convertNewsletterMarkdownToHtml(processedNewsletter.newsletter_md) 
            }} 
          />
        </div>
      ) : (
        /* Plain Text Fallback */
        <div className="prose prose-lg max-w-none mb-12">
          <div 
            className="newsletter-content"
            dangerouslySetInnerHTML={{ 
              __html: convertNewsletterMarkdownToHtml(content) 
            }} 
          />
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200 text-center">
        <p className="text-gray-600">
          Thanks for reading! 🌿
        </p>
      </div>

      {/* Enhanced Newsletter Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .newsletter-enhanced-content .newsletter-content h2 {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            border-radius: 8px;
            padding: 12px 16px;
            margin: 2rem 0 1rem 0;
            border-left: 4px solid #68BEB9;
          }
          
          .newsletter-enhanced-content .newsletter-content h3 {
            background: #f1f5f9;
            border-radius: 6px;
            padding: 8px 12px;
            margin: 1.5rem 0 0.75rem 0;
            border-left: 3px solid #94a3b8;
          }
          
          .newsletter-enhanced-content .newsletter-content p {
            line-height: 1.7;
            margin-bottom: 1rem;
          }
          
          .newsletter-enhanced-content .newsletter-content ul {
            background: #fefefe;
            border-radius: 8px;
            padding: 1rem 1.5rem;
            border-left: 3px solid #22c55e;
          }
        `
      }} />
    </div>
  );
};