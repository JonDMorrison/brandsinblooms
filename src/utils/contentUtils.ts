
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

// Enhanced blog content formatting for the polished layout
export const formatBlogContent = (text: string): string => {
  if (!text) return '';
  
  console.log('formatBlogContent input:', text.substring(0, 200) + '...');
  
  let formatted = text;
  
  // First, remove any existing H1 tags since the title will be displayed in the header
  // This prevents redundant titles from appearing in the content
  formatted = formatted.replace(/^#{1}\s+.*$/gm, '');
  
  // Convert markdown headers to proper HTML with better styling (starting from H2)
  formatted = formatted
    .replace(/^#{2}\s+(.+)$/gm, '<h2 class="text-3xl font-semibold font-display text-slate-900 mt-10 mb-4">$1</h2>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3 class="text-2xl font-semibold font-display text-slate-900 mt-8 mb-3">$1</h3>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4 class="text-xl font-semibold font-display text-slate-900 mt-6 mb-2">$1</h4>')
    // Convert bold and italic with better styling
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em class="italic text-slate-700">$1</em>')
    // Convert blockquotes with custom styling
    .replace(/^>\s+(.+)$/gm, '<blockquote class="border-l-4 border-primary bg-primary/5 pl-6 py-4 my-6 italic text-slate-700">$1</blockquote>')
    // Convert lists with custom styling
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li class="mb-2 text-slate-700">$1</li>')
    // Convert numbered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="mb-2 text-slate-700">$1</li>')
    // Convert line breaks to paragraphs - handle this more carefully
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
