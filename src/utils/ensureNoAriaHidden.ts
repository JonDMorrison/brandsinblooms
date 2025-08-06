/**
 * Enhanced safety net to aggressively remove aria-hidden attributes
 * Includes mutation observer for real-time monitoring
 */

let mutationObserver: MutationObserver | null = null;

export function ensureNoAriaHidden() {
  // Remove all aria-hidden attributes
  const bad = document.querySelectorAll('[aria-hidden="true"]');
  bad.forEach(el => {
    console.warn('[AriaHidden] Removing aria-hidden from:', el);
    el.removeAttribute('aria-hidden');
  });
  
  // Also check nested elements and shadow DOM
  document.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      const shadowBad = el.shadowRoot.querySelectorAll('[aria-hidden="true"]');
      shadowBad.forEach(shadowEl => {
        console.warn('[AriaHidden] Removing aria-hidden from shadow DOM:', shadowEl);
        shadowEl.removeAttribute('aria-hidden');
      });
    }
  });
}

export function startAriaHiddenMonitoring() {
  if (mutationObserver) return;
  
  mutationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'aria-hidden') {
        const target = mutation.target as Element;
        if (target.getAttribute('aria-hidden') === 'true') {
          console.warn('[AriaHidden] Detected aria-hidden=true on:', target);
          console.trace('[AriaHidden] Stack trace for aria-hidden detection');
          // Optionally remove it immediately
          target.removeAttribute('aria-hidden');
        }
      }
    });
  });
  
  mutationObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['aria-hidden'],
    subtree: true
  });
  
  console.log('[AriaHidden] Mutation observer started');
}

export function stopAriaHiddenMonitoring() {
  if (mutationObserver) {
    mutationObserver.disconnect();
    mutationObserver = null;
    console.log('[AriaHidden] Mutation observer stopped');
  }
}