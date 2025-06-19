
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

// New function to preserve blog formatting
export const formatBlogContent = (text: string): string => {
  if (!text) return '';
  
  return text
    // Convert markdown headers to proper formatting
    .replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
    // Convert bold and italic
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Convert lists
    .replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/<\/ul>\s*<ul>/g, '') // Combine consecutive lists
    // Convert line breaks to paragraphs
    .replace(/\n\n+/g, '</p><p>')
    .replace(/^(?!<[h1-6]|<ul|<li)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs and fix formatting
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[h1-6])/g, '$1')
    .replace(/(<\/[h1-6]>)<\/p>/g, '$1')
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
