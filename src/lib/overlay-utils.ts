/**
 * Central overlay utilities - aria-hidden free zone
 * Use inert attribute for background isolation
 */

export function lockBackground() {
  // Lock body scrolling
  document.body.classList.add('overflow-hidden');
  
  // Lock all body children except overlay root using inert
  [...document.body.children].forEach(el => {
    if (!el.closest('#overlay-root') && el.id !== 'overlay-root') {
      (el as HTMLElement).setAttribute('inert', '');
    }
  });
}

export function unlockBackground() {
  // Unlock body scrolling
  document.body.classList.remove('overflow-hidden');
  
  // Remove inert from all elements
  [...document.body.children].forEach(el => {
    (el as HTMLElement).removeAttribute('inert');
  });
}

/**
 * Get or create the overlay portal container
 */
export function getOverlayRoot(): HTMLElement {
  let overlayRoot = document.getElementById('overlay-root');
  
  if (!overlayRoot) {
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'overlay-root';
    overlayRoot.style.position = 'fixed';
    overlayRoot.style.top = '0';
    overlayRoot.style.left = '0';
    overlayRoot.style.width = '100vw';
    overlayRoot.style.height = '100vh';
    overlayRoot.style.pointerEvents = 'none';
    overlayRoot.style.zIndex = '1000000';
    document.body.appendChild(overlayRoot);
  }
  
  return overlayRoot;
}