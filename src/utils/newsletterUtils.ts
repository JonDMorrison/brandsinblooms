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
    console.log('[YAML PARSER] Starting to parse newsletter YAML content, length:', yamlContent.length);
    console.log('[YAML PARSER] Raw content preview:', yamlContent.substring(0, 300));
    
    // Decode URL-encoded content first and fix line breaks
    let decodedContent = yamlContent;
    try {
      if (yamlContent.includes('%')) {
        decodedContent = decodeURIComponent(yamlContent);
        console.log('[YAML PARSER] URL decoded content preview:', decodedContent.substring(0, 300));
      }
      
      // Fix malformed YAML structure
      decodedContent = fixMalformedYAML(decodedContent);
      console.log('[YAML PARSER] Fixed YAML structure, preview:', decodedContent.substring(0, 300));
      
    } catch (e) {
      console.log('[YAML PARSER] Content was not URL encoded, using original');
    }
    
    // Try parsing with js-yaml first
    try {
      const parsed = yaml.load(decodedContent);
      if (parsed && typeof parsed === 'object') {
        console.log('[YAML PARSER] ✅ Successfully parsed with js-yaml');
        console.log('[YAML PARSER] Parse result:', {
          hasNewsletterMd: !!parsed.newsletter_md,
          hasBlocks: !!parsed.blocks,
          blocksCount: parsed.blocks?.length || 0,
          hasMeta: !!parsed.meta
        });
        
        // Always return the parsed result, even if blocks is empty - we'll create them later
        return parsed as StructuredNewsletter;
      }
    } catch (yamlError: any) {
      console.log('[YAML PARSER] ❌ js-yaml failed:', yamlError.message);
      console.log('[YAML PARSER] Attempting to fix and retry...');
      
      // Try one more time with additional fixes
      const repairedContent = repairYAMLStructure(decodedContent);
      try {
        const repairedParsed = yaml.load(repairedContent);
        if (repairedParsed && typeof repairedParsed === 'object') {
          console.log('[YAML PARSER] ✅ Successfully parsed repaired YAML');
          return repairedParsed as StructuredNewsletter;
        }
      } catch (secondError: any) {
        console.log('[YAML PARSER] ❌ Repair attempt also failed:', secondError.message);
      }
    }
    
    // Fallback to manual parsing if js-yaml fails
    console.log('[YAML PARSER] Falling back to manual parsing');
    return parseNewsletterManually(decodedContent);
    
  } catch (error) {
    console.error('[YAML PARSER] Critical error:', error);
    return null;
  }
};

