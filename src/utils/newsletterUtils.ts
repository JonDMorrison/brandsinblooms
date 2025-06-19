
interface NewsletterBlock {
  title: string;
  body: string;
  cta: string;
  link: string;
  image_prompt: string;
  alt_text: string;
}

interface ContentIdea {
  title: string;
  quick_desc: string;
}

interface NewsletterMeta {
  reading_time: string;
  theme: string;
  week_focus: string;
}

export interface StructuredNewsletter {
  newsletter_md: string;
  blocks: NewsletterBlock[];
  extra_content_ideas: ContentIdea[];
  meta: NewsletterMeta;
}

export const parseNewsletterYAML = (yamlContent: string): StructuredNewsletter | null => {
  try {
    // Simple YAML parsing for our specific structure
    const lines = yamlContent.split('\n');
    const result: any = {
      blocks: [],
      extra_content_ideas: [],
      meta: {}
    };
    
    let currentSection = '';
    let newsletterMd = '';
    let inNewsletterMd = false;
    let currentBlock: any = {};
    let currentIdea: any = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      if (trimmed === 'newsletter_md: |') {
        inNewsletterMd = true;
        currentSection = 'newsletter_md';
        continue;
      }
      
      if (trimmed === 'blocks:') {
        inNewsletterMd = false;
        currentSection = 'blocks';
        continue;
      }
      
      if (trimmed === 'extra_content_ideas:') {
        currentSection = 'extra_content_ideas';
        continue;
      }
      
      if (trimmed === 'meta:') {
        currentSection = 'meta';
        continue;
      }
      
      if (inNewsletterMd && currentSection === 'newsletter_md') {
        newsletterMd += line + '\n';
        continue;
      }
      
      if (currentSection === 'blocks' && trimmed.startsWith('- title:')) {
        if (Object.keys(currentBlock).length > 0) {
          result.blocks.push(currentBlock);
        }
        currentBlock = {
          title: trimmed.replace('- title:', '').replace(/"/g, '').trim()
        };
      } else if (currentSection === 'blocks' && trimmed.startsWith('body:')) {
        currentBlock.body = trimmed.replace('body:', '').replace(/"/g, '').trim();
      } else if (currentSection === 'blocks' && trimmed.startsWith('cta:')) {
        currentBlock.cta = trimmed.replace('cta:', '').replace(/"/g, '').trim();
      } else if (currentSection === 'blocks' && trimmed.startsWith('link:')) {
        currentBlock.link = trimmed.replace('link:', '').replace(/"/g, '').trim();
      } else if (currentSection === 'blocks' && trimmed.startsWith('image_prompt:')) {
        currentBlock.image_prompt = trimmed.replace('image_prompt:', '').replace(/"/g, '').trim();
      } else if (currentSection === 'blocks' && trimmed.startsWith('alt_text:')) {
        currentBlock.alt_text = trimmed.replace('alt_text:', '').replace(/"/g, '').trim();
      }
      
      if (currentSection === 'extra_content_ideas' && trimmed.startsWith('- title:')) {
        if (Object.keys(currentIdea).length > 0) {
          result.extra_content_ideas.push(currentIdea);
        }
        currentIdea = {
          title: trimmed.replace('- title:', '').replace(/"/g, '').trim()
        };
      } else if (currentSection === 'extra_content_ideas' && trimmed.startsWith('quick_desc:')) {
        currentIdea.quick_desc = trimmed.replace('quick_desc:', '').replace(/"/g, '').trim();
      }
      
      if (currentSection === 'meta') {
        if (trimmed.startsWith('reading_time:')) {
          result.meta.reading_time = trimmed.replace('reading_time:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('theme:')) {
          result.meta.theme = trimmed.replace('theme:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('week_focus:')) {
          result.meta.week_focus = trimmed.replace('week_focus:', '').replace(/"/g, '').trim();
        }
      }
    }
    
    // Add last items
    if (Object.keys(currentBlock).length > 0) {
      result.blocks.push(currentBlock);
    }
    if (Object.keys(currentIdea).length > 0) {
      result.extra_content_ideas.push(currentIdea);
    }
    
    result.newsletter_md = newsletterMd.trim();
    return result as StructuredNewsletter;
  } catch (error) {
    console.error('Error parsing newsletter YAML:', error);
    return null;
  }
};

export const formatNewsletterForDisplay = (newsletter: StructuredNewsletter): string => {
  if (!newsletter.newsletter_md) return '';
  
  // Convert markdown to HTML for display
  return newsletter.newsletter_md
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-6 text-slate-900">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold mb-4 mt-8 text-slate-900">$2</h2>')
    .replace(/^\*(.+)\*$/gm, '<p class="text-lg italic mb-6 text-slate-700">$1</p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>')
    .replace(/^([^<#*\-].+)$/gm, '<p class="mb-4 text-slate-700 leading-relaxed">$1</p>')
    .replace(/^---$/gm, '<hr class="border-t border-slate-200 my-8">')
    .replace(/\n\n/g, '\n')
    .trim();
};

export const getNewsletterMetadata = (newsletter: StructuredNewsletter) => {
  return {
    title: newsletter.newsletter_md.match(/^# (.+)$/m)?.[1] || 'Newsletter',
    readingTime: newsletter.meta.reading_time || '≈3 min',
    theme: newsletter.meta.theme,
    weekFocus: newsletter.meta.week_focus,
    blockCount: newsletter.blocks.length,
    contentIdeas: newsletter.extra_content_ideas.length
  };
};
