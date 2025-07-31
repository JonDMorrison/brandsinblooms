export const Z_INDEX = {
  sidebar: 1000000,
  modal: 1000001,
  dropdown: 1000010,
  tooltip: 1000020,
};

// Scroll lock utility for dropdown management
export const scrollLock = {
  lock() {
    document.body.style.overflow = 'hidden';
    console.log('[DropdownFix] Scroll locked');
  },
  
  unlock() {
    document.body.style.overflow = '';
    console.log('[DropdownFix] Scroll unlocked');
  }
};