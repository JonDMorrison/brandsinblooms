import { parseNewsletterYAML } from './newsletterUtils';
import { cleanContentForDisplay, truncateText } from './contentUtils';
import { markdownToHtmlBlocks, extractKeywordsFromContent } from './markdownUtils';
import { ContentTask, ContentBlock, ContentMetadata } from '@/types/content';

export interface ProcessedContent {
  blocks: ContentBlock[];
  metadata: ContentMetadata;
  extra_content_ideas: Array<{
    title: string;
    quick_desc: string;
  }>;
  isStructured: boolean;
  needsRegeneration: boolean;
}

/**
 * Universal content processor that can handle all content types
 * with the structured block format originally developed for newsletters
 */
export function processUniversalContent(task: ContentTask): ProcessedContent {
  if (!task || !task.ai_output) {
    return {
      blocks: [],
      metadata: {},
      extra_content_ideas: [],
      isStructured: false,
      needsRegeneration: true
    };
  }

  const contentType = task.post_type || 'unknown';
  const raw = task.ai_output.trim();

  // Try to parse as structured content first
  if (contentType === 'newsletter') {
    return processNewsletterContent(task, raw);
  }

  // Process other content types into structured format
  switch (contentType) {
    case 'instagram':
    case 'facebook':
      return processSocialContent(task, raw);
    case 'blog':
      return processBlogContent(task, raw);
    case 'video':
      return processVideoContent(task, raw);
    case 'email':
      return processEmailContent(task, raw);
    case 'event':
      return processEventContent(task, raw);
    default:
      return processGenericContent(task, raw);
  }
}

function processNewsletterContent(task: ContentTask, raw: string): ProcessedContent {
  const parsedNewsletter = parseNewsletterYAML(raw);
  
  if (parsedNewsletter) {
    // Already structured - enhance with metadata
    return {
      blocks: parsedNewsletter.blocks.map((block, index) => ({
        ...block,
        id: `block-${index}`,
        order_index: index,
        block_type: 'text' as const,
        image_prompt: block.image_prompt || generateImagePrompt(task, block.title),
        alt_text: block.alt_text || `${block.title} - newsletter content image`
      })),
      metadata: {
        reading_time: parsedNewsletter.meta?.reading_time || '≈3 min',
        theme: parsedNewsletter.meta?.theme || task.campaigns?.theme || 'Newsletter',
        week_focus: parsedNewsletter.meta?.week_focus || 'Seasonal content',
        content_type: 'newsletter',
        structured_format: true,
        image_prompts: parsedNewsletter.blocks.map(b => b.image_prompt || '').filter(Boolean)
      },
      extra_content_ideas: parsedNewsletter.extra_content_ideas || [],
      isStructured: true,
      needsRegeneration: false
    };
  }

  // Convert plain newsletter to structured format
  const blocks = createNewsletterBlocks(task, raw);
  return {
    blocks,
    metadata: createMetadata(task, 'newsletter', blocks),
    extra_content_ideas: [],
    isStructured: false,
    needsRegeneration: false
  };
}

