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

// TEMPORARILY DISABLED FOR DROPDOWN DEBUGGING
if (false && import.meta.env.DEV) {
  console.log('[Sentinel] DISABLED for dropdown debugging');
}