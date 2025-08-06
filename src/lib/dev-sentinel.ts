/**
 * Development sentinel to catch and remove rogue aria-hidden attributes
 * Allows legitimate usage inside overlay portals and Radix components
 */

const isDev = process.env.NODE_ENV === 'development';

// --- allow-listed selectors (Radix & our portals) --------------------------
const ALLOWLIST = [
  '[data-radix-focus-guard]',
  '#overlay-root',
  '#modal-root',
  '[role="tooltip"]',
  '[data-overlay-lock]',
  '[data-overlay-root]',
  '[data-radix-popper-content-wrapper]',
  '[data-radix-select-content]',
  '[data-radix-dropdown-menu-content]',
  '[data-radix-popover-content]',
];

function isAllowlisted(node: Element): boolean {
  return ALLOWLIST.some(sel => node.matches(sel) || node.closest(sel));
}

function isOverlay(el: Element): boolean {
  return el.closest('[data-overlay-root]') !== null;
}

// ---------------------------------------------------------------------------

if (isDev) {
  const observer = new MutationObserver(records => {
    for (const r of records) {
      // Allow aria-hidden inside overlay portals - Radix needs this for proper behavior
      if (
        r.type === 'attributes' &&
        r.attributeName === 'aria-hidden' &&
        (isOverlay(r.target as Element) || isAllowlisted(r.target as Element))
      ) {
        continue; // allow overlay/allowlisted elements to manage their own aria-hidden
      }

      // Check for added nodes with aria-hidden (outside allowlist)
      r.addedNodes.forEach(n => {
        if (
          n instanceof HTMLElement &&
          n.hasAttribute('aria-hidden') &&
          !isAllowlisted(n)           // ← skip allow-listed nodes
        ) {
          if (isDev) {
            // eslint-disable-next-line no-console
            console.warn('[Sentinel] stripping rogue aria-hidden from added node →', n);
          }
          n.removeAttribute('aria-hidden');
        }
      });
      
      // Check for aria-hidden attribute changes (outside allowlist)
      if (r.type === 'attributes' && r.attributeName === 'aria-hidden') {
        const target = r.target as HTMLElement;
        if (
          target.getAttribute('aria-hidden') === 'true' &&
          !isOverlay(target) &&
          !isAllowlisted(target)
        ) {
          if (isDev) {
            // eslint-disable-next-line no-console
            console.warn('[Sentinel] blocking rogue aria-hidden=true on →', target);
          }
          target.removeAttribute('aria-hidden');
        }
      }
    }
  });

  observer.observe(document.body, {
    subtree: true, 
    attributes: true, 
    attributeFilter: ['aria-hidden'],
    childList: true
  });
  
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log('[Sentinel] aria-hidden monitoring active (allowlist-aware)');
  }
}