
// Content filtering utilities
export const SUPPORTED_POST_TYPES = ['instagram', 'facebook', 'newsletter', 'email', 'blog', 'video'] as const;

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

// Helper function to add structure to plain text blog content
const addBlogStructureToPlainText = (text: string): string => {
  // Protect formatting first
  const protectedText = preserveMarkdownFormatting(text);
  
  // Split content into paragraphs
  const paragraphs = protectedText.split('\n\n').filter(p => p.trim());
  
  if (paragraphs.length < 3) {
    // Not enough content to structure, return as is with restored formatting
    return restoreMarkdownFormatting(protectedText);
  }
  
  // Try to identify logical sections based on content patterns
  let structured = '';
  
  // If content looks like it has natural sections, add headers
  if (paragraphs.length >= 4) {
    // First paragraph might be intro
    structured += `## ${extractTopicFromParagraph(paragraphs[0])}\n\n${paragraphs[0]}\n\n`;
    
    // Middle paragraphs become sections
    for (let i = 1; i < paragraphs.length - 1; i++) {
      structured += `## ${extractTopicFromParagraph(paragraphs[i])}\n\n${paragraphs[i]}\n\n`;
    }
    
    // Last paragraph might be conclusion/CTA
    structured += `## Next Steps\n\n${paragraphs[paragraphs.length - 1]}\n\n`;
  } else {
    // Fallback: just add a general structure
    structured += `## Garden Care Insights\n\n${paragraphs[0]}\n\n`;
    if (paragraphs[1]) {
      structured += `## Expert Tips\n\n${paragraphs[1]}\n\n`;
    }
    if (paragraphs[2]) {
      structured += `## Your Next Step\n\n${paragraphs[2]}\n\n`;
    }
  }
  
  // Restore formatting before returning
  return restoreMarkdownFormatting(structured);
};

// Extract a topic from a paragraph for header generation
const extractTopicFromParagraph = (paragraph: string): string => {
  // Simple extraction based on first few words or key gardening terms
  const words = paragraph.trim().split(' ').slice(0, 10);
  const text = words.join(' ');
  
  // Look for gardening keywords to create relevant headers
  if (text.toLowerCase().includes('plant') || text.toLowerCase().includes('grow')) {
    return 'Planting & Growing Tips';
  }
  if (text.toLowerCase().includes('water') || text.toLowerCase().includes('drought')) {
    return 'Watering & Care';
  }
  if (text.toLowerCase().includes('season') || text.toLowerCase().includes('summer') || text.toLowerCase().includes('winter')) {
    return 'Seasonal Gardening';
  }
  if (text.toLowerCase().includes('problem') || text.toLowerCase().includes('pest') || text.toLowerCase().includes('disease')) {
    return 'Problem Solutions';
  }
  if (text.toLowerCase().includes('tip') || text.toLowerCase().includes('advice')) {
    return 'Expert Advice';
  }
  
  // Fallback: create a generic header
  return 'Garden Insights';
};

// ENHANCED blog content formatting with better spacing and formatting preservation
export const formatBlogContent = (text: string): string => {
  if (!text) return '';
  
  console.log('formatBlogContent input:', text.substring(0, 200) + '...');
  
  // Protect markdown formatting first
  let formatted = preserveMarkdownFormatting(text);
  
  // First, remove any existing H1 tags since the title will be displayed in the header
  formatted = formatted.replace(/^#{1}\s+.*$/gm, '');
  
  // Check if content lacks proper markdown structure and try to add it
  const hasMarkdownHeaders = /^#{2,6}\s+/.test(formatted);
  
  if (!hasMarkdownHeaders) {
    // Try to detect and create structure for plain text content
    formatted = addBlogStructureToPlainText(formatted);
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

// Enhanced cleaning function that preserves structure for blog posts and newsletters
export const cleanContentForDisplay = (content: string, postType: string = ''): string => {
  if (!content) return '';
  
  // For newsletters, try to parse JSON first
  if (postType === 'newsletter') {
    const parsedNewsletter = parseNewsletterJson(content);
    if (parsedNewsletter) {
      // Return formatted newsletter content with subject as title
      const formattedContent = formatBlogContent(parsedNewsletter.content);
      return `<h1 class="text-4xl font-bold text-slate-900 mb-6">${parsedNewsletter.subject}</h1>${formattedContent}`;
    }
  }
  
  // For blog posts and newsletters, preserve more structure
  if (postType === 'blog' || postType === 'newsletter') {
    return formatBlogContent(content);
  }
  
  // For other post types, use the existing cleaning logic
  let cleaned = stripMarkdown(content);
  
  // Remove any remaining technical artifacts
  cleaned = cleaned
    // Remove code blocks that might have been missed
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    // Remove HTML entities
    .replace(/&[a-zA-Z0-9#]+;/g, '')
    // Remove excessive whitespace and normalize line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .replace(/\s+/g, ' ')
    // Remove any leftover brackets or technical formatting
    .replace(/\[.*?\]/g, '')
    .replace(/\{.*?\}/g, '')
    .trim();
    
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
