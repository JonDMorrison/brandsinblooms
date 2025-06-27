
import React, { useState } from 'react';
import { parseNewsletterYAML, processNewsletterMarkdown } from '@/utils/newsletterUtils';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewsletterRegenerator } from './newsletter/NewsletterRegenerator';
import { NewsletterContentBlock } from './newsletter/NewsletterContentBlock';
import { useNewsletterImages } from './newsletter/useNewsletterImages';
import {
  createBlocksFromPlainText,
  calculateReadingTime,
  extractTitleFromContent,
  generateIntroFromContent,
  checkIsPlaceholderContent
} from './newsletter/NewsletterHelpers';

interface MagazineNewsletterDisplayProps {
  content: string;
  className?: string;
  contentTaskId?: string;
  campaignTitle?: string;
}

export const MagazineNewsletterDisplay = ({ 
  content, 
  className,
  contentTaskId,
  campaignTitle 
}: MagazineNewsletterDisplayProps) => {
  const [regenerating, setRegenerating] = useState(false);

  console.log('🖼️ MagazineNewsletterDisplay received content:', {
    hasContent: !!content,
    contentLength: content?.length || 0,
    contentPreview: content?.substring(0, 200),
    contentTaskId,
    campaignTitle
  });

  const isPlaceholderContent = checkIsPlaceholderContent(content);

  console.log('🔍 Placeholder content check:', {
    isPlaceholder: isPlaceholderContent,
    contentLength: content?.length,
    trimmedLength: content?.trim().length,
    contentStart: content?.trim().substring(0, 100)
  });

  // If content is truly placeholder, show regeneration option
  if (isPlaceholderContent) {
    console.log('🔄 Showing regeneration UI due to truly placeholder content');
    return (
      <div className={`max-w-4xl mx-auto ${className || ''}`}>
        <NewsletterRegenerator
          contentTaskId={contentTaskId}
          campaignTitle={campaignTitle}
          regenerating={regenerating}
          setRegenerating={setRegenerating}
        />
      </div>
    );
  }

  // Try to parse as structured YAML first
  const newsletter = parseNewsletterYAML(content);
  
  // Create a robust newsletter structure for both YAML and plain text
  const processedNewsletter = newsletter || {
    newsletter_md: content || '',
    blocks: createBlocksFromPlainText(content || '', campaignTitle),
    extra_content_ideas: [],
    meta: {
      reading_time: calculateReadingTime(content || ''),
      theme: campaignTitle || 'Newsletter',
      week_focus: 'Content Update'
    }
  };

  console.log('📧 Newsletter processing result:', {
    wasYAML: !!newsletter,
    blockCount: processedNewsletter.blocks.length,
    hasNewsletterMd: !!processedNewsletter.newsletter_md
  });

  // Use the custom hook for image management
  const { images, loadingImages, imageErrors } = useNewsletterImages(
    processedNewsletter.blocks,
    isPlaceholderContent,
    contentTaskId
  );

  // Process the newsletter content for display
  let displayContent = '';
  if (newsletter && newsletter.newsletter_md) {
    // Use the YAML newsletter_md section
    displayContent = processNewsletterMarkdown(newsletter.newsletter_md);
  } else {
    // Process the raw content through markdown
    displayContent = processNewsletterMarkdown(content);
  }

  // Extract main headline from processed content
  const headline = extractTitleFromContent(content, campaignTitle) || campaignTitle || 'Newsletter Update';
  
  // Extract intro from content
  const intro = generateIntroFromContent(content, campaignTitle);

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
              regenerating={regenerating}
              setRegenerating={setRegenerating}
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
      {displayContent ? (
        <div className="prose prose-lg max-w-none mb-12">
          <div dangerouslySetInnerHTML={{ __html: displayContent }} />
        </div>
      ) : (
        /* Content Blocks for structured display */
        <div className="space-y-12">
          {processedNewsletter.blocks.map((block, index) => (
            <NewsletterContentBlock
              key={index}
              block={block}
              index={index}
              isStructuredNewsletter={!!newsletter}
              images={images}
              imageErrors={imageErrors}
              loadingImages={loadingImages}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200 text-center">
        <p className="text-gray-600">
          Thanks for reading! 🌿
        </p>
      </div>
    </div>
  );
};