const fixMalformedYAML = (content: string): string => {
  let fixed = content;
  console.log('[YAML FIXER] Input content preview:', content.substring(0, 200));
  
  // Fix line breaks that were lost during URL encoding
  fixed = fixed
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    // Fix spaces that became + signs
    .replace(/\+/g, ' ')
    // Fix the critical pipe syntax issue - detect inline content after pipe
    .replace(/newsletter_md:\s*\|\s*(.+?)(\s+blocks:|$)/gs, (match, content, ending) => {
      // Split content by ## headers and properly indent
      const sections = content.split(/(\s+##\s+)/g);
      const indentedContent = sections
        .map(section => section.trim())
        .filter(section => section)
        .map(section => section.startsWith('##') ? `\n  ${section}` : `  ${section}`)
        .join('\n');
      
      return `newsletter_md: |\n${indentedContent}${ending ? '\n' + ending : ''}`;
    })
    // Fix malformed "blocks title:" pattern - this is the key issue
    .replace(/blocks\s+title:/g, 'blocks:\n  - title:')
    // Fix blocks section - ensure proper line breaks and indentation
    .replace(/(\w)\s+(blocks:|meta:|extra_content_ideas:)/g, '$1\n\n$2')
    // Fix blocks array formatting - handle inline blocks
    .replace(/blocks:\s*-\s*/g, 'blocks:\n  - ')
    // Fix field indentation within blocks - detect inline fields
    .replace(/(\w)\s+(title:|body:|cta:|link:|image_prompt:|alt_text:|type:)/g, '$1\n    $2')
    // Fix quote formatting and line breaks after quoted values
    .replace(/:\s*"([^"]*?)"\s*(?=(title:|body:|cta:|link:|image_prompt:|alt_text:|meta:|extra_content_ideas:))/g, ': "$1"\n    ')
    // Ensure proper line breaks after last field in blocks
    .replace(/alt_text:\s*"([^"]*?)"\s*(?=(title:|meta:|extra_content_ideas:|$))/g, 'alt_text: "$1"\n  - ')
    // Fix meta section formatting  
    .replace(/meta:\s*(\w)/g, 'meta:\n  $1')
    // Fix extra_content_ideas formatting
    .replace(/extra_content_ideas:\s*-\s*/g, 'extra_content_ideas:\n  - ');
  
  console.log('[YAML FIXER] Fixed content preview:', fixed.substring(0, 200));
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
  console.log('[YAML PARSER] Manual parse - Structure check:', { hasNewsletterMd, hasBlocks });
  
  if (!hasNewsletterMd && !hasBlocks) {
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
  const matches = Array.from(content.matchAll(sectionRegex));
  console.log('[YAML PARSER] Found section markers:', matches.map(m => m[1]));
  
  // If we found structured sections, parse them
  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const currentMatch = matches[i];
      const nextMatch = matches[i + 1];
      
      const sectionStart = currentMatch.index!;
      const sectionEnd = nextMatch ? nextMatch.index! : content.length;
      const sectionContent = content.substring(sectionStart, sectionEnd).trim();
      
      console.log(`[YAML PARSER] Processing section: ${currentMatch[1]}`);
      
      if (currentMatch[1] === 'newsletter_md:') {
        // Parse newsletter markdown content (handle pipe syntax)
        const lines = sectionContent.split('\n');
        const firstLine = lines[0].trim();
        console.log('[YAML PARSER] Processing newsletter_md section, firstLine:', firstLine);
        
        if (firstLine.includes('|')) {
          // Check if content is on the same line as the pipe
          const pipeIndex = firstLine.indexOf('|');
          const contentAfterPipe = firstLine.substring(pipeIndex + 1).trim();
          
          if (contentAfterPipe) {
            // Content is on the same line as pipe - use it plus any following lines
            const followingLines = lines.slice(1).filter(line => line.trim());
            result.newsletter_md = [contentAfterPipe, ...followingLines].join('\n').trim();
            console.log('[YAML PARSER] Found newsletter_md with inline pipe content, length:', result.newsletter_md.length);
          } else {
            // Multi-line content with pipe syntax - content starts from next line
            const contentLines = lines.slice(1).filter(line => line.trim());
            result.newsletter_md = contentLines.join('\n').trim();
            console.log('[YAML PARSER] Found newsletter_md with pipe syntax, length:', result.newsletter_md.length);
          }
          console.log('[YAML PARSER] First 200 chars:', result.newsletter_md.substring(0, 200));
        } else {
          // Check if the entire line after 'newsletter_md:' contains pipe
          const afterColon = firstLine.substring(firstLine.indexOf(':') + 1).trim();
          if (afterColon === '|') {
            // Multi-line content starts from next line
            const contentLines = lines.slice(1).filter(line => line.trim());
            result.newsletter_md = contentLines.join('\n').trim();
            console.log('[YAML PARSER] Found newsletter_md with pipe on next line, length:', result.newsletter_md.length);
          } else {
            // Single line content
            result.newsletter_md = afterColon;
            console.log('[YAML PARSER] Found newsletter_md single line, length:', result.newsletter_md.length);
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
  
  // Always return result even if partially parsed
  console.log('[YAML PARSER] Manual parsing completed:', {
    hasNewsletterMd: !!result.newsletter_md,
    blocksCount: result.blocks?.length || 0,
    hasMeta: !!result.meta
  });
  
  return result as StructuredNewsletter;
};

const parseBlocksManually = (blockContent: string): NewsletterBlock[] => {
  const blocks: NewsletterBlock[] = [];
  
  console.log('[YAML PARSER] 🔍 Raw block content for manual parsing (length:', blockContent.length, ')');
  console.log('[YAML PARSER] 📋 Content preview:', blockContent.substring(0, 500));
  
  // Enhanced splitting - handle multiple block formats
  let blockItems: string[] = [];
  
  // Method 1: Standard YAML list splitting
  blockItems = blockContent.split(/(?=^\s*-\s)/m).filter(item => item.trim());
  console.log('[YAML PARSER] 📊 Method 1 (standard split) found:', blockItems.length, 'items');
  
  // Method 2: Try splitting by title: pattern if standard fails
  if (blockItems.length === 0) {
    blockItems = blockContent.split(/(?=\s*title:\s*")/g).filter(item => item.trim() && item.includes('title:'));
    console.log('[YAML PARSER] 📊 Method 2 (title split) found:', blockItems.length, 'items');
  }
  
  // Method 3: Try inline parsing for severely malformed blocks with CTA extraction
  if (blockItems.length === 0) {
    console.log('[YAML PARSER] 🔄 Trying inline parsing for malformed blocks');
    
    // Look for title/body/cta/image patterns in the entire content
    const titleMatches = Array.from(blockContent.matchAll(/title:\s*"([^"]*?)"/g));
    const bodyMatches = Array.from(blockContent.matchAll(/body:\s*"([^"]*?)"/g));
    const ctaMatches = Array.from(blockContent.matchAll(/cta:\s*"([^"]*?)"/g));
    const imageMatches = Array.from(blockContent.matchAll(/image_prompt:\s*"([^"]*?)"/g));
    
    console.log('[YAML PARSER] 📋 Found:', {
      titles: titleMatches.length,
      bodies: bodyMatches.length, 
      ctas: ctaMatches.length,
      images: imageMatches.length
    });
    
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
      console.log('[YAML PARSER] ✅ Parsed', blocks.length, 'blocks using inline method');
      return blocks;
    }
  }
  
  // Process each block item with enhanced parsing
  blockItems.forEach((item, index) => {
    console.log(`[YAML PARSER] 🔍 Processing block ${index + 1}:`, item.substring(0, 200));
    
    const block: any = {};
    
    // Enhanced field extraction with multiple patterns
    // Pattern 1: Quoted values
    const quotedMatches = item.matchAll(/(\w+):\s*"([^"]*?)"/g);
    for (const match of quotedMatches) {
      const [, key, value] = match;
      if (['title', 'body', 'content', 'cta', 'link', 'image_prompt', 'alt_text', 'type'].includes(key)) {
        block[key] = value;
        console.log(`[YAML PARSER] ✅ Extracted ${key}: ${value.substring(0, 50)}...`);
      }
    }
    
    // Pattern 2: Unquoted values (fallback)
    if (Object.keys(block).length === 0) {
      console.log('[YAML PARSER] 🔄 Trying unquoted pattern matching');
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
            console.log(`[YAML PARSER] ✅ Unquoted ${key}: ${value.substring(0, 50)}...`);
          }
        }
      });
    }
    
    // Use 'content' as fallback for 'body' if available
    if (!block.body && block.content) {
      block.body = block.content;
      console.log('[YAML PARSER] ✅ Used content field as body');
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
      console.log(`[YAML PARSER] ✅ Successfully created block: "${newBlock.title}"`);
    } else {
      console.log(`[YAML PARSER] ❌ Skipping incomplete block - title: ${!!block.title}, body: ${!!(block.body || block.content)}`);
      console.log('[YAML PARSER] 📋 Available fields:', Object.keys(block));
      console.log('[YAML PARSER] 📋 Raw item content:', item);
    }
  });
  
  console.log(`[YAML PARSER] ✅ Manual parsing complete: ${blocks.length} blocks extracted`);
  if (blocks.length > 0) {
    console.log('[YAML PARSER] 📋 Block titles:', blocks.map(b => b.title));
  }
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