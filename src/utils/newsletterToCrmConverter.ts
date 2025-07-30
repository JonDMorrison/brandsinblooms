import { processNewsletterContent } from './newsletterContentProcessor';
import { supabase } from '@/integrations/supabase/client';
import { mediaSelector, batchMediaSelector } from './mediaSelector';
import { ContentBlock } from '@/types/emailBuilder';

interface NewsletterToCRMResult {
  campaignName: string;
  subjectLine: string;
  emailContent: string;
  originalContent: string;
  isFromNewsletter: boolean;
  suggestedSegment?: string;
  blocks?: ContentBlock[];
}

export const convertNewsletterToCRM = async (
  contentTaskId: string,
  title: string,
  content: string,
  preservedImages?: Record<string, any>
): Promise<NewsletterToCRMResult> => {
  console.log('🔄 Converting newsletter to CRM campaign', { contentTaskId, title });

  // Fetch full newsletter content from database
  let fullContent = content;
  let originalTask = null;

  if (contentTaskId) {
    try {
      const { data: task } = await supabase
        .from('content_tasks')
        .select('ai_output, notes')
        .eq('id', contentTaskId)
        .single();

      if (task?.ai_output) {
        fullContent = task.ai_output;
        originalTask = task;
        console.log('✅ Retrieved full content from database');
      }
    } catch (error) {
      console.warn('⚠️ Could not fetch full content from database:', error);
    }
  }

  // Process the newsletter content
  const processed = processNewsletterContent(fullContent, title);
  console.log('📋 Processed newsletter:', {
    isStructured: processed.isStructured,
    hasBlocks: processed.blocks.length > 0,
    theme: processed.meta?.theme
  });

  // Generate campaign name from title or newsletter content
  const campaignName = generateCampaignName(title, processed);
  
  // Generate subject line suggestions
  const subjectLine = generateSubjectLine(processed, title);
  
  // Convert newsletter content to CRM blocks with layout and preserved images
  const { emailContent, blocks } = await convertToEmailBlocks(processed, preservedImages);

  return {
    campaignName,
    subjectLine,
    emailContent,
    originalContent: fullContent,
    isFromNewsletter: true,
    suggestedSegment: suggestSegment(processed),
    blocks
  };
};

