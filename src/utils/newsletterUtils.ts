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
    console.log('[YAML PARSER] Starting to parse newsletter YAML content, length:', yamlContent.length);
    console.log('[YAML PARSER] Content preview:', yamlContent.substring(0, 500));
    
    // Decode URL-encoded content first
    let decodedContent = yamlContent;
    try {
      decodedContent = decodeURIComponent(yamlContent);
      console.log('[YAML PARSER] URL decoded content preview:', decodedContent.substring(0, 500));
    } catch (e) {
      console.log('[YAML PARSER] Content was not URL encoded, using original');
    }
    
    // Check if content contains YAML structure indicators
    if (!decodedContent.includes('newsletter_md:') && !decodedContent.includes('blocks:')) {
      console.log('[YAML PARSER] Content does not appear to be YAML structured newsletter');
      return null;
    }

    // Enhanced YAML parsing for the complex structure
    const result: any = {
      blocks: [],
      extra_content_ideas: [],
      meta: {}
    };
    
    // More robust section splitting - handle potential whitespace issues
    const sectionRegex = /^(newsletter_md:|blocks:|extra_content_ideas:|meta:)/gm;
    const matches = Array.from(decodedContent.matchAll(sectionRegex));
    console.log('[YAML PARSER] Found section markers:', matches.map(m => m[1]));
    
    // If we found structured sections, parse them
    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const currentMatch = matches[i];
        const nextMatch = matches[i + 1];
        
        const sectionStart = currentMatch.index!;
        const sectionEnd = nextMatch ? nextMatch.index! : decodedContent.length;
        const sectionContent = decodedContent.substring(sectionStart, sectionEnd).trim();
        
        console.log(`[YAML PARSER] Processing section: ${currentMatch[1]}`);
        
        if (currentMatch[1] === 'newsletter_md:') {
          // Parse newsletter markdown content (handle pipe syntax)
          const lines = sectionContent.split('\n');
          const firstLine = lines[0].trim();
          
          if (firstLine.includes('|')) {
            // Multi-line content with pipe syntax
            const contentLines = lines.slice(1);
            result.newsletter_md = contentLines.join('\n').trim();
            console.log('[YAML PARSER] Found newsletter_md with pipe syntax, length:', result.newsletter_md.length);
          } else {
            // Single line content
            result.newsletter_md = firstLine.replace('newsletter_md:', '').trim();
            console.log('[YAML PARSER] Found newsletter_md single line, length:', result.newsletter_md.length);
          }
        }
        
        if (currentMatch[1] === 'blocks:') {
          // Parse blocks section with improved logic
          const lines = sectionContent.split('\n').slice(1); // Skip the 'blocks:' line
          let currentBlock: any = {};
          let inMultilineValue = false;
          let currentKey = '';
          let currentValue = '';
          
          for (const line of lines) {
            const trimmed = line.trim();
            
            // Skip empty lines
            if (!trimmed) continue;
            
            // Handle new block start
            if (trimmed.startsWith('- title:')) {
              // Save previous block if exists
              if (Object.keys(currentBlock).length > 0) {
                result.blocks.push(currentBlock);
                console.log('[YAML PARSER] Added block:', currentBlock.title);
              }
              
              // Start new block
              currentBlock = {
                title: extractYamlValue(trimmed, '- title:')
              };
              inMultilineValue = false;
            }
            // Handle other block properties
            else if (trimmed.match(/^(body|cta|link|image_prompt|alt_text):/)) {
              // Save any previous multiline value
              if (inMultilineValue && currentKey) {
                currentBlock[currentKey] = currentValue.trim();
              }
              
              // Extract the key and value
              const colonIndex = trimmed.indexOf(':');
              currentKey = trimmed.substring(0, colonIndex);
              const valueAfterColon = trimmed.substring(colonIndex + 1).trim();
              
              if (valueAfterColon.startsWith('|')) {
                // Start of multiline value
                inMultilineValue = true;
                currentValue = '';
              } else if (valueAfterColon) {
                // Single line value
                currentBlock[currentKey] = extractYamlValue(trimmed, currentKey + ':');
                inMultilineValue = false;
              }
            }
            // Handle multiline content
            else if (inMultilineValue && line.startsWith('    ')) {
              // Add to multiline value (preserve indentation structure)
              currentValue += line.substring(4) + '\n';
            }
          }
          
          // Save final multiline value if exists
          if (inMultilineValue && currentKey) {
            currentBlock[currentKey] = currentValue.trim();
          }
          
          // Add the last block
          if (Object.keys(currentBlock).length > 0) {
            result.blocks.push(currentBlock);
            console.log('[YAML PARSER] Added final block:', currentBlock.title);
          }
          
          console.log('[YAML PARSER] Total blocks parsed:', result.blocks.length);
        }
        
        if (currentMatch[1] === 'extra_content_ideas:') {
          // Parse extra content ideas with improved logic
          const lines = sectionContent.split('\n').slice(1); // Skip the 'extra_content_ideas:' line
          let currentIdea: any = {};
          
          for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('- title:')) {
              if (Object.keys(currentIdea).length > 0) {
                result.extra_content_ideas.push(currentIdea);
              }
              currentIdea = {
                title: extractYamlValue(trimmed, '- title:')
              };
            } else if (trimmed.startsWith('quick_desc:')) {
              currentIdea.quick_desc = extractYamlValue(trimmed, 'quick_desc:');
            }
          }
          
          // Add the last idea
          if (Object.keys(currentIdea).length > 0) {
            result.extra_content_ideas.push(currentIdea);
          }
        }
        
        if (currentMatch[1] === 'meta:') {
          // Parse meta section
          const lines = sectionContent.split('\n').slice(1); // Skip the 'meta:' line
          
          for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('reading_time:')) {
              result.meta.reading_time = extractYamlValue(trimmed, 'reading_time:');
            } else if (trimmed.startsWith('theme:')) {
              result.meta.theme = extractYamlValue(trimmed, 'theme:');
            } else if (trimmed.startsWith('week_focus:')) {
              result.meta.week_focus = extractYamlValue(trimmed, 'week_focus:');
            }
          }
        }
      }
    }
    
    // If we parsed from markdown and have no blocks from YAML structure, use markdown blocks
    if (result.blocks.length === 0 && result.newsletter_md) {
      console.log('[YAML PARSER] No YAML blocks found, parsing from markdown');
      result.blocks = parseMarkdownSections(result.newsletter_md);
    }
    
    // Validate that we have meaningful blocks
    if (!result.blocks || result.blocks.length === 0) {
      console.log('[YAML PARSER] No valid blocks found in YAML parsing');
      return null;
    }
    
    // Ensure all blocks have required properties and clean them up
    result.blocks = result.blocks
      .filter((block: any) => block.title && block.body)
      .map((block: any) => ({
        title: block.title || '',
        body: block.body || '',
        cta: block.cta || 'Learn more',
        link: block.link || '#',
        image_prompt: block.image_prompt || `${block.title} garden newsletter`,
        alt_text: block.alt_text || `Image for ${block.title}`
      }));
    
    if (result.blocks.length === 0) {
      console.log('[YAML PARSER] No blocks with required properties found');
      return null;
    }
    
    // Ensure meta has default values
    result.meta = {
      reading_time: result.meta.reading_time || '≈3 min',
      theme: result.meta.theme || 'Garden Newsletter', 
      week_focus: result.meta.week_focus || 'Seasonal Gardening'
    };
    
    // Ensure newsletter_md has content
    if (!result.newsletter_md) {
      result.newsletter_md = generateMarkdownFromBlocks(result.blocks);
    }
    
    console.log('[YAML PARSER] Successfully parsed YAML newsletter with', result.blocks.length, 'blocks');
    result.blocks.forEach((block: any, i: number) => {
      console.log(`[YAML PARSER] Block ${i + 1}:`, { title: block.title, hasBody: !!block.body, hasCTA: !!block.cta });
    });
    
    return result as StructuredNewsletter;
  } catch (error) {
    console.error('[YAML PARSER] Error parsing newsletter YAML:', error);
    return null;
  }
};

