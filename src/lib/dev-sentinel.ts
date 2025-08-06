/**
 * Development sentinel to catch and remove rogue aria-hidden attributes
 */

if (process.env.NODE_ENV === 'development') {
  new MutationObserver(muts => {
    muts.forEach(m => {
      // Check for added nodes with aria-hidden
      m.addedNodes.forEach(n => {
        if (n instanceof HTMLElement && n.hasAttribute('aria-hidden')) {
          // eslint-disable-next-line no-console
          console.warn('[Sentinel] stripping rogue aria-hidden →', n);
          n.removeAttribute('aria-hidden');
        }
      });
      
      // Check for aria-hidden attribute changes
      if (m.type === 'attributes' && m.attributeName === 'aria-hidden') {
        const target = m.target as HTMLElement;
        if (target.getAttribute('aria-hidden') === 'true') {
          // eslint-disable-next-line no-console
          console.warn('[Sentinel] blocking aria-hidden=true on →', target);
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
  
  // eslint-disable-next-line no-console
  console.log('[Sentinel] aria-hidden monitoring active');
}