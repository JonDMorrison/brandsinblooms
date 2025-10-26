import { useEffect } from 'react';

/**
 * Dynamic Font Loader Hook
 * 
 * Dynamically loads Google Fonts into the document head.
 * Cleans up when component unmounts or font URLs change.
 * 
 * @param fontUrls - Array of Google Fonts URLs to load
 */
export const useDynamicFontLoader = (fontUrls: (string | undefined)[]) => {
  useEffect(() => {
    // Filter out undefined/null values
    const validUrls = fontUrls.filter((url): url is string => !!url);
    
    if (validUrls.length === 0) return;

    // Remove any existing dynamically loaded font links
    const existingLinks = document.querySelectorAll('link[data-dynamic-font]');
    existingLinks.forEach(link => link.remove());

    // Add new font links
    const loadedLinks: HTMLLinkElement[] = [];
    
    validUrls.forEach(url => {
      // Check if this font URL is already loaded (not by us)
      const existing = document.querySelector(`link[href="${url}"]:not([data-dynamic-font])`);
      if (existing) return;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url;
      link.setAttribute('data-dynamic-font', 'true');
      document.head.appendChild(link);
      loadedLinks.push(link);
    });

    // Cleanup function - remove only the links we added
    return () => {
      loadedLinks.forEach(link => {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      });
    };
  }, [fontUrls.join(',')]);
};
