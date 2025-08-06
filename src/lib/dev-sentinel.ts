/**
 * Development sentinel to catch and remove rogue aria-hidden attributes
 * Allows legitimate usage inside overlay portals
 */

const isDev = process.env.NODE_ENV === 'development';

function isOverlay(el: Element): boolean {
  return el.closest('[data-overlay-root]') !== null;
}

if (isDev) {
  new MutationObserver(muts => {
    muts.forEach(m => {
      // Allow aria-hidden inside overlay portals - Radix needs this for proper behavior
      if (
        m.type === 'attributes' &&
        m.attributeName === 'aria-hidden' &&
        isOverlay(m.target as Element)
      ) {
        return; // allow overlay to manage its own aria-hidden
      }

      // Check for added nodes with aria-hidden (outside overlays)
      m.addedNodes.forEach(n => {
        if (n instanceof HTMLElement && n.hasAttribute('aria-hidden') && !isOverlay(n)) {
          if (isDev) {
            // eslint-disable-next-line no-console
            console.warn('[Sentinel] stripping rogue aria-hidden from added node →', n);
          }
          n.removeAttribute('aria-hidden');
        }
      });
      
      // Check for aria-hidden attribute changes (outside overlays)
      if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
        const target = m.target as HTMLElement;
        if (target.getAttribute('aria-hidden') === 'true' && !isOverlay(target)) {
          if (isDev) {
            // eslint-disable-next-line no-console
            console.warn('[Sentinel] blocking rogue aria-hidden=true on →', target);
          }
          target.removeAttribute('aria-hidden');
        }
      }
    });
  }).observe(document.body, {
    subtree: true, 
    attributes: true, 
    attributeFilter: ['aria-hidden'],
    childList: true
  });
  
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[Sentinel] aria-hidden monitoring active (overlay-aware)');
  }
}