
// Enhanced newsletter content processing utility
interface ProcessedNewsletter {
  isStructured: boolean;
  newsletter_md: string;
  blocks: Array<{
    title: string;
    body: string;
    cta: string;
    link: string;
    image_prompt: string;
    alt_text: string;
  }>;
  meta: {
    reading_time: string;
    theme: string;
    week_focus: string;
  };
}

export const processNewsletterContent = (content: string, campaignTitle?: string): ProcessedNewsletter => {
  if (!content) {
    return {
      isStructured: false,
      newsletter_md: '',
      blocks: [],
      meta: {
        reading_time: '1 min read',
        theme: campaignTitle || 'Newsletter',
        week_focus: 'Content Update'
      }
    };
  }

  console.log('🔍 Processing newsletter content:', {
    length: content.length,
    hasBlocks: content.includes('blocks:'),
    hasTitleStructure: content.includes('- title:'),
    preview: content.substring(0, 200),
    contentType: 'Holiday Newsletter Debug'
  });

  // Check if content is YAML structured
  const isYAMLStructured = content.includes('blocks:') && content.includes('- title:');
  
  if (isYAMLStructured) {
    console.log('📋 Detected YAML structured newsletter');
    // Parse YAML structure
    const yamlResult = parseSimpleYAML(content);
    if (yamlResult) {
      console.log('✅ Successfully parsed YAML newsletter');
      return {
        isStructured: true,
        ...yamlResult,
        meta: {
          reading_time: yamlResult.meta?.reading_time || calculateReadingTime(yamlResult.newsletter_md || content),
          theme: yamlResult.meta?.theme || campaignTitle || 'Newsletter',
          week_focus: yamlResult.meta?.week_focus || 'Content Update'
        }
      };
    } else {
      console.log('❌ Failed to parse YAML, falling back to plain text');
    }
  }

  // Process as plain text newsletter
  return {
    isStructured: false,
    newsletter_md: content,
    blocks: createBlocksFromPlainText(content, campaignTitle),
    meta: {
      reading_time: calculateReadingTime(content),
      theme: campaignTitle || 'Newsletter',
      week_focus: 'Content Update'
    }
  };
};

const filterUnwantedSections = (content: string): string => {
  // Remove the "Get Informed with Our Content" section
  const sectionToRemove = /Section 3: Get Informed with Our Content[\s\S]*?(?=\n\n(?:[A-Z]|$)|\n*$)/i;
  return content.replace(sectionToRemove, '').trim();
};