// Helper function to extract values from YAML lines
const extractYamlValue = (line: string, prefix: string): string => {
  const value = line.replace(prefix, '').trim();
  
  // Remove quotes if present
  if ((value.startsWith('"') && value.endsWith('"')) || 
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  
  return value;
};

// Helper function to parse sections from markdown content
const parseMarkdownSections = (markdown: string): NewsletterBlock[] => {
  const blocks: NewsletterBlock[] = [];
  
  // Split by ## headers to get sections
  const sections = markdown.split(/(?=^##\s+)/m).filter(section => section.trim());
  
  sections.forEach((section, index) => {
    const lines = section.split('\n').filter(line => line.trim());
    
    // Find the title (## header)
    const titleLine = lines.find(line => line.startsWith('##'));
    const title = titleLine ? titleLine.replace(/^##\s+/, '').trim() : `Section ${index + 1}`;
    
    // Get all content after the title
    const contentLines = lines.filter(line => !line.startsWith('##'));
    const body = contentLines.join('\n').trim();
    
    if (title && body) {
      blocks.push({
        title,
        body,
        cta: 'Learn More',
        link: '#',
        image_prompt: `${title} garden newsletter`,
        alt_text: `Image for ${title}`
      });
    }
  });
  
  return blocks;
};

// Helper function to generate markdown from blocks if missing
const generateMarkdownFromBlocks = (blocks: NewsletterBlock[]): string => {
  let markdown = '';
  
  blocks.forEach((block, index) => {
    markdown += `## ${block.title}\n\n`;
    markdown += `${block.body}\n\n`;
    
    if (index < blocks.length - 1) {
      markdown += '---\n\n';
    }
  });
  
  return markdown.trim();
};

// Enhanced markdown processing for newsletter content
export const processNewsletterMarkdown = (content: string): string => {
  if (!content) return '';
  
  console.log('Processing newsletter markdown, input length:', content.length);
  
  let processed = content;
  
  // Convert markdown bold syntax to HTML
  processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>');
  
  // Convert markdown headers to HTML with proper styling
  processed = processed
    .replace(/^# (.+)$/gm, '<h1 class="text-3xl font-bold mb-6 text-slate-900">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-semibold mb-4 mt-8 text-slate-900">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-xl font-semibold mb-3 mt-6 text-slate-900">$1</h3>');
  
  // Convert paragraphs - split by double newlines and wrap in paragraph tags
  const paragraphs = processed.split(/\n\s*\n/).filter(p => p.trim());
  processed = paragraphs.map(para => {
    const trimmed = para.trim();
    // Skip if already wrapped in HTML tags
    if (trimmed.match(/^<(h[1-6]|div|p)/)) {
      return trimmed;
    }
    return `<p class="mb-4 text-slate-700 leading-relaxed">${trimmed}</p>`;
  }).join('\n');
  
  console.log('Processed newsletter markdown, output length:', processed.length);
  return processed;
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
