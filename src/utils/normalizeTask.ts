
import { parseNewsletterYAML } from './newsletterUtils';
import { cleanContentForDisplay, truncateText } from './contentUtils';
import { markdownToHtmlBlocks, extractKeywordsFromContent } from './markdownUtils';

export interface NormalizedTask {
  id: string;
  post_type: string;
  ai_output: string;
  image_prompts?: string[];
  normalized?: any;
  teaser_html?: string;
  title?: string;
  status?: string;
  campaigns?: any;
  [key: string]: any;
}

export function normalizeTask(task: any): NormalizedTask {
  if (!task) return task;
  
  const out = { ...task };

  // 1. Ensure image_prompts array exists
  if (!Array.isArray(out.image_prompts) || !out.image_prompts.length) {
    // Generate smart defaults based on content and campaign
    const contentKeywords = extractKeywordsFromContent(out.ai_output);
    const campaignTheme = out.campaigns?.theme || '';
    const themeKeywords = extractKeywordsFromContent(campaignTheme, 'seasonal');
    
    // Combine content and theme keywords
    out.image_prompts = [...contentKeywords, ...themeKeywords.slice(0, 2)];
  }

  // 2. Enhanced NEWSLETTER content normalization
  if (out.post_type === 'newsletter') {
    const raw = out.ai_output?.trim() || '';
    
    // Try to parse as structured YAML newsletter
    const parsedNewsletter = parseNewsletterYAML(raw);
    
    if (parsedNewsletter) {
      // Already structured - use as is but enhance image prompts
      out.normalized = {
        ...parsedNewsletter,
        blocks: parsedNewsletter.blocks.map((block, index) => ({
          ...block,
          image_prompt: block.image_prompt || out.image_prompts?.[index] || `newsletter ${out.campaigns?.theme || 'garden center'} professional`,
          alt_text: block.alt_text || `${block.title} - newsletter content image`
        }))
      };
    } else {
      // Plain text newsletter - create enhanced structured format
      const blocks = markdownToHtmlBlocks(raw);
      const title = blocks.find(b => b.type === 'header')?.text || out.title || 'Newsletter';
      
      // Create meaningful sections from plain text content
      const contentSections = raw.split(/\n\n+/).filter(section => section.trim().length > 50);
      const newsletterBlocks = contentSections.map((section, index) => {
        const sectionTitle = section.match(/^([^.!?\n]{10,60})/)?.[1]?.trim() || `Section ${index + 1}`;
        const cleanSection = section.replace(/^[^.!?\n]*[.!?]\s*/, '').trim();
        
        return {
          title: sectionTitle,
          body: cleanSection || section,
          cta: index === contentSections.length - 1 ? 'Visit us for expert advice' : '',
          link: '',
          image_prompt: `${out.campaigns?.theme || 'garden center'} ${sectionTitle.toLowerCase()} professional newsletter`,
          alt_text: `${sectionTitle} - newsletter image`
        };
      });

      out.normalized = {
        newsletter_md: raw,
        blocks: newsletterBlocks.length > 0 ? newsletterBlocks : [{
          title: title,
          body: raw,
          cta: 'Visit us for expert advice',
          link: '',
          image_prompt: `${out.campaigns?.theme || 'garden center'} newsletter professional informative`,
          alt_text: `${title} - newsletter content image`
        }],
        extra_content_ideas: [],
        meta: {
          reading_time: '≈3 min',
          theme: out.campaigns?.theme || 'Newsletter',
          week_focus: 'Seasonal gardening advice'
        }
      };
    }
    return out;
  }

  // 3. Normalize BLOG content (add teaser_html if missing)
  if (out.post_type === 'blog' && !out.teaser_html) {
    const blocks = markdownToHtmlBlocks(out.ai_output || '');
    const firstParagraph = blocks.find(b => b.type === 'paragraph')?.body;
    out.teaser_html = firstParagraph ? truncateText(firstParagraph, 300, '...') : '';
  }

  // 4. Clean content for display
  out.display_content = cleanContentForDisplay(out.ai_output || '', out.post_type);

  return out;
}

// Batch normalize multiple tasks
export function normalizeTasks(tasks: any[]): NormalizedTask[] {
  if (!Array.isArray(tasks)) return [];
  return tasks.map(normalizeTask);
}

// Check if a task needs normalization
export function needsNormalization(task: any): boolean {
  if (!task) return false;
  
  // Check for missing image_prompts
  if (!Array.isArray(task.image_prompts) || task.image_prompts.length === 0) {
    return true;
  }
  
  // Check for newsletter without normalized format
  if (task.post_type === 'newsletter' && !task.normalized && task.ai_output) {
    const isStructured = task.ai_output.includes('newsletter_md:') || task.ai_output.includes('blocks:');
    return !isStructured;
  }
  
  // Check for blog without teaser
  if (task.post_type === 'blog' && task.ai_output && !task.teaser_html) {
    return true;
  }
  
  return false;
}
