/**
 * Central z-index token system for consistent layering
 * Each layer is spaced by 10 to allow for variants
 */
export const Z = {
  base: 1,
  header: 10,
  sidebar: 20,
  overlay: 30,
  popover: 40,
  modal: 50,
  toast: 60
} as const;

export type ZIndex = typeof Z[keyof typeof Z];