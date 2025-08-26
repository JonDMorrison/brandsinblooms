
import { StructuredNewsletter } from '@/utils/newsletterUtils';

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

export const fixMalformedNewsletter = (content: string): string => {
  console.log('🔧 Fixing malformed newsletter content');
  
  // Check if content is already properly formatted
  if (content.includes('newsletter_md: |') && content.includes('blocks:') && content.includes('meta:') && !content.includes('blocks title:')) {
    // Content seems properly formatted, just clean up any formatting issues
    return cleanupExistingYAML(content);
  }
  
  // Check if content has newsletter structure but malformed blocks
  if (content.includes('newsletter_md: |') && content.includes('blocks title:')) {
    // Has newsletter structure but malformed blocks - fix the YAML
    return cleanupExistingYAML(content);
  }
  
  // Extract the title and main content
  const titleMatch = content.match(/^#\s+(.+?)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Garden Newsletter';
  
  // Extract theme from title
  const theme = extractThemeFromTitle(title);
  
  // Split content into sections
  const sections = extractSections(content);
  
  // Build the properly formatted YAML structure
  const fixedContent = buildStructuredNewsletter(title, theme, sections);
  
  console.log('✅ Newsletter content fixed and restructured');
  return fixedContent;
};

const cleanupExistingYAML = (content: string): string => {
  console.log('🧹 Cleaning up existing YAML structure');
  
  let cleaned = content;
  
  // Fix the specific malformed "blocks title:" pattern
  if (cleaned.includes('blocks title:')) {
    console.log('🔧 Fixing malformed blocks title: pattern');
    
    // Extract blocks section and restructure it
    const blocksMatch = cleaned.match(/blocks title:([\s\S]*?)(?=extra_content_ideas|meta:|$)/);
    if (blocksMatch) {
      const blocksContent = blocksMatch[1];
      
      // Parse the malformed blocks structure
      const blockEntries: any[] = [];
      let currentBlock: any = {};
      
      const lines = blocksContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;
        
        if (trimmedLine.startsWith('title:')) {
          // Save previous block if it exists
          if (currentBlock.title && currentBlock.body) {
            blockEntries.push(currentBlock);
          }
          // Start new block
          currentBlock = {
            title: trimmedLine.replace('title:', '').trim().replace(/^["']|["']$/g, ''),
          };
        } else if (trimmedLine.startsWith('body:')) {
          currentBlock.body = trimmedLine.replace('body:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmedLine.startsWith('cta:')) {
          currentBlock.cta = trimmedLine.replace('cta:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmedLine.startsWith('link:')) {
          currentBlock.link = trimmedLine.replace('link:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmedLine.startsWith('image_prompt:')) {
          currentBlock.image_prompt = trimmedLine.replace('image_prompt:', '').trim().replace(/^["']|["']$/g, '');
        } else if (trimmedLine.startsWith('alt_text:')) {
          currentBlock.alt_text = trimmedLine.replace('alt_text:', '').trim().replace(/^["']|["']$/g, '');
        }
      }
      
      // Add the last block
      if (currentBlock.title && currentBlock.body) {
        blockEntries.push(currentBlock);
      }
      
      // Rebuild the blocks section in proper YAML format
      let properBlocksYAML = 'blocks:\n';
      blockEntries.forEach(block => {
        properBlocksYAML += `- title: "${block.title}"\n`;
        properBlocksYAML += `  body: "${block.body.replace(/"/g, '\\"')}"\n`;
        properBlocksYAML += `  cta: "${block.cta || 'Learn More'}"\n`;
        properBlocksYAML += `  link: "${block.link || '#'}"\n`;
        properBlocksYAML += `  image_prompt: "${block.image_prompt || (block.title + ' garden newsletter')}"\n`;
        properBlocksYAML += `  alt_text: "${block.alt_text || ('Image for ' + block.title)}"\n`;
      });
      
      // Replace the malformed blocks section with the proper one
      cleaned = cleaned.replace(/blocks title:[\s\S]*?(?=extra_content_ideas|meta:|$)/, properBlocksYAML);
    }
  }
  
  // Fix common YAML formatting issues
  cleaned = cleaned
    // Fix missing quotes around strings with special characters
    .replace(/title:\s*([^"\n]+)$/gm, 'title: "$1"')
    .replace(/body:\s*([^"\n]+)$/gm, 'body: "$1"')
    .replace(/cta:\s*([^"\n]+)$/gm, 'cta: "$1"')
    .replace(/alt_text:\s*([^"\n]+)$/gm, 'alt_text: "$1"')
    // Fix malformed blocks structure (fallback)
    .replace(/blocks:\s*title:/g, 'blocks:\n- title:')
    // Fix missing dashes for list items
    .replace(/^(\s*)title:/gm, '$1- title:')
    // Remove duplicate content that appears in both markdown and blocks
    .replace(/---[\s\S]*?blocks:/g, 'blocks:')
    // Clean up extra spaces and formatting
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n');
  
  return cleaned;
};

const extractThemeFromTitle = (title: string): string => {
  // Extract theme keywords from title
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('summer')) return 'Summer Care';
  if (lowerTitle.includes('spring')) return 'Spring Growth';
  if (lowerTitle.includes('fall') || lowerTitle.includes('autumn')) return 'Fall Preparation';
  if (lowerTitle.includes('winter')) return 'Winter Protection';
  if (lowerTitle.includes('growing')) return 'Growing Success';
  
  return 'Seasonal Gardening';
};

const extractSections = (content: string): NewsletterBlock[] => {
  const sections: NewsletterBlock[] = [];
  
  // Split by headers (## or ###)
  const headerRegex = /^#{2,3}\s+(.+?)$/gm;
  const parts = content.split(headerRegex);
  
  for (let i = 1; i < parts.length; i += 2) {
    const headerText = parts[i]?.trim();
    const bodyText = parts[i + 1]?.trim();
    
    if (headerText && bodyText) {
      // Clean up the body text
      const cleanBody = bodyText
        .replace(/^#{1,6}\s+.+$/gm, '') // Remove any headers
        .replace(/^---[\s\S]*$/gm, '') // Remove separators and content after
        .replace(/blocks:[\s\S]*$/gm, '') // Remove YAML blocks section
        .replace(/title:[\s\S]*$/gm, '') // Remove malformed YAML
        .replace(/\n{2,}/g, ' ') // Replace multiple newlines with spaces
        .trim();
      
      if (cleanBody && cleanBody.length > 50) { // Only include substantial content
        sections.push({
          title: headerText,
          body: cleanBody,
          cta: generateCTA(headerText),
          link: "#",
          image_prompt: generateImagePrompt(headerText),
          alt_text: generateAltText(headerText)
        });
      }
    }
  }
  
  // Limit to 4 sections maximum for optimal newsletter length
  return sections.slice(0, 4);
};

const generateCTA = (title: string): string => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('heat') || lowerTitle.includes('summer')) {
    return "Get summer care essentials";
  }
  if (lowerTitle.includes('game-changer') || lowerTitle.includes('featured')) {
    return "Discover featured plants";
  }
  if (lowerTitle.includes('sos') || lowerTitle.includes('rescue') || lowerTitle.includes('save')) {
    return "Get plant rescue solutions";
  }
  if (lowerTitle.includes('ready') || lowerTitle.includes('plan') || lowerTitle.includes('prepare')) {
    return "Plan your garden success";
  }
  
  return "Learn more";
};

const generateImagePrompt = (title: string): string => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('heat') || lowerTitle.includes('summer')) {
    return "thriving garden in summer heat with mulch and drought-resistant plants";
  }
  if (lowerTitle.includes('game-changer') || lowerTitle.includes('featured')) {
    return "vibrant featured plants transforming garden space";
  }
  if (lowerTitle.includes('sos') || lowerTitle.includes('rescue')) {
    return "healthy plants being rescued with care and attention";
  }
  if (lowerTitle.includes('ready') || lowerTitle.includes('plan')) {
    return "garden planning and preparation for success";
  }
  
  return "beautiful garden scene with healthy plants";
};

const generateAltText = (title: string): string => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('heat') || lowerTitle.includes('summer')) {
    return "Garden thriving in summer heat with proper care";
  }
  if (lowerTitle.includes('game-changer') || lowerTitle.includes('featured')) {
    return "Featured plants creating garden transformation";
  }
  if (lowerTitle.includes('sos') || lowerTitle.includes('rescue')) {
    return "Successful plant rescue and recovery";
  }
  if (lowerTitle.includes('ready') || lowerTitle.includes('plan')) {
    return "Garden planning and preparation";
  }
  
  return "Beautiful garden with healthy plants";
};

const buildStructuredNewsletter = (title: string, theme: string, sections: NewsletterBlock[]): string => {
  // Build clean markdown content
  const markdownContent = buildCleanMarkdown(title, sections);
  
  // Build structured YAML
  const yamlContent = `newsletter_md: |
${markdownContent.split('\n').map(line => '  ' + line).join('\n')}

blocks:
${sections.map(section => `- title: "${section.title}"
  body: "${section.body.replace(/"/g, '\\"')}"
  cta: "${section.cta}"
  link: "${section.link}"
  image_prompt: "${section.image_prompt}"
  alt_text: "${section.alt_text}"`).join('\n')}

extra_content_ideas:
- title: "Advanced Care Techniques"
  quick_desc: "Professional tips for optimal plant health"
- title: "Seasonal Plant Selection"
  quick_desc: "Choose the right plants for every season"
- title: "Garden Problem Solutions"
  quick_desc: "Quick fixes for common garden issues"
- title: "Soil Health Optimization"
  quick_desc: "Build the foundation for garden success"

meta:
  reading_time: "3-4 min"
  theme: "${theme}"
  week_focus: "${title.replace(/Newsletter|Garden/gi, '').trim()}"`;

  return yamlContent;
};

const buildCleanMarkdown = (title: string, sections: NewsletterBlock[]): string => {
  let markdown = `# ${title}\n\n`;
  
  // Add subtitle based on theme
  const subtitle = generateSubtitle(title);
  if (subtitle) {
    markdown += `*${subtitle}*\n\n`;
  }
  
  // Add sections
  sections.forEach((section, index) => {
    markdown += `## ${section.title}\n\n`;
    markdown += `${section.body}\n\n`;
    
    // Add separator between sections (but not after the last one)
    if (index < sections.length - 1) {
      markdown += `---\n\n`;
    }
  });
  
  return markdown.trim();
};

const generateSubtitle = (title: string): string => {
  const lowerTitle = title.toLowerCase();
  
  if (lowerTitle.includes('summer')) {
    return "Expert tips for thriving gardens in the heat";
  }
  if (lowerTitle.includes('growing success')) {
    return "Transform your garden with proven techniques";
  }
  if (lowerTitle.includes('fall') || lowerTitle.includes('autumn')) {
    return "Prepare your garden for the changing season";
  }
  
  return "Professional gardening insights for your success";
};

// Helper function to estimate reading time
export const calculateReadingTime = (content: string): string => {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  
  if (minutes <= 1) return "1 min";
  if (minutes <= 3) return `${minutes} min`;
  return `${minutes}-${minutes + 1} min`;
};

// Validate that the newsletter structure is correct
export const validateNewsletterStructure = (content: string): boolean => {
  const requiredSections = ['newsletter_md:', 'blocks:', 'meta:'];
  return requiredSections.every(section => content.includes(section));
};
