import { supabase } from "@/integrations/supabase/client";
import { PlanItem } from "@/components/plan/constants";
import { assessContentQuality } from "@/utils/contentQuality";
import { sanitizeAndImproveContent } from "@/utils/contentQuality";

interface EmailGenerationResult {
  subject: string;
  preheader: string;
  body: string;
  cta_primary?: string;
  notes?: string;
  imageQuery?: string; // AI-generated Unsplash search keyword
}

interface BatchEmailRequest {
  month: string;
  themes: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  companyProfile?: {
    company_name?: string;
    brand_voice?: string;
    target_audience?: string;
  };
}

/**
 * Generate high-quality email content for plan items using AI
 */
export async function batchGenerateEmails(
  items: PlanItem[],
  month: string,
  themes: Array<{ id: string; label: string; description?: string; }>
): Promise<PlanItem[]> {
  console.log('Starting batch email generation', { 
    emailCount: items.filter(item => item.type === 'email').length,
    month,
    themes: themes.map(t => t.label)
  });

  // Filter to only email items
  const emailItems = items.filter(item => item.type === 'email');
  const nonEmailItems = items.filter(item => item.type !== 'email');

  if (emailItems.length === 0) {
    console.log('No email items to process');
    return items;
  }

  // Get company profile for context
  let companyProfile;
  try {
    const { data: profile } = await supabase
      .from('company_profiles')
      .select('company_name, brand_voice, target_audience')
      .single();
    companyProfile = profile;
  } catch (error) {
    console.log('Could not fetch company profile, continuing without context');
  }

  const processedEmailItems: PlanItem[] = [];

  // Process emails in batches to avoid overwhelming the API
  const batchSize = 3;
  for (let i = 0; i < emailItems.length; i += batchSize) {
    const batch = emailItems.slice(i, i + batchSize);
    
    for (const item of batch) {
      try {
        console.log(`Generating content for email: ${item.title}`);
        
        const emailContent = await generateSingleEmailContent({
          month,
          themes,
          companyProfile,
          emailType: determineEmailType(item)
        });

        if (emailContent) {
          // Apply quality assessment
          const subjectQuality = assessContentQuality(emailContent.subject, 'subject');
          const preheaderQuality = assessContentQuality(emailContent.preheader, 'preheader');
          const bodyQuality = assessContentQuality(emailContent.body, 'body');

          // Retry once if quality is poor
          let finalContent = emailContent;
          if (subjectQuality.level === 'poor' || preheaderQuality.level === 'poor') {
            console.log('Quality check failed, retrying with tighter constraints');
            const retryContent = await generateSingleEmailContent({
              month,
              themes,
              companyProfile,
              emailType: determineEmailType(item),
              constraints: {
                subjectLength: 45,
                preheaderLength: 80,
                tone: 'direct and benefit-focused'
              }
            });
            if (retryContent) {
              finalContent = retryContent;
            }
          }

          // Update item with generated content
          const updatedItem: PlanItem = {
            ...item,
            emailSubject: finalContent.subject,
            emailPreheader: finalContent.preheader,
            title: finalContent.subject, // Keep backward compatibility
            caption: formatEmailContent(finalContent.body),
            notes: finalContent.notes,
            imageQuery: finalContent.imageQuery // Preserve AI-generated image keyword
          };

          processedEmailItems.push(updatedItem);
        } else {
          // Fallback: use existing content but improve it
          const improvedCaption = item.caption ? formatEmailContent(sanitizeAndImproveContent(item.caption)) : item.caption;
          processedEmailItems.push({
            ...item,
            caption: improvedCaption
          });
        }
      } catch (error) {
        console.error(`Failed to generate content for email ${item.id}:`, error);
        // Fallback: use existing content
        const improvedCaption = item.caption ? formatEmailContent(sanitizeAndImproveContent(item.caption)) : item.caption;
        processedEmailItems.push({
          ...item,
          caption: improvedCaption
        });
      }
    }
    
    // Small delay between batches to be API-friendly
    if (i + batchSize < emailItems.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`Completed batch email generation: ${processedEmailItems.length} emails processed`);
  
  // Combine processed emails with non-email items
  return [...processedEmailItems, ...nonEmailItems];
}

/**
 * Generate content for a single email using the edge function
 */
async function generateSingleEmailContent(
  request: BatchEmailRequest & { 
    emailType?: string;
    constraints?: {
      subjectLength?: number;
      preheaderLength?: number;
      tone?: string;
    };
  }
): Promise<EmailGenerationResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-plan-email', {
      body: request
    });

    if (error) {
      console.error('Edge function error:', error);
      return null;
    }

    return data as EmailGenerationResult;
  } catch (error) {
    console.error('Failed to call generate-plan-email function:', error);
    return null;
  }
}

