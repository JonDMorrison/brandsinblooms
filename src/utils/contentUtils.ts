// Content filtering utilities
export const SUPPORTED_POST_TYPES = ['instagram', 'facebook', 'newsletter', 'email', 'blog', 'video'] as const;

export type SupportedPostType = typeof SUPPORTED_POST_TYPES[number];

// Filter function to remove unsupported content types
export const filterSupportedContent = <T extends { post_type: string }>(items: T[]): T[] => {
  return items.filter(item => SUPPORTED_POST_TYPES.includes(item.post_type as SupportedPostType));
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

// Enhanced blog content formatting for the polished layout
export const formatBlogContent = (text: string): string => {
  if (!text) return '';
  
  return text
    // Convert markdown headers to proper formatting with better styling
    .replace(/^#{1}\s+(.+)$/gm, '<h1 class="text-4xl font-bold font-display text-slate-900 mt-12 mb-6 first:mt-0">$1</h1>')
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
    .replace(/(<li>.*<\/li>)/gs, '<ul class="list-disc list-inside space-y-2 my-6 text-slate-700">$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '') // Combine consecutive lists
    // Convert numbered lists
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li class="mb-2 text-slate-700">$1</li>')
    .replace(/(<li class="mb-2 text-slate-700">(?:(?!<li).)*<\/li>\s*)+/gs, (match) => {
      return `<ol class="list-decimal list-inside space-y-2 my-6 text-slate-700">${match}</ol>`;
    })
    // Convert paragraphs with proper spacing
    .replace(/\n\n+/g, '</p><p class="mb-6 text-slate-700 leading-relaxed">')
    .replace(/^(?!<[h1-6]|<ul|<ol|<li|<blockquote)(.+)$/gm, '<p class="mb-6 text-slate-700 leading-relaxed">$1</p>')
    // Clean up empty paragraphs and fix formatting
    .replace(/<p[^>]*><\/p>/g, '')
    .replace(/<p[^>]*>(<[h1-6])/g, '$1')
    .replace(/(<\/[h1-6]>)<\/p>/g, '$1')
    // Add call-out support
    .replace(/\[!TIP\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, '<aside class="bg-primary/10 border-l-4 border-primary rounded-lg p-4 my-8"><p class="m-0 text-slate-700">💡 $1</p></aside>')
    .replace(/\[!NOTE\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, '<aside class="bg-blue-50 border-l-4 border-blue-400 rounded-lg p-4 my-8"><p class="m-0 text-slate-700">📝 $1</p></aside>')
    .replace(/\[!WARNING\]\s*\n(.*?)(?=\n\n|\n$|$)/gs, '<aside class="bg-orange-50 border-l-4 border-orange-400 rounded-lg p-4 my-8"><p class="m-0 text-slate-700">⚠️ $1</p></aside>')
    .trim();
};

// Enhanced cleaning function that preserves structure for blog posts and newsletters
export const cleanContentForDisplay = (content: string, postType: string = ''): string => {
  if (!content) return '';
  
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

// Extract blog metadata from content
export const extractBlogMetadata = (content: string) => {
  const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i) || content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : null;
  
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
