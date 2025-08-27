import { useEffect } from 'react';

export const GlobalVisibilityManager = () => {
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden/user switched away
        window.dispatchEvent(new CustomEvent('app:tab-hidden', {
          detail: { timestamp: Date.now() }
        }));
      } else {
        // Tab is visible/user returned
        window.dispatchEvent(new CustomEvent('app:tab-visible', {
          detail: { timestamp: Date.now() }
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // This component renders nothing
  return null;
};