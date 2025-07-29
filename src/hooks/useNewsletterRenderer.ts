import { useMemo } from 'react';
import { processNewsletterContent } from '@/utils/newsletterContentProcessor';
import { useNewsletterImages } from '@/components/content-sidebar/newsletter/useNewsletterImages';

export interface NewsletterRendererOptions {
  content: string;
  campaignTitle?: string;
  contentTaskId?: string;
  format?: 'magazine' | 'plain';
  className?: string;
}

export interface NewsletterRendererResult {
  // Processed content
  processedNewsletter: ReturnType<typeof processNewsletterContent>;
  
  // Images
  images: Record<string | number, any>;
  featuredImage: any;
  loadingImages: boolean;
  imageErrors: any;
  
  // Meta info
  featuredImagePrompt: string;
  
  // Rendering utilities
  handleImageSelect: (blockIndex: number, prompt: string) => void;
  
  // State checks
  needsRegeneration: boolean;
  isStructured: boolean;
}

export const useNewsletterRenderer = ({
  content,
  campaignTitle,
  contentTaskId,
  format = 'magazine',
  className = ''
}: NewsletterRendererOptions): NewsletterRendererResult => {
  
  // Process the newsletter content with memoization
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

  // Handle image selection
  const handleImageSelect = (blockIndex: number, prompt: string) => {
    console.log(`[NEWSLETTER RENDERER] Image selection for block ${blockIndex}:`, prompt);
    // This could be enhanced to open an image selection modal
  };

  return {
    processedNewsletter,
    images,
    featuredImage,
    loadingImages,
    imageErrors,
    featuredImagePrompt,
    handleImageSelect,
    needsRegeneration: processedNewsletter.needsRegeneration,
    isStructured: processedNewsletter.isStructured
  };
};