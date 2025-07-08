import React from 'react';
import { sanitizeHtml, sanitizeNewsletterContent, sanitizeSocialContent } from '@/utils/htmlSanitizer';

interface SafeHtmlProps {
  content: string;
  className?: string;
  type?: 'general' | 'newsletter' | 'social';
}

/**
 * Safe HTML rendering component that sanitizes content before rendering
 * Use this instead of dangerouslySetInnerHTML for user-generated content
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({ 
  content, 
  className = '', 
  type = 'general' 
}) => {
  const getSanitizedContent = () => {
    switch (type) {
      case 'newsletter':
        return sanitizeNewsletterContent(content);
      case 'social':
        return sanitizeSocialContent(content);
      default:
        return sanitizeHtml(content);
    }
  };

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: getSanitizedContent() }}
    />
  );
};