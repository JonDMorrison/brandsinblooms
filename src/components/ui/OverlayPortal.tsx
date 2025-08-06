import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface OverlayPortalProps {
  children: React.ReactNode;
  className?: string;
  zIndex?: string;
  [key: string]: any; // Allow additional props
}

/**
 * Defensive portal that ensures overlays are rendered in a safe container
 * and cleans up any aria-hidden attributes that might interfere
 */
export const OverlayPortal: React.FC<OverlayPortalProps> = ({ children, className, zIndex, ...props }) => {
  const overlayRoot = document.getElementById('overlay-root') || document.body;
  
  useEffect(() => {
    // Cleanup aria-hidden on mount
    const cleanup = () => {
      const ariaHiddenElements = document.querySelectorAll('[aria-hidden="true"]');
      ariaHiddenElements.forEach(el => {
        console.warn('[OverlayPortal] Removing aria-hidden from:', el);
        el.removeAttribute('aria-hidden');
      });
    };
    
    cleanup();
    
    // Cleanup on unmount
    return cleanup;
  }, []);

  return createPortal(
    <div 
      className={className} 
      style={{ 
        pointerEvents: 'auto',
        zIndex: zIndex || 'auto'
      }}
      {...props}
    >
      {children}
    </div>,
    overlayRoot
  );
};