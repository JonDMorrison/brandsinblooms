
/**
 * Removes markdown syntax from text for clean previews
 */
export const stripMarkdown = (text: string): string => {
  if (!text) return '';
  
  return text
    // Remove headers
    .replace(/#{1,6}\s+/g, '')
    // Remove bold and italic
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Remove links
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks and inline code
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove line breaks and extra spaces
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Truncates text to specified length with suffix
 */
export const truncateText = (text: string, length: number, suffix: string = '…'): string => {
  if (!text || text.length <= length) return text;
  return text.substring(0, length).trim() + suffix;
};

/**
 * Returns platform configuration for post types
 */
export const getPlatformConfig = (postType: string) => {
  const configs = {
    newsletter: {
      icon: 'Mail',
      color: '#6366F1',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700',
      borderColor: 'border-indigo-200'
    },
    facebook: {
      icon: 'Facebook',
      color: '#1D4ED8',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200'
    },
    linkedin: {
      icon: 'Linkedin',
      color: '#0A66C2',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-200'
    },
    blog: {
      icon: 'BookOpen',
      color: '#7C3AED',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-200'
    },
    video: {
      icon: 'Video',
      color: '#F97316',
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-700',
      borderColor: 'border-orange-200'
    },
    instagram: {
      icon: 'Instagram',
      color: '#E1306C',
      bgColor: 'bg-pink-50',
      textColor: 'text-pink-700',
      borderColor: 'border-pink-200'
    }
  };

  return configs[postType as keyof typeof configs] || {
    icon: 'FileText',
    color: '#64748B',
    bgColor: 'bg-gray-50',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200'
  };
};

/**
 * Returns status badge configuration - NO YELLOW COLORS
 */
export const getStatusConfig = (status: string) => {
  const configs = {
    draft: {
      color: '#64748B',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      label: 'Draft'
    },
    review: {
      color: '#F97316',
      bgColor: 'bg-orange-100',
      textColor: 'text-orange-800',
      label: 'Review'
    },
    scheduled: {
      color: '#3B82F6', // Changed from yellow to blue
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      label: 'Scheduled'
    },
    posted: {
      color: '#22C55E',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      label: 'Ready'
    },
    approved: {
      color: '#22C55E',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      label: 'Approved'
    },
    pending: {
      color: '#6B7280',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      label: 'Pending'
    },
    generating: {
      color: '#3B82F6',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      label: 'Generating'
    }
  };

  return configs[status as keyof typeof configs] || configs.draft;
};
