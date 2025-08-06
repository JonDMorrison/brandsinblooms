/**
 * Development-only sentinel to catch problematic aria-hidden manipulation
 * Excludes Radix portals to avoid interfering with legitimate accessibility patterns
 */

console.log('[DEV-SENTINEL] Loading in development mode');

// Enhanced Radix detection
const isRadixOverlay = (el: HTMLElement) =>
  el.closest('[data-radix-popper-content-wrapper], [data-radix-modal-content], [data-radix-portal], #overlay-root');

// Enable in development mode
if (import.meta.env.DEV) {
  console.log('[DEV-SENTINEL] Initializing enhanced aria-hidden mutation observer');

  // Monitor aria-hidden changes and added nodes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Handle attribute changes
      if (mutation.type === 'attributes') {
        const target = mutation.target as HTMLElement;
        const attrName = mutation.attributeName;
        
        // Only monitor aria-hidden changes outside of Radix components
        if (attrName === "aria-hidden" && !isRadixOverlay(target)) {
          const newValue = target.getAttribute('aria-hidden');
          const hasDescendantWithFocus = target.querySelector(':focus');
          
          if (newValue === 'true' && hasDescendantWithFocus) {
            console.warn(
              '[DEV-SENTINEL] Blocked aria-hidden=true on element with descendant that retained focus:',
              target,
              'Focused descendant:',
              hasDescendantWithFocus
            );
            
            // Remove the problematic aria-hidden
            target.removeAttribute('aria-hidden');
          }
        }
      }
      
      // Handle added nodes
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (
            node instanceof HTMLElement &&
            node.hasAttribute('aria-hidden') &&
            isRadixOverlay(node)
          ) {
            // Allow Radix to manage its own aria-hidden
            return;
          }
        });
      }
    });
  });

  // Start observing
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    subtree: true
  });

  console.log('[DEV-SENTINEL] Observer active - monitoring aria-hidden outside Radix portals');
}