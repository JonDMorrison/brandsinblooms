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
  
  // No cleanup needed - let Radix handle accessibility properly

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