import { useEffect } from 'react';

/**
 * Hook to prevent accidental body scroll locks
 * Clears any lingering inert attributes or overflow locks
 */
export const useScrollGuard = () => {
  useEffect(() => {
    const clearScrollLocks = () => {
      // Remove any lingering inert attributes
      const inertElements = document.querySelectorAll('[inert]');
      if (inertElements.length > 0) {
        console.log('ScrollGuard: Clearing', inertElements.length, 'inert elements');
        inertElements.forEach(el => el.removeAttribute('inert'));
      }
      
      // Remove overflow-hidden from body if it exists without a dialog open
      const hasOpenDialog = document.querySelector('[role="dialog"]:not([aria-hidden="true"])');
      if (!hasOpenDialog && document.body.style.overflow === 'hidden') {
        console.log('ScrollGuard: Removing body overflow-hidden without open dialog');
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      }
    };

    // Clear on mount
    clearScrollLocks();
    
    // Also clear on any click (in case user clicked on segment)
    document.addEventListener('click', clearScrollLocks);
    
    return () => {
      document.removeEventListener('click', clearScrollLocks);
    };
  }, []);
};