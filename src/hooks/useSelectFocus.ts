import { useEffect } from 'react';

/**
 * Custom hook to handle focus management for Select components
 * Ensures first item gets focus when dropdown opens
 */
export const useSelectFocus = (isOpen: boolean) => {
  useEffect(() => {
    if (isOpen) {
      // Small delay to let Radix UI finish rendering
      const timeoutId = setTimeout(() => {
        const firstItem = document.querySelector('[data-radix-select-item]') as HTMLElement;
        if (firstItem) {
          firstItem.focus();
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);
};