const generateCampaignName = (title: string, processed: any): string => {
  // First priority: Use newsletter theme from YAML meta if available
  if (processed.meta?.theme && processed.meta.theme !== 'Newsletter' && processed.meta.theme !== 'Garden Newsletter') {
    return `📧 ${processed.meta.theme}`;
  }

  // Second priority: Extract title from newsletter content
  const contentTitle = processed.newsletter_md?.match(/^#\s+(.+)$/m)?.[1];
  if (contentTitle && !contentTitle.toLowerCase().includes('newsletter')) {
    return `📧 ${contentTitle}`;
  }

  // Third priority: Clean up the URL title
  const cleanTitle = title
    .replace(/Newsletter\s+Campaign\s*-?\s*/i, '')
    .replace(/\+/g, ' ')
    .replace(/%2F/g, '/')
    .replace(/%20/g, ' ')
    .trim();

  if (cleanTitle && cleanTitle !== 'Newsletter Campaign') {
    return `📧 ${cleanTitle}`;
  }

  return `📧 Garden Newsletter - ${new Date().toLocaleDateString()}`;
};

const generateSubjectLine = (processed: any, title: string): string => {
  // First priority: Use theme from YAML meta for specific subject line
  const theme = processed.meta?.theme;
  if (theme && theme !== 'Newsletter' && theme !== 'Garden Newsletter') {
    return `🌱 ${theme} - Expert Tips Inside`;
  }

  // Second priority: Try to extract the main header from newsletter content
  const mainHeader = processed.newsletter_md?.match(/^#\s+(.+)$/m)?.[1];
  if (mainHeader && !mainHeader.toLowerCase().includes('newsletter')) {
    return `🌱 ${mainHeader} - Expert Tips Inside`;
  }
  
  // Third priority: Use week focus if meaningful
  const weekFocus = processed.meta?.week_focus;
  if (weekFocus && weekFocus !== 'Content Update' && !weekFocus.toLowerCase().includes('newsletter')) {
    return `🌿 ${weekFocus} - Expert Tips Inside`;
  }
  
  // Fallback subject lines based on content
  if (processed.newsletter_md.toLowerCase().includes('summer')) {
    return '☀️ Summer Garden Care - Essential Tips';
  }
  
  if (processed.newsletter_md.toLowerCase().includes('spring')) {
    return '🌸 Spring Garden Prep - Get Ready!';
  }
  
  if (processed.newsletter_md.toLowerCase().includes('winter')) {
    return '❄️ Winter Garden Protection Guide';
  }
  
  if (processed.newsletter_md.toLowerCase().includes('fall') || processed.newsletter_md.toLowerCase().includes('autumn')) {
    return '🍂 Fall Garden Maintenance Tips';
  }
  
  return '🌱 Garden Care Tips - This Week\'s Focus';
};

const convertToEmailBlocks = async (processed: any, originalImages?: Record<string, any>): Promise<{ emailContent: string; blocks: ContentBlock[] }> => {
  const blocks: ContentBlock[] = [];
  
  console.log('[CRM SYNC] Converting newsletter to CRM blocks with preserved images');
  
  // Create header block from newsletter title and subtitle
  const headerBlock = await createHeaderBlock(processed, originalImages?.featured);
  if (headerBlock) {
    blocks.push(headerBlock);
    console.log(`[CRM SYNC] Created header block: ${headerBlock.title}`);
  }
  
  // Process structured blocks if available
  if (processed.blocks && processed.blocks.length > 0) {
    console.log(`[CRM SYNC] Processing ${processed.blocks.length} structured blocks`);
    
    // Create ContentBlocks from newsletter blocks  
    const newsletterBlocks = processed.blocks.map((block: any, index: number) => {
      // Check if block has image content
      const hasImage = !!(block.image_prompt || block.image_url);
      const hasText = !!(block.title || block.body);
      
      // Use image-text type for blocks with both text and images
      const blockType = hasImage && hasText ? 'image-text' : 'text';
      const blockLayout = hasImage && hasText ? 'image-right' : 'full-width';
      
      const contentBlock: ContentBlock = {
        id: `block-${index}`,
        type: blockType,
        layout: blockLayout,
        title: block.title || '',
        headline: block.title || '', // For image-text blocks
        body: block.body || '', // For image-text blocks  
        content: block.body || '', // For text blocks
        buttonText: block.cta || 'Learn More',
        buttonUrl: block.link || '#',
        ctaText: block.cta || 'Learn More',
        ctaUrl: block.link || '#',
        source: 'newsletter'
      };
      
      console.log(`[CRM SYNC] Created ${blockType} block with ${blockLayout} layout: ${contentBlock.title}`);
      return contentBlock;
    });
    
    // Use preserved images if available, otherwise fetch new ones
    if (originalImages && Object.keys(originalImages).length > 0) {
      console.log('[CRM SYNC] Using preserved newsletter images');
      
      newsletterBlocks.forEach((block, index) => {
        const preservedImage = originalImages[index];
        if (preservedImage) {
          block.imageUrl = preservedImage.url;
          block.altText = preservedImage.alt;
          console.log(`[CRM SYNC] Preserved image for "${block.title}":`, preservedImage.url);
        } else {
          // Fallback if no preserved image
          block.imageUrl = '/images/newsletter-fallback.jpg';
          block.altText = `Image for ${block.title}`;
          console.log(`[CRM SYNC] Used fallback for "${block.title}"`);
        }
        blocks.push(block);
      });
    } else {
      console.log('[CRM SYNC] No preserved images found, fetching new ones');
      
      // Extract image prompts for batch fetching
      const imagePrompts = processed.blocks.map((block: any) => 
        block.image_prompt || block.alt_text || block.title || 'garden center newsletter image'
      );
      const images = await batchMediaSelector(imagePrompts, '/images/newsletter-fallback.jpg');
      
      // Assign images to blocks
      newsletterBlocks.forEach((block, index) => {
        const selectedImage = images[index];
        block.imageUrl = selectedImage.url;
        block.altText = selectedImage.alt;
        
        console.log(`[CRM SYNC] Image selected for "${block.title}":`, selectedImage.url);
        blocks.push(block);
      });
    }
  }
  
  // Process unstructured sections if available
  if (processed.unstructuredSections && processed.unstructuredSections.length > 0) {
    console.log(`[CRM SYNC] Processing ${processed.unstructuredSections.length} unstructured sections`);
    
    const sectionBlocks = processed.unstructuredSections.map((section: any, index: number) => {
      // Check if section has image content
      const hasImage = !!(section.image_prompt || section.image_url);
      const hasText = !!(section.title || section.content);
      
      // Use image-text type for sections with both text and images
      const blockType = hasImage && hasText ? 'image-text' : 'text';
      const blockLayout = hasImage && hasText ? 'image-right' : 'full-width';
      
      const contentBlock: ContentBlock = {
        id: `section-${index}`,
        type: blockType,
        layout: blockLayout,
        title: section.title || '',
        headline: section.title || '', // For image-text blocks
        body: section.content || '', // For image-text blocks
        content: section.content || '', // For text blocks
        buttonText: section.cta || 'Learn More',
        buttonUrl: section.link || '#',
        ctaText: section.cta || 'Learn More',
        ctaUrl: section.link || '#',
        source: 'newsletter'
      };
      
      console.log(`[CRM SYNC] Created ${blockType} section with ${blockLayout} layout: ${contentBlock.title}`);
      return contentBlock;
    });
    
    // Use preserved images for sections if available, otherwise fetch new ones
    if (originalImages && Object.keys(originalImages).length > 0) {
      console.log('[CRM SYNC] Using preserved images for unstructured sections');
      
      sectionBlocks.forEach((block, index) => {
        const section = processed.unstructuredSections[index];
        const preservedImage = originalImages[section.id];
        if (preservedImage) {
          block.imageUrl = preservedImage.url;
          block.altText = preservedImage.alt;
          console.log(`[CRM SYNC] Preserved image for section "${block.title}":`, preservedImage.url);
        } else {
          // Fallback if no preserved image
          block.imageUrl = '/images/newsletter-fallback.jpg';
          block.altText = `Image for ${block.title}`;
          console.log(`[CRM SYNC] Used fallback for section "${block.title}"`);
        }
        blocks.push(block);
      });
    } else {
      console.log('[CRM SYNC] No preserved images found for sections, fetching new ones');
      
      // Extract image prompts for batch fetching
      const sectionImagePrompts = processed.unstructuredSections.map((section: any) => 
        section.image_prompt || section.title || 'garden center newsletter'
      );
      const sectionImages = await batchMediaSelector(sectionImagePrompts, '/images/newsletter-fallback.jpg');
      
      // Assign images to section blocks
      sectionBlocks.forEach((block, index) => {
        const selectedImage = sectionImages[index];
        block.imageUrl = selectedImage.url;
        block.altText = selectedImage.alt;
        
        console.log(`[CRM SYNC] Image selected for "${block.title}":`, selectedImage.url);
        blocks.push(block);
      });
    }
  }
  
  // Generate HTML content for email (existing functionality)
  const emailContent = convertToEmailHTML(processed);
  
  console.log(`[CRM SYNC] Created ${blocks.length} CRM blocks with layouts and images`);
  return { emailContent, blocks };
};

const convertToEmailHTML = (processed: any): string => {
  if (!processed.newsletter_md && processed.blocks.length === 0) {
    return '<p>Newsletter content could not be processed. Please check the original content.</p>';
  }

  let emailHTML = '';

  // Email header
  emailHTML += `
<div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
  <!-- Header Section -->
  <div style="background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px 20px; text-align: center; color: white;">
    <h1 style="margin: 0; font-size: 28px; font-weight: bold;">Your Garden Newsletter</h1>
    <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Expert tips for your thriving garden</p>
  </div>
  
  <!-- Content Section -->
  <div style="padding: 30px 20px; background: #ffffff;">
`;

  // Process newsletter markdown content
  if (processed.newsletter_md) {
    const emailFormattedContent = formatNewsletterForEmail(processed.newsletter_md);
    emailHTML += emailFormattedContent;
  }

  // Add blocks if available
  if (processed.blocks.length > 0) {
    emailHTML += '<div style="margin-top: 30px;">';
    
    processed.blocks.forEach((block: any) => {
      if (block.title || block.body) {
        emailHTML += `
<div style="margin-bottom: 30px; padding: 20px; background: #f8fafc; border-left: 4px solid #22c55e; border-radius: 8px;">
  <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 20px; font-weight: 600;">${block.title}</h3>
  <p style="margin: 0 0 15px 0; color: #64748b; line-height: 1.6;">${block.body}</p>
  ${block.cta && block.link ? `
  <div style="margin-top: 20px;">
    <a href="${block.link}" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">${block.cta}</a>
  </div>
  ` : ''}
</div>
        `;
      }
    });
    
    emailHTML += '</div>';
  }

  // Email footer
  emailHTML += `
  </div>
  
  <!-- Footer Section -->
  <div style="background: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 14px;">
    <p style="margin: 0 0 10px 0;">Thanks for reading our garden newsletter!</p>
    <p style="margin: 0; font-size: 12px;">
      Visit us at your local garden center for more expert advice and quality plants.
    </p>
  </div>
</div>
`;

  return emailHTML;
};

const formatNewsletterForEmail = (content: string): string => {
  let formatted = content;

  // Convert markdown headers to email-friendly HTML
  formatted = formatted
    .replace(/^# (.+)$/gm, '<h2 style="color: #1e40af; font-size: 24px; font-weight: 600; margin: 0 0 20px 0; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">$1</h2>')
    .replace(/^## (.+)$/gm, '<h3 style="color: #475569; font-size: 20px; font-weight: 600; margin: 25px 0 15px 0;">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="color: #64748b; font-size: 18px; font-weight: 500; margin: 20px 0 10px 0;">$1</h4>');

  // Convert bold and italic
  formatted = formatted
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #1e293b; font-weight: 600;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color: #475569;">$1</em>');

  // Convert paragraphs
  const paragraphs = formatted.split(/\n\s*\n/).filter(p => p.trim());
  formatted = paragraphs.map(para => {
    const trimmed = para.trim();
    // Skip if already wrapped in HTML tags
    if (trimmed.match(/^<(h[1-6]|div|p)/)) {
      return trimmed;
    }
    return `<p style="margin: 0 0 16px 0; color: #475569; line-height: 1.6;">${trimmed}</p>`;
  }).join('\n');

  return formatted;
};

const suggestSegment = (processed: any): string | undefined => {
  // Analyze content to suggest appropriate segment
  const content = processed.newsletter_md.toLowerCase();
  
  if (content.includes('expert') || content.includes('advanced')) {
    return 'Expert Gardeners';
  }
  
  if (content.includes('beginner') || content.includes('start') || content.includes('new')) {
    return 'New Gardeners';
  }
  
  if (content.includes('vegetable') || content.includes('herb')) {
    return 'Vegetable Gardeners';
  }
  
  if (content.includes('flower') || content.includes('bloom')) {
    return 'Flower Enthusiasts';
  }
  
  if (content.includes('indoor') || content.includes('houseplant')) {
    return 'Indoor Plant Lovers';
  }
  
  return undefined;
};

const createHeaderBlock = async (processed: any, preservedFeaturedImage?: any): Promise<ContentBlock | null> => {
  try {
    const newsletterMd = processed.newsletter_md || '';
    
    // Extract main title using regex (stop at first asterisk to avoid duplication)
    const titleMatch = newsletterMd.match(/^#\s+([^*\n]+)/m);
    const title = titleMatch?.[1]?.trim() || 'Garden Newsletter';
    
    // Extract subtitle/description (italic text)
    const subtitleMatch = newsletterMd.match(/\*(.*?)\*/);
    const subtitle = subtitleMatch?.[1] || 'Expert gardening insights and tips';
    
    console.log(`[CRM SYNC] Creating header block with title: "${title}"`);
    
    // Use preserved featured image if available, otherwise fetch new one
    let headerImage;
    if (preservedFeaturedImage) {
      console.log('[CRM SYNC] Using preserved featured image for header');
      headerImage = {
        url: preservedFeaturedImage.url,
        alt: preservedFeaturedImage.alt || 'Newsletter header'
      };
    } else {
      console.log('[CRM SYNC] Fetching new header image');
      try {
        const headerImagePrompt = `${title} garden newsletter header banner`;
        headerImage = await mediaSelector({ 
          prompt: headerImagePrompt, 
          fallback: '/images/newsletter-fallback.jpg' 
        });
      } catch (imageError) {
        console.warn('[CRM SYNC] Header image fetch failed:', imageError);
        headerImage = { url: '/images/newsletter-fallback.jpg', alt: 'Newsletter header' };
      }
    }
    
    const headerBlock: ContentBlock = {
      id: 'header-block',
      type: 'header',
      layout: 'full-width',
      title: title, // Use title instead of headline for consistency
      headline: title,
      body: subtitle,
      imageUrl: headerImage.url,
      altText: headerImage.alt,
      source: 'newsletter'
    };
    
    console.log(`[CRM SYNC] Header image selected:`, headerImage.url);
    return headerBlock;
  } catch (error) {
    console.error('[CRM SYNC] Failed to create header block:', error);
    return null;
  }
};