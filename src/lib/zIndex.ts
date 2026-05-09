/**
 * Central z-index token system for consistent layering.
 * Base app layers use a compact range; cross-modal studio overlays reserve
 * a dedicated high range so they can sit above Joy modals and app widgets.
 */
export const Z = {
  base: 1,
  header: 10,
  sidebar: 20,
  overlay: 30,
  popover: 40,
  modal: 50,
  toast: 60,
  studioBackdrop: 1499,
  studio: 1500,
  studioPreview: 1510,
} as const;

export type ZIndex = (typeof Z)[keyof typeof Z];
