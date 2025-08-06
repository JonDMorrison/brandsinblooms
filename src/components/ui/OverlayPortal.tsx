import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z } from '@/lib/zIndex';

interface OverlayPortalProps {
  children: React.ReactNode;
  container?: HTMLElement | null;
  zIndex?: keyof typeof Z;
  className?: string;
}

// Ensure overlay root exists
const getOverlayRoot = (): HTMLElement => {
  let overlayRoot = document.getElementById('overlay-root');
  if (!overlayRoot) {
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'overlay-root';
    overlayRoot.style.position = 'fixed';
    overlayRoot.style.top = '0';
    overlayRoot.style.left = '0';
    overlayRoot.style.pointerEvents = 'none';
    overlayRoot.style.zIndex = String(Z.overlay);
    document.body.appendChild(overlayRoot);
  }
  return overlayRoot;
};

export const OverlayPortal: React.FC<OverlayPortalProps> = ({
  children,
  container,
  zIndex = 'popover',
  className
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // Apply z-index and enable pointer events for this specific overlay
      containerRef.current.style.zIndex = String(Z[zIndex]);
      containerRef.current.style.pointerEvents = 'auto';
      containerRef.current.style.position = 'relative';
      
      if (className) {
        containerRef.current.className = className;
      }
    }
  }, [zIndex, className]);

  const targetContainer = container || getOverlayRoot();

  return createPortal(
    <div ref={containerRef}>
      {children}
    </div>,
    targetContainer
  );
};