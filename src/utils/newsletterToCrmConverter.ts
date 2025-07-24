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
  content: string
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
  
  // Convert newsletter content to CRM blocks with layout and images
  const { emailContent, blocks } = await convertToEmailBlocks(processed);

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
  // Clean up the title
  const cleanTitle = title
    .replace(/Newsletter\s+Campaign\s*-?\s*/i, '')
    .replace(/\+/g, ' ')
    .replace(/%2F/g, '/')
    .replace(/%20/g, ' ')
    .trim();

  if (cleanTitle && cleanTitle !== 'Newsletter Campaign') {
    return `📧 ${cleanTitle}`;
  }

  // Fallback to newsletter theme or content
  if (processed.meta?.theme && processed.meta.theme !== 'Newsletter') {
    return `📧 ${processed.meta.theme}`;
  }

  // Extract title from newsletter content
  const contentTitle = processed.newsletter_md.match(/^#\s+(.+)$/m)?.[1];
  if (contentTitle) {
    return `📧 ${contentTitle}`;
  }

  return `📧 Garden Newsletter - ${new Date().toLocaleDateString()}`;
};

const generateSubjectLine = (processed: any, title: string): string => {
  // Extract main theme or focus with safe null handling
  const theme = processed.meta?.theme;
  const weekFocus = processed.meta?.week_focus;
  
  // Try to extract the main header from newsletter content
  const mainHeader = processed.newsletter_md.match(/^#\s+(.+)$/m)?.[1];
  
  if (mainHeader && !mainHeader.includes('Newsletter')) {
    return `🌱 ${mainHeader}`;
  }
  
  if (weekFocus && weekFocus !== 'Content Update') {
    return `🌿 ${weekFocus} - Expert Tips Inside`;
  }
  
  if (theme && theme !== 'Newsletter') {
    return `🌱 ${theme} - Your Garden Update`;
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

const convertToEmailBlocks = async (processed: any): Promise<{ emailContent: string; blocks: ContentBlock[] }> => {
  const blocks: ContentBlock[] = [];
  
  console.log('[CRM SYNC] Converting newsletter to CRM blocks with layouts and images');
  
  // Create header block from newsletter title and subtitle
  const headerBlock = await createHeaderBlock(processed);
  if (headerBlock) {
    blocks.push(headerBlock);
    console.log(`[CRM SYNC] Created header block: ${headerBlock.title}`);
  }
  
  // Process structured blocks if available
  if (processed.blocks && processed.blocks.length > 0) {
    console.log(`[CRM SYNC] Processing ${processed.blocks.length} structured blocks`);
    
    // Create ContentBlocks from newsletter blocks
    const newsletterBlocks = processed.blocks.map((block: any, index: number) => {
      const contentBlock: ContentBlock = {
        id: `block-${index}`,
        type: 'text', // Keeping as 'text' since Layout2 works well with text blocks
        layout: 'two-column-right', // Assign text-left-image-right layout
        title: block.title || '',
        content: block.body || '',
        ctaText: block.cta || 'Learn More',
        ctaUrl: block.link || '#',
        source: 'newsletter'
      };
      
      console.log(`[CRM SYNC] Assigned layout "two-column-right" to block: ${contentBlock.title}`);
      return contentBlock;
    });
    
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
  
  // Process unstructured sections if available
  if (processed.unstructuredSections && processed.unstructuredSections.length > 0) {
    console.log(`[CRM SYNC] Processing ${processed.unstructuredSections.length} unstructured sections`);
    
    const sectionBlocks = processed.unstructuredSections.map((section: any, index: number) => {
      const contentBlock: ContentBlock = {
        id: `section-${index}`,
        type: 'text', // Keeping as 'text' since Layout2 works well with text blocks
        layout: 'two-column-right',
        title: section.title || '',
        content: section.content || '',
        ctaText: section.cta || 'Learn More',
        ctaUrl: section.link || '#',
        source: 'newsletter'
      };
      
      console.log(`[CRM SYNC] Assigned layout "two-column-right" to section: ${contentBlock.title}`);
      return contentBlock;
    });
    
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

const createHeaderBlock = async (processed: any): Promise<ContentBlock | null> => {
  const newsletterMd = processed.newsletter_md || '';
  
  // Extract main title using regex (stop at first asterisk to avoid duplication)
  const titleMatch = newsletterMd.match(/^#\s+([^*\n]+)/m);
  const title = titleMatch?.[1]?.trim() || 'Garden Newsletter';
  
  // Extract subtitle/description (italic text)
  const subtitleMatch = newsletterMd.match(/\*(.*?)\*/);
  const subtitle = subtitleMatch?.[1] || 'Expert gardening insights and tips';
  
  console.log(`[CRM SYNC] Creating header block with title: "${title}"`);
  
  // Fetch header image
  const headerImagePrompt = `${title} garden newsletter header banner`;
  const headerImage = await mediaSelector({ 
    prompt: headerImagePrompt, 
    fallback: '/images/newsletter-fallback.jpg' 
  });
  
  const headerBlock: ContentBlock = {
    id: 'header-block',
    type: 'header',
    layout: 'full-width',
    headline: title,
    body: subtitle,
    imageUrl: headerImage.url,
    altText: headerImage.alt,
    source: 'newsletter'
  };
  
  console.log(`[CRM SYNC] Header image selected:`, headerImage.url);
  return headerBlock;
};