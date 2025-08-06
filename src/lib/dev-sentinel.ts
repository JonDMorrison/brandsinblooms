/**
 * Development sentinel to catch and remove rogue aria-hidden attributes
 * Allows legitimate usage inside overlay portals and Radix components
 */

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

// silence in prod
const log = import.meta.env.DEV ? console.warn : () => {};

function isAllowlisted(node: Element): boolean {
  return ALLOWLIST.some(sel => node.matches(sel) || node.closest(sel));
}

// ---------------------------------------------------------------------------

if (import.meta.env.DEV) {
  const observer = new MutationObserver(records => {
    for (const r of records) {
      r.addedNodes.forEach(n => {
        if (
          n instanceof HTMLElement &&
          n.hasAttribute('aria-hidden') &&
          !isAllowlisted(n)
        ) {
          log('[Sentinel] stripping rogue aria-hidden →', n);
          n.removeAttribute('aria-hidden');
        }
      });
      
      // Check for aria-hidden attribute changes (outside allowlist)
      if (r.type === 'attributes' && r.attributeName === 'aria-hidden') {
        const target = r.target as HTMLElement;
        if (
          target.getAttribute('aria-hidden') === 'true' &&
          !isAllowlisted(target)
        ) {
          log('[Sentinel] blocking rogue aria-hidden=true on →', target);
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
  
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Sentinel] aria-hidden monitoring active (allowlist-aware)');
  }
}