import React from 'react';
import { sanitizeHtml, sanitizeNewsletterContent, sanitizeSocialContent } from '@/utils/htmlSanitizer';
import { cleanNewsletterContent } from '@/utils/newsletterContentProcessor';

interface SafeHtmlProps {
  content: string;
  className?: string;
  type?: 'general' | 'newsletter' | 'social' | 'newsletter-clean';
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
      case 'newsletter-clean':
        return cleanNewsletterContent(content);
      default:
        return sanitizeHtml(content);
    }
  };

  // For newsletter-clean type, render as plain text with preserved line breaks
  if (type === 'newsletter-clean') {
    return (
      <div className={`${className} whitespace-pre-wrap`}>
        {getSanitizedContent()}
      </div>
    );
  }

  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: getSanitizedContent() }}
    />
  );
};