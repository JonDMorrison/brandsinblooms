/**
 * Development sentinel to catch and remove rogue aria-hidden attributes
 * Allows legitimate usage inside overlay portals and Radix components
 */

// --- allow-listed selectors (Radix & our portals) --------------------------
const ALLOWLIST = [
  // Our overlay containers
  '[data-radix-focus-guard]',
  '[data-overlay-root]',
  '[data-overlay-lock]',
  '#overlay-root',
  '#modal-root',
  
  // Radix component selectors (more comprehensive)
  '[data-radix-select-content]',
  '[data-radix-select-viewport]',
  '[data-radix-select-item]',
  '[data-radix-dropdown-menu-content]',
  '[data-radix-dropdown-menu-item]',
  '[data-radix-popover-content]',
  '[data-radix-dialog-content]',
  '[data-radix-dialog-overlay]',
  '[data-radix-toast-viewport]',
  '[data-radix-tooltip-content]',
  '[data-radix-hover-card-content]',
  '[data-radix-context-menu-content]',
  '[data-radix-menubar-content]',
  '[data-radix-navigation-menu-content]',
  '[data-radix-popper-content-wrapper]',
  
  // Role-based selectors
  '[role="tooltip"]',
  '[role="dialog"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="combobox"]',
  
  // Class-based selectors for common overlay patterns
  '.radix-select-content',
  '.radix-dropdown-content',
  '.radix-popover-content',
  '.select-content',
  '.dropdown-content',
  '.popover-content',
];

// silence in prod
const log = import.meta.env.DEV ? console.warn : () => {};

function isAllowlisted(node: Element): boolean {
  // Check if the element itself or any parent matches allowlist
  return ALLOWLIST.some(sel => {
    try {
      return node.matches(sel) || node.closest(sel) !== null;
    } catch (e) {
      // Handle invalid selectors gracefully
      return false;
    }
  });
}

function isRadixComponent(node: Element): boolean {
  // More permissive check for Radix components
  const element = node as HTMLElement;
  
  // Check data attributes
  for (const attr of element.getAttributeNames()) {
    if (attr.startsWith('data-radix-')) {
      return true;
    }
  }
  
  // Check if any parent has radix data attributes
  let parent = element.parentElement;
  while (parent) {
    for (const attr of parent.getAttributeNames()) {
      if (attr.startsWith('data-radix-')) {
        return true;
      }
    }
    parent = parent.parentElement;
  }
  
  return false;
}

// ---------------------------------------------------------------------------

if (import.meta.env.DEV) {
  const observer = new MutationObserver(records => {
    for (const r of records) {
      r.addedNodes.forEach(n => {
        if (
          n instanceof HTMLElement &&
          n.hasAttribute('aria-hidden') &&
          !isAllowlisted(n) &&
          !isRadixComponent(n)
        ) {
          log('[Sentinel] stripping rogue aria-hidden from added node →', n);
          n.removeAttribute('aria-hidden');
        }
      });
      
      // Check for aria-hidden attribute changes (outside allowlist)
      if (r.type === 'attributes' && r.attributeName === 'aria-hidden') {
        const target = r.target as HTMLElement;
        if (
          target.getAttribute('aria-hidden') === 'true' &&
          !isAllowlisted(target) &&
          !isRadixComponent(target)
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
  
  console.log('[Sentinel] aria-hidden monitoring active with enhanced Radix detection');
}