/**
 * Central overlay utilities - aria-hidden free zone
 * Use inert attribute for background isolation
 */

export function lockBackground() {
  // DISABLED - causing global unclickability
  // TODO: Implement proper overlay management
  console.log('lockBackground called but disabled to prevent inert issues');
}

export function unlockBackground() {
  // Force cleanup of any remaining inert attributes
  document.body.classList.remove('overflow-hidden');
  
  // Remove inert from ALL elements (emergency cleanup)
  document.querySelectorAll('[inert]').forEach(el => {
    el.removeAttribute('inert');
  });
  
  console.log('unlockBackground: cleaned up all inert attributes');
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