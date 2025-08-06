import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { lockBackground, unlockBackground } from '@/lib/overlay-utils';

interface OverlayState {
  overlayCount: number;
  scrollLocked: boolean;
  focusStack: HTMLElement[];
}

interface OverlayManagerContextType {
  openOverlay: (context: string) => void;
  closeOverlay: (context: string) => void;
  isScrollLocked: boolean;
  overlayCount: number;
}

const OverlayManagerContext = createContext<OverlayManagerContextType | undefined>(undefined);

export const useOverlayManager = () => {
  const context = useContext(OverlayManagerContext);
  if (!context) {
    throw new Error('useOverlayManager must be used within OverlayManager');
  }
  return context;
};

interface OverlayManagerProps {
  children: React.ReactNode;
}

export const OverlayManager: React.FC<OverlayManagerProps> = ({ children }) => {
  const [state, setState] = useState<OverlayState>({
    overlayCount: 0,
    scrollLocked: false,
    focusStack: []
  });

  // Simplified overlay manager - use central overlay utils
  useEffect(() => {
    return () => {
      // Cleanup any remaining locks on unmount
      unlockBackground();
    };
  }, []);

  const originalBodyStyle = useRef<{
    overflow: string;
    position: string;
    top: string;
    width: string;
  }>({ overflow: '', position: '', top: '', width: '' });
  
  const originalScrollY = useRef<number>(0);

  const lockScroll = useCallback(() => {
    if (!state.scrollLocked) {
      // Store original values
      originalScrollY.current = window.scrollY;
      originalBodyStyle.current = {
        overflow: document.body.style.overflow,
        position: document.body.style.position,
        top: document.body.style.top,
        width: document.body.style.width
      };

      // Apply scroll lock using central utility
      lockBackground();

      setState(prev => ({ ...prev, scrollLocked: true }));
      console.log('[OverlayManager] Scroll locked via central utility');
    }
  }, [state.scrollLocked]);

  const unlockScroll = useCallback(() => {
    if (state.scrollLocked && state.overlayCount === 0) {
      // Restore original styles
      const original = originalBodyStyle.current;
      document.body.style.overflow = original.overflow;
      document.body.style.position = original.position;
      document.body.style.top = original.top;
      document.body.style.width = original.width;

      // Unlock using central utility
      unlockBackground();

      // Restore scroll position
      window.scrollTo(0, originalScrollY.current);

      setState(prev => ({ ...prev, scrollLocked: false }));
      console.log('[OverlayManager] Scroll unlocked via central utility');
    }
  }, [state.scrollLocked, state.overlayCount]);

  const openOverlay = useCallback((context: string) => {
    // Store focus
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement) {
      setState(prev => ({
        ...prev,
        overlayCount: prev.overlayCount + 1,
        focusStack: [...prev.focusStack, activeElement]
      }));
    } else {
      setState(prev => ({ ...prev, overlayCount: prev.overlayCount + 1 }));
    }

    // Lock scroll on first overlay
    if (state.overlayCount === 0) {
      lockScroll();
    }

    console.log(`[OverlayManager] Overlay opened: ${context} (count: ${state.overlayCount + 1})`);
  }, [state.overlayCount, lockScroll]);

  const closeOverlay = useCallback((context: string) => {
    setState(prev => {
      const newCount = Math.max(0, prev.overlayCount - 1);
      let newFocusStack = prev.focusStack;
      
      // Restore focus to last element
      if (prev.focusStack.length > 0) {
        const lastFocused = prev.focusStack[prev.focusStack.length - 1];
        if (lastFocused && document.contains(lastFocused)) {
          setTimeout(() => lastFocused.focus(), 0);
        }
        newFocusStack = prev.focusStack.slice(0, -1);
      }

      return {
        ...prev,
        overlayCount: newCount,
        focusStack: newFocusStack
      };
    });

    // Unlock scroll when no overlays remain
    setTimeout(() => {
      if (state.overlayCount - 1 === 0) {
        unlockScroll();
      }
    }, 0);

    console.log(`[OverlayManager] Overlay closed: ${context} (count: ${Math.max(0, state.overlayCount - 1)})`);
    console.debug('[OverlayManager] Close debug - no aria-hidden cleanup needed');
  }, [state.overlayCount, state.focusStack, unlockScroll]);

  const value: OverlayManagerContextType = {
    openOverlay,
    closeOverlay,
    isScrollLocked: state.scrollLocked,
    overlayCount: state.overlayCount
  };

  return (
    <OverlayManagerContext.Provider value={value}>
      {children}
    </OverlayManagerContext.Provider>
  );
};