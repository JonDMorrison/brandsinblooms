import { createPortal } from 'react-dom';
import { Z_INDEX } from './z-index';

// Universal dropdown portal manager
export class DropdownPortalManager {
  private static instance: DropdownPortalManager;
  private portalContainer: HTMLElement | null = null;

  static getInstance(): DropdownPortalManager {
    if (!DropdownPortalManager.instance) {
      DropdownPortalManager.instance = new DropdownPortalManager();
    }
    return DropdownPortalManager.instance;
  }

  // Get or create a high z-index portal container
  getPortalContainer(): HTMLElement {
    if (!this.portalContainer) {
      this.portalContainer = document.createElement('div');
      this.portalContainer.id = 'dropdown-portal-root';
      this.portalContainer.style.position = 'fixed';
      this.portalContainer.style.top = '0';
      this.portalContainer.style.left = '0';
      this.portalContainer.style.zIndex = String(Z_INDEX.dropdown);
      this.portalContainer.style.pointerEvents = 'none';
      document.body.appendChild(this.portalContainer);
    }
    return this.portalContainer;
  }

  // Create a portal specifically for dropdown content
  createDropdownPortal(children: React.ReactNode, container?: HTMLElement | null): React.ReactPortal {
    const targetContainer = container || this.getPortalContainer();
    return createPortal(children, targetContainer);
  }
}

// Enhanced scroll lock utility with modal support
export const scrollLockManager = {
  private: {
    originalBodyStyle: '',
    lockCount: 0,
    modalLockCount: 0,
    originalScrollY: 0,
  },

  lock(context: string = 'dropdown') {
    const isModal = context === 'modal' || context === 'sheet';
    
    if (isModal) {
      this.private.modalLockCount++;
      console.log(`[DropdownFix] Modal scroll context registered: ${context}`);
      return; // Modals/sheets should not lock body scroll
    }
    
    if (this.private.lockCount === 0) {
      // Store original styles before locking
      this.private.originalScrollY = window.scrollY;
      this.private.originalBodyStyle = document.body.style.overflow;
      
      // Apply scroll lock
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${this.private.originalScrollY}px`;
      document.body.style.width = '100%';
      
      console.log(`[DropdownFix] Scroll locked by: ${context}`);
    }
    this.private.lockCount++;
  },

  unlock(context: string = 'dropdown') {
    const isModal = context === 'modal' || context === 'sheet';
    
    if (isModal) {
      this.private.modalLockCount = Math.max(0, this.private.modalLockCount - 1);
      console.log(`[DropdownFix] Modal scroll context unregistered: ${context}`);
      return; // Modals/sheets don't affect body scroll
    }
    
    this.private.lockCount = Math.max(0, this.private.lockCount - 1);
    
    if (this.private.lockCount === 0) {
      // Restore original styles
      document.body.style.overflow = this.private.originalBodyStyle;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      
      // Restore scroll position
      window.scrollTo(0, this.private.originalScrollY);
      
      console.log(`[DropdownFix] Scroll unlocked by: ${context}`);
    }
  },

  // Force unlock (emergency cleanup)
  forceUnlock() {
    this.private.lockCount = 0;
    this.private.modalLockCount = 0;
    this.unlock('force');
  }
};

// Focus management utility
export const focusManager = {
  private: {
    lastFocusedElement: null as HTMLElement | null,
  },

  storeFocus() {
    this.private.lastFocusedElement = document.activeElement as HTMLElement;
  },

  restoreFocus() {
    if (this.private.lastFocusedElement) {
      this.private.lastFocusedElement.focus();
      this.private.lastFocusedElement = null;
    }
  }
};

// Event handler utilities for dropdown behavior
export const dropdownEventUtils = {
  // Prevent event bubbling that might close dropdowns immediately
  preventBubbling: (event: Event) => {
    event.stopPropagation();
  },

  // Handle escape key to close dropdowns
  handleEscape: (event: KeyboardEvent, onClose: () => void) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  },

  // Handle outside clicks to close dropdowns
  handleOutsideClick: (event: MouseEvent, containerRef: React.RefObject<HTMLElement>, onClose: () => void) => {
    if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
      onClose();
    }
  }
};

// ARIA utilities for dropdown accessibility
export const ariaUtils = {
  // Remove aria-hidden from dropdown content and ensure visibility
  ensureDropdownVisibility: (element: HTMLElement) => {
    element.removeAttribute('aria-hidden');
    element.style.visibility = 'visible';
    element.style.pointerEvents = 'auto';
    element.style.opacity = '1';
  },

  // Set proper ARIA attributes for dropdown triggers
  setTriggerAttributes: (trigger: HTMLElement, contentId: string, isOpen: boolean) => {
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', String(isOpen));
    trigger.setAttribute('aria-controls', contentId);
  },

  // Set proper ARIA attributes for dropdown content
  setContentAttributes: (content: HTMLElement, triggerId: string) => {
    content.setAttribute('role', 'menu');
    content.setAttribute('aria-labelledby', triggerId);
  }
};

// Debug logging utility
export const dropdownLogger = {
  logOpen: (type: string, context?: string) => {
    const message = context 
      ? `[DropdownFix] Repaired dropdown behavior in ${context}: ${type}` 
      : `[DropdownFix] Opened: ${type}`;
    console.log(message);
  },

  logClose: (type: string, reason?: string) => {
    const message = reason 
      ? `[DropdownFix] Closed: ${type} (${reason})` 
      : `[DropdownFix] Closed: ${type}`;
    console.log(message);
  },

  logError: (type: string, error: string) => {
    console.error(`[DropdownFix] Error in ${type}: ${error}`);
  }
};