/**
 * Edit Overlay Registry
 * 
 * Tracks active editing overlays (merge tag picker, media selector, etc.)
 * so ClickToEditBlock can stay in edit mode while overlays are open.
 * This is in-memory UI state, not persisted.
 */

const activeOverlays = new Set<string>();

export function registerEditOverlay(id: string) {
  activeOverlays.add(id);
  console.log('[EditOverlayRegistry] Registered:', id, 'Active:', Array.from(activeOverlays));
}

export function unregisterEditOverlay(id: string) {
  activeOverlays.delete(id);
  console.log('[EditOverlayRegistry] Unregistered:', id, 'Active:', Array.from(activeOverlays));
}

export function hasActiveEditOverlays(): boolean {
  return activeOverlays.size > 0;
}

export function getActiveOverlays(): string[] {
  return Array.from(activeOverlays);
}
