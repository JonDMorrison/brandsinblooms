import { useEffect, useCallback, useRef } from 'react';

interface UseBeforeUnloadOptions {
  when: boolean;
  message?: string;
  onBeforeUnload?: () => void | Promise<void>;
}

/**
 * Hook to warn users before leaving the page with unsaved changes
 * Also triggers a save callback before unload
 */
export function useBeforeUnload(options: UseBeforeUnloadOptions) {
  const { when, message = 'You have unsaved changes. Are you sure you want to leave?', onBeforeUnload } = options;
  const onBeforeUnloadRef = useRef(onBeforeUnload);
  
  // Keep ref updated
  useEffect(() => {
    onBeforeUnloadRef.current = onBeforeUnload;
  }, [onBeforeUnload]);
  
  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (!when) return;
    
    // Try to save before unloading
    if (onBeforeUnloadRef.current) {
      try {
        onBeforeUnloadRef.current();
      } catch (error) {
        console.error('Error in beforeunload callback:', error);
      }
    }
    
    // Show browser confirmation dialog
    e.preventDefault();
    e.returnValue = message;
    return message;
  }, [when, message]);
  
  useEffect(() => {
    if (when) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [when, handleBeforeUnload]);
}
