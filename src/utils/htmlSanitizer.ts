/**
 * HTML sanitization utilities for production security
 * Provides safe alternatives to dangerouslySetInnerHTML
 */

// Simple HTML sanitizer - removes potentially dangerous elements and attributes
export const sanitizeHtml = (html: string): string => {
  if (!html) return '';
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  // Remove all script tags and their content
  tempDiv.querySelectorAll('script').forEach((script) => script.remove());
  
  // Sanitize all elements
  const allElements = tempDiv.querySelectorAll('*');
  allElements.forEach((element) => {
    // Remove inline event handlers (on*)
    Array.from(element.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) {
        element.removeAttribute(attr.name);
      }
    });

    // Always remove inline styles
    if (element.hasAttribute('style')) {
      element.removeAttribute('style');
    }

    // Restrict anchor tags and media sources
    if (element.tagName.toLowerCase() === 'a') {
      const href = element.getAttribute('href') || '';
      const allowedHref = /^(https?:|mailto:|tel:)/i.test(href);
      if (!allowedHref) {
        element.removeAttribute('href');
      }
      // Enforce safe link behavior
      element.setAttribute('rel', 'noopener noreferrer');
    }

    // Only allow http/https for src attributes
    if (element.hasAttribute('src')) {
      const src = element.getAttribute('src') || '';
      const allowedSrc = /^(https?:)/i.test(src);
      if (!allowedSrc) {
        element.removeAttribute('src');
      }
    }

    // Remove other dangerous attributes pointing to scripts
    ['action', 'formaction'].forEach((attr) => {
      if (element.hasAttribute(attr)) {
        const value = element.getAttribute(attr) || '';
        if (/^(javascript:|data:|vbscript:)/i.test(value)) {
          element.removeAttribute(attr);
        }
      }
    });
  });
  
  // Remove dangerous tags entirely
  const dangerousTags = ['iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'];
  dangerousTags.forEach((tag) => {
    tempDiv.querySelectorAll(tag).forEach((el) => el.remove());
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