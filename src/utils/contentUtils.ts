// Content filtering utilities
export const SUPPORTED_POST_TYPES = ['instagram', 'facebook', 'newsletter', 'blog', 'video'] as const;

export type SupportedPostType = typeof SUPPORTED_POST_TYPES[number];

// Filter function to remove unsupported content types and duplicate blog posts
export const filterSupportedContent = <T extends { post_type: string, campaign_id?: string }>(items: T[]): T[] => {
  const filteredItems = items.filter(item => SUPPORTED_POST_TYPES.includes(item.post_type as SupportedPostType));
  
  // Remove duplicate blog posts - keep only the first blog post per campaign
  const seenBlogs = new Set<string>();
  return filteredItems.filter(item => {
    if (item.post_type === 'blog') {
      const campaignKey = item.campaign_id || 'default';
      if (seenBlogs.has(campaignKey)) {
        return false; // Skip duplicate blog
      }
      seenBlogs.add(campaignKey);
    }
    return true;
  });
};

// Check if a post type is supported
export const isSupportedPostType = (postType: string): postType is SupportedPostType => {
  return SUPPORTED_POST_TYPES.includes(postType as SupportedPostType);
};

export const stripMarkdown = (text: string): string => {
  if (!text) return '';
  
  return text
    .replace(/#{1,6}\s+/g, '') // Remove headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.*?)\*/g, '$1') // Remove italic
    .replace(/`(.*?)`/g, '$1') // Remove inline code
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    .replace(/^\s*[-*+]\s+/gm, '') // Remove list bullets
    .replace(/^\s*\d+\.\s+/gm, '') // Remove numbered lists
    .replace(/^\s*>\s+/gm, '') // Remove blockquotes
    .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
    .trim();
};

// Parse newsletter JSON content
export const parseNewsletterJson = (content: string): { subject: string; content: string } | null => {
  try {
    // Check if content starts with ```json
    if (content.includes('```json')) {
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/) || content.match(/```json\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const jsonContent = jsonMatch[1].trim();
        const parsed = JSON.parse(jsonContent);
        return {
          subject: parsed.subject || '',
          content: parsed.content || ''
        };
      }
    }
    
    // Try parsing as direct JSON
    const parsed = JSON.parse(content);
    if (parsed.subject && parsed.content) {
      return {
        subject: parsed.subject,
        content: parsed.content
      };
    }
  } catch (error) {
    console.log('Failed to parse newsletter JSON, treating as regular content');
  }
  
  return null;
};

// ENHANCED: Preserve markdown formatting during processing
const preserveMarkdownFormatting = (text: string): string => {
  // Protect bold markdown syntax during processing
  return text
    .replace(/\*\*([^*]+)\*\*/g, '__BOLD_START__$1__BOLD_END__')
    .replace(/\*([^*]+)\*/g, '__ITALIC_START__$1__ITALIC_END__');
};

const restoreMarkdownFormatting = (text: string): string => {
  // Restore protected markdown syntax
  return text
    .replace(/__BOLD_START__([^_]+)__BOLD_END__/g, '**$1**')
    .replace(/__ITALIC_START__([^_]+)__ITALIC_END__/g, '*$1*');
};

// IMPROVED: More conservative blog structure detection
const shouldAddBlogStructure = (text: string): boolean => {
  const paragraphs = text.split('\n\n').filter(p => p.trim());
  
  // Only add structure if content is substantial and lacks any existing structure
  const hasExistingStructure = /^#{2,6}\s+/.test(text) || text.includes('<h') || text.includes('##');
  const wordCount = text.split(/\s+/).length;
  
  // Be more conservative - only add structure for longer content without existing structure
  return !hasExistingStructure && wordCount > 400 && paragraphs.length >= 4;
};

// IMPROVED: Much more conservative structure addition
const addMinimalBlogStructure = (text: string): string => {
  const protectedText = preserveMarkdownFormatting(text);
  const paragraphs = protectedText.split('\n\n').filter(p => p.trim());
  
  if (paragraphs.length < 4) {
    return restoreMarkdownFormatting(protectedText);
  }
  
  // Very minimal structure - only add 2-3 sections maximum
  let structured = '';
  const midPoint = Math.floor(paragraphs.length / 2);
  
  // First section with first paragraph(s)
  structured += `## Getting Started\n\n`;
  for (let i = 0; i < midPoint; i++) {
    structured += `${paragraphs[i]}\n\n`;
  }
  
  // Second section with remaining paragraphs
  if (paragraphs.length > midPoint) {
    structured += `## Key Points\n\n`;
    for (let i = midPoint; i < paragraphs.length; i++) {
      structured += `${paragraphs[i]}\n\n`;
    }
  }
  
  return restoreMarkdownFormatting(structured);
};

// ENHANCED blog content formatting with much more conservative approach
export const formatBlogContent = (text: string): string => {
  if (!text) return '';
  
  console.log('formatBlogContent input:', text.substring(0, 200) + '...');
  
  // Protect markdown formatting first
  let formatted = preserveMarkdownFormatting(text);
  
  // Remove any existing H1 tags since the title will be displayed in the header
  formatted = formatted.replace(/^#{1}\s+.*$/gm, '');
  
  // Only add structure if content really needs it and meets strict criteria
  if (shouldAddBlogStructure(formatted)) {
    console.log('Adding minimal blog structure for long content');
    formatted = addMinimalBlogStructure(formatted);
  }
  
  // Convert markdown headers to proper HTML with better styling (starting from H2)
  formatted = formatted
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-3xl font-semibold font-display text-slate-900 mt-10 mb-4">$1</h2>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-2xl font-semibold font-display text-slate-900 mt-8 mb-3">$1</h3>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4 class="text-xl font-semibold font-display text-slate-900 mt-6 mb-2">$1</h4>')
    // Convert blockquotes with custom styling
    .replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-primary bg-primary/5 pl-6 py-4 my-6 italic text-slate-700">$1</blockquote>')
    // Convert lists with custom styling
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li class="mb-2 text-slate-700">$1</li>')
    // Convert numbered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="mb-2 text-slate-700">$1</li>');

  // Restore markdown formatting before final processing
  formatted = restoreMarkdownFormatting(formatted);
  
  // Now handle bold and italic with better styling
  formatted = formatted
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-700">$1</em>');
    
  // Convert line breaks to paragraphs - handle this more carefully
  formatted = formatted
    .split('\n\n')
    .map(paragraph => {
      paragraph = paragraph.trim();
      if (!paragraph) return '';
      
      // Skip if already wrapped in HTML tags
      if (paragraph.match(/^<(h[2-6]|li|blockquote|ul|ol)/)) {
        return paragraph;
      }
      
      // Wrap plain text in paragraph tags
      return `<p class="mb-6 text-slate-700 leading-relaxed">${paragraph}</p>`;
    })
    .join('\n')
    // Group list items into proper ul/ol tags
    .replace(/(<li class="mb-2 text-slate-700">.*?<\/li>\s*)+/gs, (match) => {
      return `<ul class="list-disc list-inside space-y-2 my-6 text-slate-700">${match}</ul>`;
    })
    // Clean up empty paragraphs and fix formatting
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<[h2-6])/g, '$1')
    .replace(/(<\/[h2-6]>)<\/p>/g, '$1')
    // Add call-out support
    .replace(/\[!TIP\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, '<aside class="bg-primary/10 border-l-4 border-primary rounded-lg p-4 my-8"><p class="m-0 text-slate-700">💡 $1</p></aside>')
    .replace(/\[!NOTE\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, '<aside class="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-4 my-8"><p class="m-0 text-slate-700">📝 $1</p></aside>')
    .replace(/\[!WARNING\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, '<aside class="bg-orange-50 border-l-4 border-orange-400 rounded-lg p-4 my-8"><p class="m-0 text-slate-700">⚠️ $1</p></aside>')
    .trim();

  console.log('formatBlogContent output:', formatted.substring(0, 200) + '...');
  return formatted;
};

// Enhanced cleaning function with better content preservation
export const cleanContentForDisplay = (content: string, postType: string = ''): string => {
  if (!content || content.trim().length === 0) return '';
  
  console.log('🧼 cleanContentForDisplay:', { postType, contentLength: content.length });
  
  // Store original for fallback
  const originalContent = content;
  
  try {
    // For newsletters, use more conservative cleaning
    if (postType === 'newsletter') {
      const cleaned = cleanNewsletterForDisplay(content);
      // Safety check - ensure we didn't lose too much content
      if (cleaned.length < content.length * 0.2) {
        console.warn('⚠️ Newsletter cleaning too aggressive, using simple cleanup');
        return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      }
      return cleaned;
    }
    
    // For blog posts, preserve structure
    if (postType === 'blog') {
      return formatBlogContent(content);
    }
    
    // For other post types, use conservative cleaning
    let cleaned = stripMarkdown(content);
    
    // Only apply additional cleaning if content is still substantial
    if (cleaned.length > content.length * 0.5) {
      cleaned = cleaned
        // Remove remaining technical artifacts carefully
        .replace(/```[\s\S]*?```/g, ' ') // Replace with space
        .replace(/`[^`]+`/g, ' ') // Replace with space
        .replace(/&[a-zA-Z0-9#]+;/g, ' ') // Replace with space
        // Clean up whitespace more conservatively
        .replace(/\n\s*\n\s*\n/g, '\n\n')
        .replace(/\s+/g, ' ')
        .trim();
    }
    
    // Final safety check
    if (!cleaned || cleaned.length < 10) {
      console.warn('⚠️ Content cleaning resulted in too little content, using original');
      return originalContent;
    }
    
    return cleaned;
    
  } catch (error) {
    console.error('❌ Error in cleanContentForDisplay:', error);
    return originalContent; // Always fallback to original
  }
};

// Parse YAML newsletter content
const parseNewsletterYaml = (content: string): { content: string } | null => {
  try {
    // Remove code block markers if present
    const cleanContent = content.replace(/```yaml\s*/g, '').replace(/```\s*$/g, '');
    
    // Simple YAML parsing for newsletter_md format
    if (cleanContent.includes('newsletter_md:')) {
      const lines = cleanContent.split('\n');
      let inNewsletterMd = false;
      let newsletterContent = '';
      
      for (const line of lines) {
        if (line.trim() === 'newsletter_md: |') {
          inNewsletterMd = true;
          continue;
        }
        
        if (inNewsletterMd) {
          // Stop when we hit another top-level key or end of content
          if (line.trim() && !line.startsWith('  ') && !line.startsWith('#') && line.includes(':')) {
            break;
          }
          
          // Remove leading spaces (YAML indentation)
          const cleanLine = line.startsWith('  ') ? line.slice(2) : line;
          newsletterContent += cleanLine + '\n';
        }
      }
      
      return { content: newsletterContent.trim() };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing YAML:', error);
    return null;
  }
};

// Clean newsletter content with better content preservation
const cleanNewsletterForDisplay = (content: string): string => {
  if (!content || content.trim().length === 0) return '';
  
  console.log('📰 Cleaning newsletter content:', content.substring(0, 100) + '...');
  
  // First try to parse as YAML newsletter (new format)
  const yamlParsed = parseNewsletterYaml(content);
  if (yamlParsed && yamlParsed.content) {
    console.log('📰 Found YAML newsletter structure');
    const cleaned = stripAllNewsletterFormatting(yamlParsed.content);
    if (cleaned && cleaned.length > 10) {
      return cleaned;
    }
  }
  
  // Then try to parse as JSON newsletter (legacy format)
  const parsedNewsletter = parseNewsletterJson(content);
  if (parsedNewsletter) {
    console.log('📰 Found JSON newsletter structure');
    // Clean both subject and content with safety checks
    const cleanSubject = parsedNewsletter.subject ? stripAllNewsletterFormatting(parsedNewsletter.subject) : '';
    const cleanContent = parsedNewsletter.content ? stripAllNewsletterFormatting(parsedNewsletter.content) : '';
    
    // Ensure we have some content
    if (!cleanSubject && !cleanContent) {
      console.warn('⚠️ Newsletter JSON parsing resulted in empty content, using original');
      return stripAllNewsletterFormatting(content);
    }
    
    return cleanSubject ? `${cleanSubject}\n\n${cleanContent}` : cleanContent;
  }
  
  // Clean regular newsletter content with fallback
  const cleaned = stripAllNewsletterFormatting(content);
  if (!cleaned || cleaned.length < 10) {
    console.warn('⚠️ Newsletter cleaning too aggressive, using minimal cleaning');
    return content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
  
  return cleaned;
};

// Strip formatting from newsletter content while preserving content structure
const stripAllNewsletterFormatting = (text: string): string => {
  if (!text || text.trim().length === 0) return '';
  
  console.log('🧹 Stripping newsletter formatting from:', text.substring(0, 100) + '...');
  
  // Store original length for safety check
  const originalLength = text.length;
  
  let cleaned = text
    // First preserve line breaks around key content patterns
    .replace(/(\w)(<[^>]*>)(\w)/g, '$1 $2 $3') // Add space around HTML tags
    .replace(/(\w)(\*\*[^*]+\*\*)(\w)/g, '$1 $2 $3') // Space around bold markdown
    
    // Remove HTML tags but preserve spacing
    .replace(/<[^>]*>/g, ' ')
    // Remove HTML entities
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    
    // Handle markdown formatting more carefully
    .replace(/^#{1,6}\s+(.+)$/gm, '\n$1\n') // Convert headers to paragraph breaks
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold but keep text
    .replace(/\*([^*]+)\*/g, '$1') // Remove italic but keep text
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    
    // Handle code blocks carefully
    .replace(/```[\s\S]*?```/g, ' ') // Replace with space, not empty
    .replace(/`([^`]+)`/g, '$1')
    
    // Handle links and images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '') // Remove images
    
    // Handle lists more carefully
    .replace(/^\s*[-*+]\s+(.+)$/gm, '• $1') // Convert to bullet points
    .replace(/^\s*\d+\.\s+(.+)$/gm, '$1') // Remove numbered list markers
    
    // Handle blockquotes
    .replace(/^\s*>\s+(.+)$/gm, '$1')
    
    // Clean up excessive whitespace but preserve paragraph structure
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Max 2 consecutive newlines
    .trim();
  
  // Safety check - if we removed too much content, fall back to simpler cleaning
  if (cleaned.length < originalLength * 0.3) {
    console.warn('⚠️ Newsletter formatting stripped too much content, falling back to simple cleaning');
    cleaned = text
      .replace(/<[^>]*>/g, ' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  console.log('🧹 Newsletter formatting cleaned:', {
    originalLength,
    cleanedLength: cleaned.length,
    reductionRatio: ((originalLength - cleaned.length) / originalLength * 100).toFixed(1) + '%'
  });
  
  return cleaned;
};

// Enhanced blog metadata extraction that ignores H1 tags in content
export const extractBlogMetadata = (content: string) => {
  // Don't extract title from H1 tags since we'll use the campaign title instead
  const title = null;
  
  // Estimate reading time (average 200 words per minute)
  const wordCount = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200);
  
  return {
    title,
    readingTime,
    wordCount
  };
};

export const truncateText = (text: string, maxLength: number, suffix: string = '...'): string => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + suffix;
};

export const getStatusConfig = (status: string) => {
  const configs = {
    draft: {
      label: 'Draft',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800'
    },
    pending: {
      label: 'Pending',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800'
    },
    review: {
      label: 'Review',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800'
    },
    scheduled: {
      label: 'Scheduled',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800'
    },
    posted: {
      label: 'Ready',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800'
    },
    approved: {
      label: 'Approved',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800'
    }
  };

  return configs[status as keyof typeof configs] || {
    label: status,
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-800'
  };
};
