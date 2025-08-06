/**
 * Development-only sentinel to catch problematic aria-hidden manipulation
 * Excludes Radix portals to avoid interfering with legitimate accessibility patterns
 */

console.log('[DEV-SENTINEL] Environment check:', process.env.VITE_ENABLE_SENTINEL);

if (process.env.VITE_ENABLE_SENTINEL === "true") {
  console.log('[DEV-SENTINEL] Initializing aria-hidden mutation observer');

  // Monitor aria-hidden changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes') {
        const target = mutation.target as HTMLElement;
        const attrName = mutation.attributeName;
        
        // Only monitor aria-hidden changes outside of Radix portals
        if (attrName === "aria-hidden" &&
            !target.closest('#overlay-root,[data-radix-portal]')) {
          
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