export const convertNewsletterMarkdownToHtml = (content: string): string => {
  if (!content) return '';

  // Filter out unwanted sections first
  let processed = filterUnwantedSections(content);

  // Enhanced header detection and conversion
  processed = processed
    // Main headers (# or ##)
    .replace(/^#{1,2}\s+(.+)$/gm, '<h2 class="text-2xl font-bold text-slate-900 mt-8 mb-4 pb-2 border-b border-slate-200">$1</h2>')
    // Sub headers (###)
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-xl font-semibold text-slate-800 mt-6 mb-3">$1</h3>')
    // Smaller headers (####)
    .replace(/^#{4,}\s+(.+)$/gm, '<h4 class="text-lg font-medium text-slate-700 mt-4 mb-2">$1</h4>');

  // Detect and format section headers (lines that look like headers but aren't markdown)
  processed = processed.replace(/^([A-Z][A-Z\s&'-]{5,50}):?\s*$/gm, (match, title) => {
    return `<h3 class="text-xl font-semibold text-slate-800 mt-6 mb-3 text-center bg-slate-50 py-2 px-4 rounded-lg border-l-4 border-primary">${title}</h3>`;
  });

  // Common newsletter section headers
  const sectionHeaders = [
    'This Week\'s Focus',
    'Garden Focus',
    'What\'s Happening',
    'Expert Tips',
    'Seasonal Highlights',
    'Plant Care Tips',
    'Garden Maintenance',
    'Special Offers',
    'Featured Plants',
    'Growing Tips'
  ];

  sectionHeaders.forEach(header => {
    const regex = new RegExp(`^${header}\\s*:?\\s*$`, 'gmi');
    processed = processed.replace(regex, `<h3 class="text-xl font-semibold text-slate-800 mt-6 mb-3 text-center bg-slate-50 py-2 px-4 rounded-lg border-l-4 border-primary">${header}</h3>`);
  });

  // Bold text formatting
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  processed = processed.replace(/__(.*?)__/g, '<strong class="font-semibold text-slate-900">$1</strong>');

  // Italic text formatting
  processed = processed.replace(/\*(.*?)\*/g, '<em class="italic text-slate-700">$1</em>');
  processed = processed.replace(/_(.*?)_/g, '<em class="italic text-slate-700">$1</em>');

  // List formatting
  processed = processed.replace(/^[-•]\s+(.+)$/gm, '<li class="ml-6 mb-2 text-slate-700">• $1</li>');
  processed = processed.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-6 mb-2 text-slate-700 list-decimal">$1</li>');

  // Convert paragraphs - split by double newlines
  const sections = processed.split(/\n\s*\n/).filter(section => section.trim());
  
  processed = sections.map(section => {
    const trimmed = section.trim();
    
    // Skip if already HTML tagged
    if (trimmed.match(/^<(h[1-6]|div|li|ul|ol|p)/)) {
      return trimmed;
    }

    // Handle lists
    if (trimmed.includes('<li class="ml-6')) {
      return `<ul class="space-y-1 my-4">${trimmed}</ul>`;
    }

    // Regular paragraphs
    return `<p class="mb-4 text-slate-700 leading-relaxed">${trimmed}</p>`;
  }).join('\n');

  // Add section spacing
  processed = processed.replace(/(<h[2-4][^>]*>)/g, '<div class="mt-8 first:mt-0">$1');
  processed = processed.replace(/(<\/h[2-4]>)/g, '$1</div>');

  return processed;
};

const parseSimpleYAML = (content: string) => {
  try {
    console.log('📥 Parsing YAML content, length:', content.length);
    console.log('📥 Content preview:', content.substring(0, 500));
    
    // First, let's see if we can find where blocks section actually starts
    const blocksIndex = content.indexOf('blocks:');
    const metaIndex = content.indexOf('meta:');
    console.log('🔍 Sections found at:', { blocksIndex, metaIndex });
    
    const lines = content.split('\n');
    const result: any = {
      blocks: [],
      meta: {},
      newsletter_md: ''
    };
    
    let currentSection = '';
    let inNewsletterMd = false;
    let currentBlock: any = {};
    let inBlocks = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip YAML fence markers
      if (trimmed === '```yaml' || trimmed === '```') {
        continue;
      }
      
      // Look for main sections (at root level - no indentation)
      if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
        // Root level section detected
        if (trimmed === 'newsletter_md: |' || trimmed.startsWith('newsletter_md:')) {
          console.log('🔍 Found newsletter_md section at line', i);
          inNewsletterMd = true;
          inBlocks = false;
          currentSection = 'newsletter_md';
          continue;
        }
        
        if (trimmed === 'blocks:') {
          console.log('🔍 Found blocks section at line', i, 'content:', trimmed);
          inNewsletterMd = false;
          inBlocks = true;
          currentSection = 'blocks';
          continue;
        }
        
        if (trimmed === 'meta:') {
          console.log('🔍 Found meta section at line', i);
          inNewsletterMd = false;
          inBlocks = false;
          currentSection = 'meta';
          continue;
        }
        
        // Any other root-level section stops newsletter_md collection
        if (inNewsletterMd && trimmed !== 'newsletter_md: |' && !trimmed.startsWith('newsletter_md:')) {
          console.log('🛑 Stopping newsletter_md collection at line', i, 'due to root section:', trimmed);
          inNewsletterMd = false;
        }
      }
      
      if (inNewsletterMd) {
        // For newsletter_md content, preserve the line structure but remove extra indentation
        const contentLine = line.replace(/^  /, ''); // Remove 2-space YAML indentation
        result.newsletter_md += contentLine + '\n';
        continue;
      }
      
      if (inBlocks && trimmed.startsWith('- title:')) {
        console.log('🔍 Found new block at line', i, ':', trimmed);
        if (Object.keys(currentBlock).length > 0) {
          result.blocks.push(currentBlock);
          console.log('✅ Added block:', currentBlock.title);
        }
        currentBlock = {
          title: trimmed.replace('- title:', '').replace(/"/g, '').trim(),
          body: '',
          cta: '',
          link: '',
          image_prompt: '',
          alt_text: ''
        };
      } else if (inBlocks && Object.keys(currentBlock).length > 0) {
        // Parse block properties
        if (trimmed.startsWith('body:')) {
          currentBlock.body = trimmed.replace('body:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('cta:')) {
          currentBlock.cta = trimmed.replace('cta:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('link:')) {
          currentBlock.link = trimmed.replace('link:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('image_prompt:')) {
          currentBlock.image_prompt = trimmed.replace('image_prompt:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('alt_text:')) {
          currentBlock.alt_text = trimmed.replace('alt_text:', '').replace(/"/g, '').trim();
        }
      } else if (currentSection === 'meta') {
        if (trimmed.startsWith('reading_time:')) {
          result.meta.reading_time = trimmed.replace('reading_time:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('theme:')) {
          result.meta.theme = trimmed.replace('theme:', '').replace(/"/g, '').trim();
        } else if (trimmed.startsWith('week_focus:')) {
          result.meta.week_focus = trimmed.replace('week_focus:', '').replace(/"/g, '').trim();
        }
      }
    }
    
    // Add the last block if it exists
    if (Object.keys(currentBlock).length > 0) {
      result.blocks.push(currentBlock);
      console.log('✅ Added final block:', currentBlock.title);
    }
    
    result.newsletter_md = filterUnwantedSections(result.newsletter_md.trim());
    
    console.log('✅ YAML parsing result:', {
      hasNewsletterMd: !!result.newsletter_md,
      newsletterMdLength: result.newsletter_md.length,
      blockCount: result.blocks.length,
      metaKeys: Object.keys(result.meta),
      firstBlockTitle: result.blocks[0]?.title
    });
    
    return result.blocks.length > 0 || result.newsletter_md ? result : null;
  } catch (error) {
    console.error('❌ Error parsing YAML:', error);
    return null;
  }
};

const createBlocksFromPlainText = (content: string, campaignTitle?: string) => {
  if (!content) return [];
  
  // Split content into logical sections
  const sections = content.split(/\n\s*\n/).filter(section => section.trim());
  
  return sections.map((section, index) => {
    const lines = section.split('\n').filter(line => line.trim());
    const title = lines[0]?.replace(/^#+\s*/, '').replace(/\*\*(.*?)\*\*/, '$1').trim() || `Section ${index + 1}`;
    const body = lines.slice(1).join(' ').trim() || lines[0]?.trim() || '';
    
    return {
      title,
      body,
      cta: '',
      link: '',
      image_prompt: `${campaignTitle || 'garden'} ${title}`.toLowerCase(),
      alt_text: `Image for ${title}`
    };
  });
};

const calculateReadingTime = (content: string): string => {
  if (!content) return '1 min read';
  
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));
  return `${readingTime} min read`;
};
