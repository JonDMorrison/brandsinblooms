/**
 * HTML sanitization utilities for production security
 * Provides safe alternatives to dangerouslySetInnerHTML
 */

// Simple HTML sanitizer - removes potentially dangerous elements and attributes
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  
  // Create a temporary element to parse the HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove all script tags and their content
  const scripts = tempDiv.querySelectorAll('script');
  scripts.forEach(script => script.remove());
  
  // Remove dangerous event handlers
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(element => {
    // Remove all event handler attributes
    Array.from(element.attributes).forEach(attr => {
      if (attr.name.startsWith('on')) {
        element.removeAttribute(attr.name);
      }
    });
    
    // Remove dangerous attributes
    const dangerousAttrs = ['href', 'src', 'action', 'formaction', 'style'];
    dangerousAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr);
        if (value && (value.includes('javascript:') || value.includes('data:') || value.includes('vbscript:'))) {
          element.removeAttribute(attr);
        }
      }
    });
  });
  
  // Remove dangerous tags
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'];
  dangerousTags.forEach(tag => {
    const elements = tempDiv.querySelectorAll(tag);
    elements.forEach(el => el.remove());
  });
  
  return tempDiv.innerHTML;
};

// Safe HTML rendering component props
export interface SafeHtmlProps {
  content: string;
  className?: string;
  allowedTags?: string[];
}

// For newsletter content specifically
export const sanitizeNewsletterContent = (content: string): string => {
  if (!content) return '';
  
  // Allow basic formatting tags for newsletters
  const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a'];
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  // Remove all non-allowed tags
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(element => {
    if (!allowedTags.includes(element.tagName.toLowerCase())) {
      // Replace with its content
      element.outerHTML = element.innerHTML;
    }
  });
  
  return sanitizeHtml(tempDiv.innerHTML);
};

// For social media content
export const sanitizeSocialContent = (content: string): string => {
  if (!content) return '';
  
  // Very restrictive for social media posts
  const allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i'];
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach(element => {
    if (!allowedTags.includes(element.tagName.toLowerCase())) {
      element.outerHTML = element.innerHTML;
    }
  });
  
  return sanitizeHtml(tempDiv.innerHTML);
};