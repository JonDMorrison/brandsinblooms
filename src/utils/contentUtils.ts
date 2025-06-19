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
