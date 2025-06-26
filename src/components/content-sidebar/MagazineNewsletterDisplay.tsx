
import React, { useState } from 'react';
import { parseNewsletterYAML } from '@/utils/newsletterUtils';
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

  // Use the custom hook for image management
  const { images, loadingImages, imageErrors } = useNewsletterImages(
    processedNewsletter.blocks,
    isPlaceholderContent,
    contentTaskId
  );

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

  // Extract main headline from newsletter_md
  const headlineMatch = processedNewsletter.newsletter_md.match(/^# (.+)$/m);
  const headline = headlineMatch?.[1] || extractTitleFromContent(processedNewsletter.newsletter_md, campaignTitle) || campaignTitle || 'Newsletter Update';
  
  // Extract intro from newsletter_md
  const introMatch = processedNewsletter.newsletter_md.match(/\*(.+?)\*/);
  const intro = introMatch?.[1] || generateIntroFromContent(processedNewsletter.newsletter_md, campaignTitle);

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

      {/* Content Blocks */}
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

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-gray-200 text-center">
        <p className="text-gray-600">
          Thanks for reading! 🌿
        </p>
      </div>
    </div>
  );
};
