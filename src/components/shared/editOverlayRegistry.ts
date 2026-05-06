const activeOverlays = new Set<string>();

export function registerEditOverlay(id: string) {
  activeOverlays.add(id);
}

export function unregisterEditOverlay(id: string) {
  activeOverlays.delete(id);
}

export function hasActiveEditOverlays(): boolean {
  return activeOverlays.size > 0;
}

export function getActiveOverlays(): string[] {
  return Array.from(activeOverlays);
}
