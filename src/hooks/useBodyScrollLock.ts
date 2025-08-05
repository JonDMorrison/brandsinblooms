import { useEffect, useRef } from 'react';

interface UseBodyScrollLockOptions {
  enabled?: boolean;
  id?: string;
}

export const useBodyScrollLock = ({ enabled = true, id = 'default' }: UseBodyScrollLockOptions = {}) => {
  const lockCountRef = useRef(0);
  const originalStylesRef = useRef<{
    overflow?: string;
    paddingRight?: string;
  }>({});

  useEffect(() => {
    if (!enabled) return;

    const lock = () => {
      if (lockCountRef.current === 0) {
        // Store original styles
        originalStylesRef.current = {
          overflow: document.body.style.overflow,
          paddingRight: document.body.style.paddingRight,
        };

        // Calculate scrollbar width
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
        
        // Apply lock styles
        document.body.style.overflow = 'hidden';
        document.body.style.paddingRight = `${scrollbarWidth}px`;
        
        // Add inert to root if available
        const rootElement = document.getElementById('root');
        if (rootElement) {
          rootElement.setAttribute('inert', 'true');
        }

        console.log(`[BodyScrollLock] Locked body scroll (${id})`);
      }
      lockCountRef.current++;
    };

    const unlock = () => {
      lockCountRef.current = Math.max(0, lockCountRef.current - 1);
      
      if (lockCountRef.current === 0) {
        // Restore original styles
        document.body.style.overflow = originalStylesRef.current.overflow || '';
        document.body.style.paddingRight = originalStylesRef.current.paddingRight || '';
        
        // Remove inert from root
        const rootElement = document.getElementById('root');
        if (rootElement) {
          rootElement.removeAttribute('inert');
        }

        console.log(`[BodyScrollLock] Unlocked body scroll (${id})`);
      }
    };

    // Handle escape key
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        unlock();
      }
    };

    lock();
    document.addEventListener('keydown', handleEscape);

    return () => {
      unlock();
      document.removeEventListener('keydown', handleEscape);
    };
  }, [enabled, id]);

  return {
    lockCount: lockCountRef.current,
  };
};