function processSocialContent(task: ContentTask, raw: string): ProcessedContent {
  // Parse hashtags if present
  const hashtagMatch = raw.match(/(#\w+(?:\s+#\w+)*)\s*$/);
  const hashtags = hashtagMatch ? hashtagMatch[1] : '';
  const mainContent = hashtagMatch ? raw.replace(hashtagMatch[0], '').trim() : raw;

  // Split into paragraphs for multi-slide posts
  const paragraphs = mainContent.split('\n\n').filter(p => p.trim().length > 0);
  
  const blocks: ContentBlock[] = paragraphs.map((paragraph, index) => ({
    id: `social-block-${index}`,
    title: index === 0 ? extractTitle(paragraph) : `Slide ${index + 1}`,
    body: paragraph.trim(),
    cta: index === paragraphs.length - 1 ? 'Visit us for expert advice' : '',
    link: '',
    image_prompt: generateImagePrompt(task, paragraph),
    alt_text: `${task.post_type} content - ${index === 0 ? 'main post' : `slide ${index + 1}`}`,
    order_index: index,
    block_type: 'text' as const,
    metadata: {
      hashtags: index === paragraphs.length - 1 ? hashtags : ''
    }
  }));

  return {
    blocks,
    metadata: createMetadata(task, task.post_type || 'social', blocks),
    extra_content_ideas: generateContentIdeas(task.campaigns?.theme || 'social media'),
    isStructured: true,
    needsRegeneration: false
  };
}

function processBlogContent(task: ContentTask, raw: string): ProcessedContent {
  const htmlBlocks = markdownToHtmlBlocks(raw);
  const blocks: ContentBlock[] = [];
  
  let currentBlock: Partial<ContentBlock> = {};
  let blockIndex = 0;

  for (const htmlBlock of htmlBlocks) {
    if (htmlBlock.type === 'header' && htmlBlock.level <= 2) {
      // Save previous block if exists
      if (currentBlock.title && currentBlock.body) {
        blocks.push({
          id: `blog-block-${blockIndex}`,
          title: currentBlock.title,
          body: currentBlock.body,
          cta: blockIndex === 0 ? 'Read more tips' : '',
          link: '',
          image_prompt: generateImagePrompt(task, currentBlock.title),
          alt_text: `${currentBlock.title} - blog section image`,
          order_index: blockIndex,
          block_type: 'text' as const
        });
        blockIndex++;
      }
      
      // Start new block
      currentBlock = {
        title: htmlBlock.text || `Section ${blockIndex + 1}`,
        body: ''
      };
    } else if (htmlBlock.type === 'paragraph') {
      if (!currentBlock.title) {
        currentBlock.title = extractTitle(htmlBlock.body || '');
      }
      currentBlock.body = (currentBlock.body || '') + (htmlBlock.body || '') + '\n\n';
    }
  }

  // Save final block
  if (currentBlock.title && currentBlock.body) {
    blocks.push({
      id: `blog-block-${blockIndex}`,
      title: currentBlock.title,
      body: currentBlock.body.trim(),
      cta: 'Learn more at our garden center',
      link: '',
      image_prompt: generateImagePrompt(task, currentBlock.title),
      alt_text: `${currentBlock.title} - blog section image`,
      order_index: blockIndex,
      block_type: 'text' as const
    });
  }

  return {
    blocks,
    metadata: createMetadata(task, 'blog', blocks),
    extra_content_ideas: generateContentIdeas(task.campaigns?.theme || 'gardening tips'),
    isStructured: true,
    needsRegeneration: false
  };
}

function processVideoContent(task: ContentTask, raw: string): ProcessedContent {
  // Split video script into scenes/segments
  const segments = raw.split(/(?:\n\s*\n|\.\s+)/).filter(segment => 
    segment.trim().length > 20
  );

  const blocks: ContentBlock[] = segments.map((segment, index) => ({
    id: `video-scene-${index}`,
    title: `Scene ${index + 1}`,
    body: segment.trim(),
    cta: index === segments.length - 1 ? 'Visit our garden center' : '',
    link: '',
    image_prompt: generateImagePrompt(task, segment),
    alt_text: `Video scene ${index + 1}`,
    order_index: index,
    block_type: 'video_scene' as const,
    metadata: {
      duration: estimateSceneDuration(segment),
      scene_type: index === 0 ? 'intro' : index === segments.length - 1 ? 'outro' : 'main'
    }
  }));

  return {
    blocks,
    metadata: {
      ...createMetadata(task, 'video', blocks),
      reading_time: estimateTotalDuration(blocks),
      keywords: extractKeywordsFromContent(raw, 'video')
    },
    extra_content_ideas: generateContentIdeas(task.campaigns?.theme || 'video content'),
    isStructured: true,
    needsRegeneration: false
  };
}

function processEmailContent(task: ContentTask, raw: string): ProcessedContent {
  // Parse email structure (subject, greeting, body, closing)
  const sections = raw.split(/\n\s*\n/).filter(section => section.trim().length > 0);
  
  const blocks: ContentBlock[] = sections.map((section, index) => {
    const isSubject = index === 0 && section.toLowerCase().includes('subject');
    const isGreeting = !isSubject && index <= 1 && (section.toLowerCase().includes('hello') || section.toLowerCase().includes('dear'));
    const isClosing = index === sections.length - 1 && section.length < 100;

    return {
      id: `email-block-${index}`,
      title: isSubject ? 'Subject Line' : isGreeting ? 'Greeting' : isClosing ? 'Closing' : `Section ${index + 1}`,
      body: section.trim(),
      cta: isClosing ? 'Visit our garden center' : '',
      link: '',
      image_prompt: !isSubject && !isGreeting && !isClosing ? generateImagePrompt(task, section) : '',
      alt_text: `Email ${isSubject ? 'subject' : isGreeting ? 'greeting' : isClosing ? 'closing' : 'content'}`,
      order_index: index,
      block_type: isSubject ? 'header' : 'text' as const
    };
  });

  return {
    blocks,
    metadata: createMetadata(task, 'email', blocks),
    extra_content_ideas: generateContentIdeas(task.campaigns?.theme || 'email marketing'),
    isStructured: true,
    needsRegeneration: false
  };
}

function processEventContent(task: ContentTask, raw: string): ProcessedContent {
  // Parse event details, agenda, promotional content
  const sections = raw.split(/(?:\n\s*\n|---+)/).filter(section => section.trim().length > 0);
  
  const blocks: ContentBlock[] = sections.map((section, index) => ({
    id: `event-block-${index}`,
    title: extractTitle(section) || `Event Detail ${index + 1}`,
    body: section.trim(),
    cta: index === sections.length - 1 ? 'RSVP now' : '',
    link: '',
    image_prompt: generateImagePrompt(task, section),
    alt_text: `Event information - ${extractTitle(section) || `section ${index + 1}`}`,
    order_index: index,
    block_type: 'event_item' as const
  }));

  return {
    blocks,
    metadata: createMetadata(task, 'event', blocks),
    extra_content_ideas: generateContentIdeas('event planning'),
    isStructured: true,
    needsRegeneration: false
  };
}

function processGenericContent(task: ContentTask, raw: string): ProcessedContent {
  // Generic processing for unknown content types
  const sections = raw.split(/\n\s*\n/).filter(section => section.trim().length > 50);
  
  const blocks: ContentBlock[] = sections.map((section, index) => ({
    id: `generic-block-${index}`,
    title: extractTitle(section) || `Section ${index + 1}`,
    body: section.trim(),
    cta: index === sections.length - 1 ? 'Learn more' : '',
    link: '',
    image_prompt: generateImagePrompt(task, section),
    alt_text: `Content section ${index + 1}`,
    order_index: index,
    block_type: 'text' as const
  }));

  return {
    blocks,
    metadata: createMetadata(task, task.post_type || 'content', blocks),
    extra_content_ideas: [],
    isStructured: true,
    needsRegeneration: false
  };
}

// Helper functions
function createNewsletterBlocks(task: ContentTask, raw: string): ContentBlock[] {
  const contentSections = raw.split(/\n\n+/).filter(section => section.trim().length > 50);
  
  return contentSections.map((section, index) => {
    const sectionTitle = section.match(/^([^.!?\n]{10,60})/)?.[1]?.trim() || `Section ${index + 1}`;
    const cleanSection = section.replace(/^[^.!?\n]*[.!?]\s*/, '').trim();
    
    return {
      id: `newsletter-block-${index}`,
      title: sectionTitle,
      body: cleanSection || section,
      cta: index === contentSections.length - 1 ? 'Visit us for expert advice' : '',
      link: '',
      image_prompt: generateImagePrompt(task, sectionTitle),
      alt_text: `${sectionTitle} - newsletter image`,
      order_index: index,
      block_type: 'text' as const
    };
  });
}

function generateImagePrompt(task: ContentTask, content: string): string {
  const theme = task.campaigns?.theme || 'garden center';
  const keywords = extractKeywordsFromContent(content).slice(0, 2).join(' ');
  return `${theme} ${keywords} professional ${task.post_type || 'content'} image`.trim();
}

function extractTitle(content: string): string {
  // Extract meaningful title from content
  const firstLine = content.split('\n')[0];
  const cleaned = firstLine.replace(/[#*]/g, '').trim();
  return cleaned.length > 60 ? cleaned.substring(0, 57) + '...' : cleaned;
}

function createMetadata(task: ContentTask, contentType: string, blocks: ContentBlock[]): ContentMetadata {
  const totalWords = blocks.reduce((count, block) => count + (block.body?.split(' ').length || 0), 0);
  const readingTime = Math.max(1, Math.ceil(totalWords / 200));
  
  return {
    reading_time: `≈${readingTime} min`,
    theme: task.campaigns?.theme || 'Content',
    week_focus: `Creating ${contentType} content`,
    content_type: contentType,
    structured_format: true,
    keywords: extractKeywordsFromContent(blocks.map(b => b.body).join(' ')),
    image_prompts: blocks.map(b => b.image_prompt).filter(Boolean)
  };
}

function generateContentIdeas(theme: string): Array<{ title: string; quick_desc: string }> {
  const baseIdeas = [
    { title: 'Seasonal Tips Guide', quick_desc: 'Essential seasonal advice for garden success' },
    { title: 'Problem-Solution Focus', quick_desc: 'Address common gardening challenges' },
    { title: 'Product Spotlight', quick_desc: 'Feature trending plants and supplies' },
    { title: 'Expert Interview', quick_desc: 'Share professional gardening insights' }
  ];
  
  return baseIdeas.map(idea => ({
    ...idea,
    title: `${theme}: ${idea.title}`
  }));
}

function estimateSceneDuration(sceneText: string): string {
  const words = sceneText.split(' ').length;
  const seconds = Math.ceil(words / 2.5); // ~150 words per minute speaking rate
  return `${seconds}s`;
}

function estimateTotalDuration(blocks: ContentBlock[]): string {
  const totalSeconds = blocks.reduce((total, block) => {
    const duration = block.metadata?.duration as string;
    if (duration && duration.endsWith('s')) {
      return total + parseInt(duration);
    }
    return total + 15; // Default 15 seconds per block
  }, 0);
  
  return `≈${Math.ceil(totalSeconds / 60)} min`;
}