/**
 * Determine email type based on item properties
 */
function determineEmailType(item: PlanItem): string {
  if (item.title.toLowerCase().includes('newsletter')) {
    return 'newsletter';
  }
  if (item.title.toLowerCase().includes('announcement') || 
      item.title.toLowerCase().includes('update')) {
    return 'announcement';
  }
  return 'promotional';
}

/**
 * Improve existing email content with AI
 */
export async function improveEmailWithAI(
  item: PlanItem,
  month: string,
  themes: Array<{ id: string; label: string; description?: string; }>
): Promise<PlanItem> {
  console.log(`Improving email content for: ${item.title}`);
  
  const improved = await batchGenerateEmails([item], month, themes);
  return improved[0] || item;
}

/**
 * Shorten email content by approximately 20%
 */
export function shortenEmailContent(content: string): string {
  // If content is already short enough, return as-is
  if (content.length <= 150) {
    return content;
  }
  
  // For HTML content, work with text between tags
  if (content.includes('<')) {
    return shortenHtmlEmailContent(content);
  }
  
  // Split into sentences
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  if (sentences.length <= 1) {
    // For very short content, just trim words
    const words = content.split(' ');
    const targetLength = Math.ceil(words.length * 0.8);
    return words.slice(0, targetLength).join(' ');
  }
  
  // Remove about 20% of sentences, prioritizing shorter/less important ones
  const targetSentenceCount = Math.ceil(sentences.length * 0.8);
  
  // Sort by length (shorter sentences are more likely to be removed)
  const sentencesWithLength = sentences.map((sentence, index) => ({
    sentence: sentence.trim(),
    length: sentence.trim().length,
    originalIndex: index
  }));
  
  // Keep the longest and most important sentences
  const kept = sentencesWithLength
    .sort((a, b) => b.length - a.length)
    .slice(0, targetSentenceCount)
    .sort((a, b) => a.originalIndex - b.originalIndex);
  
  return kept.map(s => s.sentence).join('. ') + '.';
}

/**
 * Shorten HTML email content while preserving structure
 */
function shortenHtmlEmailContent(content: string): string {
  // Extract text content while preserving HTML structure
  const htmlTagRegex = /<[^>]*>/g;
  const textOnly = content.replace(htmlTagRegex, ' ').replace(/\s+/g, ' ').trim();
  
  if (textOnly.length <= 150) {
    return content;
  }
  
  // Shorten paragraphs - keep first 2-3 sentences per paragraph
  return content.replace(/<p>(.*?)<\/p>/g, (match, paragraphContent) => {
    const sentences = paragraphContent.split(/[.!?]+/).filter((s: string) => s.trim().length > 0);
    if (sentences.length <= 2) return match;
    
    // Keep first 2 sentences of each paragraph
    const shortened = sentences.slice(0, 2).join('. ').trim() + '.';
    return `<p>${shortened}</p>`;
  });
}

/**
 * Ensure email content is properly formatted with HTML structure
 */
export function formatEmailContent(content: string): string {
  if (!content) return content;
  
  // If content already has HTML tags, return as-is
  if (content.includes('<h') || content.includes('<p>')) {
    return content;
  }
  
  // Convert markdown-style bold to HTML
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Handle newlines and structure
  const lines = content.split(/\n+/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) return content;
  
  let formatted = '';
  
  // First line might be a heading if it's short and impactful
  if (lines[0].length < 60 && !lines[0].includes('.')) {
    formatted += `<h3>${lines[0].trim()}</h3>\n`;
    lines.shift(); // Remove the heading from remaining lines
  }
  
  // Wrap remaining lines in paragraphs
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine.length > 0) {
      formatted += `<p>${trimmedLine}</p>\n`;
    }
  });
  
  return formatted.trim();
}
