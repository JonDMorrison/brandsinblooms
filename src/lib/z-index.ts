export const Z_INDEX = {
  sidebar: 1000000,
  modal: 1000001,
  dropdown: 1000010,
  tooltip: 1000020,
  portal: 1000015, // For portal containers
} as const;

// Legacy scroll lock utility - use scrollLockManager from dropdown-utils.ts instead
export const scrollLock = {
  lock() {
    document.body.style.overflow = 'hidden';
    console.log('[DropdownFix] Scroll locked (legacy)');
  },
  
  unlock() {
    document.body.style.overflow = '';
    console.log('[DropdownFix] Scroll unlocked (legacy)');
  }
};