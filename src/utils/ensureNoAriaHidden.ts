/**
 * Safety net to remove any aria-hidden attributes that might interfere with overlays
 * For MVP - basic cleanup only
 */

export function ensureNoAriaHidden() {
  const bad = document.querySelectorAll('[aria-hidden="true"]');
  bad.forEach(el => el.removeAttribute('aria-hidden'));
}