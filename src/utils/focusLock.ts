/**
 * Simple focus lock utility using inert attribute
 * For MVP - basic keyboard trap avoidance only
 */

export const lock = (el: HTMLElement) => el.setAttribute('inert', '');
export const unlock = (el: HTMLElement) => el.removeAttribute('inert');

/**
 * Lock all body children except overlay containers
 */
export const lockBodySiblings = () => {
  const bodySiblings = Array.from(document.body.children);
  bodySiblings.forEach((sibling) => {
    if (sibling.id !== 'overlay-root' && sibling instanceof HTMLElement) {
      lock(sibling);
    }
  });
};

/**
 * Unlock all previously locked elements
 */
export const unlockBodySiblings = () => {
  const bodySiblings = Array.from(document.body.children);
  bodySiblings.forEach((sibling) => {
    if (sibling instanceof HTMLElement) {
      unlock(sibling);
    }
  });
};