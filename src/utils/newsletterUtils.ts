import yaml from 'js-yaml';

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
    // Decode URL-encoded content first and fix line breaks
    let decodedContent = yamlContent;
    try {
      if (yamlContent.includes('%')) {
        decodedContent = decodeURIComponent(yamlContent);
      }
      
      // Fix malformed YAML structure
      decodedContent = fixMalformedYAML(decodedContent);
      
    } catch (e) {
      // Content was not URL encoded, continue with original
    }
    
    // Try parsing with js-yaml first
    try {
      const parsed = yaml.load(decodedContent);
      if (parsed && typeof parsed === 'object') {
        return parsed as StructuredNewsletter;
      }
    } catch (yamlError: any) {
      // Try one more time with additional repairs
      const repairedContent = repairYAMLStructure(decodedContent);
      try {
        const repairedParsed = yaml.load(repairedContent);
        if (repairedParsed && typeof repairedParsed === 'object') {
          return repairedParsed as StructuredNewsletter;
        }
      } catch (secondError: any) {
        // Both attempts failed, try manual parsing
      }
    }
    
    // Fallback to manual parsing if js-yaml fails
    return parseNewsletterManually(decodedContent);
    
  } catch (error) {
    return null;
  }
};

const fixMalformedYAML = (content: string): string => {
  let fixed = content;
  
  // Fix line breaks that were lost during URL encoding
  fixed = fixed
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\+/g, ' ')
    
    // Fix critical YAML indentation issues in extra_content_ideas
    .replace(/extra_content_ideas:\s*\n\s*-\s*title:\s*"([^"]*?)"\s*\nquick_desc:\s*"([^"]*?)"/g, 
      'extra_content_ideas:\n  - title: "$1"\n    quick_desc: "$2"')
    .replace(/(\n\s*-\s*title:\s*"[^"]*?"\s*\n)(\s*)quick_desc:/g, '$1    quick_desc:')
    
    // Fix newsletter_md pipe syntax
    .replace(/newsletter_md:\s*\|\s*(.+?)(\s+blocks:|$)/gs, (match, content, ending) => {
      const sections = content.split(/(\s+##\s+)/g);
      const indentedContent = sections
        .map(section => section.trim())
        .filter(section => section)
        .map(section => section.startsWith('##') ? `\n  ${section}` : `  ${section}`)
        .join('\n');
      
      return `newsletter_md: |\n${indentedContent}${ending ? '\n' + ending : ''}`;
    })
    
    // Fix malformed blocks structure
    .replace(/blocks\s+title:/g, 'blocks:\n  - title:')
    .replace(/(\w)\s+(blocks:|meta:|extra_content_ideas:)/g, '$1\n\n$2')
    .replace(/blocks:\s*-\s*/g, 'blocks:\n  - ')
    
    // Fix field indentation - ensure all block fields are properly indented
    .replace(/(\n\s*-\s*title:[^\n]*\n)(\s*)([a-z_]+:)/g, '$1    $3')
    .replace(/(\n\s{4}[a-z_]+:[^\n]*\n)(\s*)([a-z_]+:)/g, '$1    $3')
    
    // Fix meta section formatting
    .replace(/meta:\s*(\w)/g, 'meta:\n  $1')
    .replace(/(\n\s*[a-z_]+:[^\n]*\n)(\s*)([a-z_]+:)/g, '$1  $3');
  
  return fixed;
};

const repairYAMLStructure = (content: string): string => {
  let repaired = content;
  
  // More aggressive fixes for severely malformed YAML
  repaired = repaired
    // Ensure newsletter_md has proper block structure
    .replace(/newsletter_md:\s*\|\s*([^]*?)(?=\n\w+:|\n\n\w+:|$)/g, (match, content) => {
      const cleanContent = content
        .split('\n')
        .map(line => line.trim() ? `  ${line.trim()}` : '')
        .join('\n');
      return `newsletter_md: |\n${cleanContent}`;
    })
    // Fix missing line breaks before blocks
    .replace(/(\w)\s*blocks:/g, '$1\n\nblocks:')
    // Ensure proper block indentation
    .replace(/blocks:\s*-/g, 'blocks:\n  -')
    .replace(/^(\s*)-\s*(type:|title:|body:)/gm, '$1- $2')
    .replace(/^(\s{2,})(type:|title:|body:|image_prompt:|alt_text:|cta:|link:)/gm, '$1  $2');
  
  return repaired;
};

const parseNewsletterManually = (content: string): StructuredNewsletter | null => {
  // Check if content contains YAML structure indicators
  const hasNewsletterMd = content.includes('newsletter_md:');
  const hasBlocks = content.includes('blocks:');
  
  if (!hasNewsletterMd && !hasBlocks) {
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
  const matches = Array.from(content.matchAll(sectionRegex));
  
  // If we found structured sections, parse them
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      const sectionStart = currentMatch.index!;
      const sectionEnd = nextMatch ? nextMatch.index! : content.length;
      const sectionContent = content.substring(sectionStart, sectionEnd).trim();
      
      if (currentMatch[1] === 'newsletter_md:') {
        // Parse newsletter markdown content (handle pipe syntax)
        const lines = sectionContent.split('\n');
        const firstLine = lines[0].trim();
        
        if (firstLine.includes('|')) {
          // Check if content is on the same line as the pipe
          const pipeIndex = firstLine.indexOf('|');
          const contentAfterPipe = firstLine.substring(pipeIndex + 1).trim();
          
          if (contentAfterPipe) {
            // Content is on the same line as pipe - use it plus any following lines
            const followingLines = lines.slice(1).filter(line => line.trim());
            result.newsletter_md = [contentAfterPipe, ...followingLines].join('\n').trim();
          } else {
            // Multi-line content with pipe syntax - content starts from next line
            const contentLines = lines.slice(1).filter(line => line.trim());
            result.newsletter_md = contentLines.join('\n').trim();
          }
        } else {
          // Check if the entire line after 'newsletter_md:' contains pipe
          const afterColon = firstLine.substring(firstLine.indexOf(':') + 1).trim();
          if (afterColon === '|') {
            // Multi-line content starts from next line
            const contentLines = lines.slice(1).filter(line => line.trim());
            result.newsletter_md = contentLines.join('\n').trim();
          } else {
            // Single line content
            result.newsletter_md = afterColon;
          }
        }
      }
      
      if (currentMatch[1] === 'blocks:') {
        // Parse blocks section manually
        const blockSection = sectionContent.substring(sectionContent.indexOf('blocks:') + 7);
        result.blocks = parseBlocksManually(blockSection);
      }
      
      if (currentMatch[1] === 'meta:') {
        // Parse meta section manually
        const metaSection = sectionContent.substring(sectionContent.indexOf('meta:') + 5);
        result.meta = parseMetaManually(metaSection);
      }
    }
  }
  
  return result as StructuredNewsletter;
};

const parseBlocksManually = (blockContent: string): NewsletterBlock[] => {
  const blocks: NewsletterBlock[] = [];
  
  // Enhanced splitting - handle multiple block formats
  let blockItems: string[] = [];
  
  // Method 1: Standard YAML list splitting
  blockItems = blockContent.split(/(?=^\s*-\s)/m).filter(item => item.trim());
  
  // Method 2: Try splitting by title: pattern if standard fails
  if (blockItems.length === 0) {
    blockItems = blockContent.split(/(?=\s*title:\s*")/g).filter(item => item.trim() && item.includes('title:'));
  }
  
  // Method 3: Try inline parsing for severely malformed blocks
  if (blockItems.length === 0) {
    // Look for title/body/cta/image patterns in the entire content
    const titleMatches = Array.from(blockContent.matchAll(/title:\s*"([^"]*?)"/g));
    const bodyMatches = Array.from(blockContent.matchAll(/body:\s*"([^"]*?)"/g));
    const ctaMatches = Array.from(blockContent.matchAll(/cta:\s*"([^"]*?)"/g));
    const imageMatches = Array.from(blockContent.matchAll(/image_prompt:\s*"([^"]*?)"/g));
    
    if (titleMatches.length > 0 && bodyMatches.length > 0) {
      const maxBlocks = Math.min(titleMatches.length, bodyMatches.length);
      for (let i = 0; i < maxBlocks; i++) {
        blocks.push({
          title: titleMatches[i][1] || '',
          body: bodyMatches[i][1] || '',
          cta: ctaMatches[i]?.[1] || 'Learn More',
          link: '#',
          image_prompt: imageMatches[i]?.[1] || `${titleMatches[i][1]} garden newsletter`,
          alt_text: `Image for ${titleMatches[i][1]}`
        });
      }
      return blocks;
    }
  }
  
  // Process each block item with enhanced parsing
  blockItems.forEach((item, index) => {
    const block: any = {};
    
    // Enhanced field extraction with multiple patterns
    // Pattern 1: Quoted values
    const quotedMatches = item.matchAll(/(\w+):\s*"([^"]*?)"/g);
    for (const match of quotedMatches) {
      const [, key, value] = match;
      if (['title', 'body', 'content', 'cta', 'link', 'image_prompt', 'alt_text', 'type'].includes(key)) {
        block[key] = value;
      }
    }
    
    // Pattern 2: Unquoted values (fallback)
    if (Object.keys(block).length === 0) {
      const lines = item.split('\n').map(line => line.trim()).filter(line => line);
      
      lines.forEach(line => {
        // Remove list marker
        if (line.startsWith('- ') || line.startsWith('-\t')) {
          line = line.substring(1).trim();
        }
        
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
          
          if (['title', 'body', 'content', 'cta', 'link', 'image_prompt', 'alt_text', 'type'].includes(key)) {
            block[key] = value;
          }
        }
      });
    }
    
    // Use 'content' as fallback for 'body' if available
    if (!block.body && block.content) {
      block.body = block.content;
    }
    
    // Enhanced validation and block creation
    if (block.title && (block.body || block.content)) {
      const newBlock = {
        title: block.title || '',
        body: block.body || block.content || '',
        cta: block.cta || 'Learn More',
        link: block.link || '#',
        image_prompt: block.image_prompt || `${block.title} garden newsletter`,
        alt_text: block.alt_text || `Image for ${block.title}`
      };
      
      blocks.push(newBlock);
    }
  });
  
  return blocks;
};

const parseMetaManually = (metaContent: string): NewsletterMeta => {
  const meta: any = {};
  
  const lines = metaContent.split('\n').map(line => line.trim()).filter(line => line);
  
  lines.forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      const cleanKey = key.trim();
      
      if (['reading_time', 'theme', 'week_focus'].includes(cleanKey)) {
        meta[cleanKey] = value;
      }
    }
  });
  
  return {
    reading_time: meta.reading_time || '5 min',
    theme: meta.theme || 'Garden Newsletter',
    week_focus: meta.week_focus || 'Weekly Update'
  };
};

export const extractNewsletterSections = (content: string): { header: string; sections: Array<{ title: string; content: string }> } => {
  const lines = content.split('\n');
  let header = '';
  const sections: Array<{ title: string; content: string }> = [];
  
  let currentSection: { title: string; content: string[] } | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.match(/^# /)) {
      // Main header
      header = trimmedLine.replace(/^# /, '').trim();
    } else if (trimmedLine.match(/^## /)) {
      // Section header - save previous section and start new one
      if (currentSection) {
        sections.push({
          title: currentSection.title,
          content: currentSection.content.join('\n').trim()
        });
      }
      currentSection = {
        title: trimmedLine.replace(/^## /, '').trim(),
        content: []
      };
    } else if (currentSection && trimmedLine) {
      // Add content to current section
      currentSection.content.push(line);
    }
  }
  
  // Add the last section
  if (currentSection) {
    sections.push({
      title: currentSection.title,
      content: currentSection.content.join('\n').trim()
    });
  }
  
  return { header, sections };
};