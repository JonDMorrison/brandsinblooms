/**
 * Shared Opacity Utilities
 * SINGLE SOURCE OF TRUTH for opacity normalization across preview and email generation
 * Ensures WYSIWYG consistency between app preview and sent emails
 */

/** Default opacity values for each overlay type */
export const OPACITY_DEFAULTS = {
  colorOverlay: 50,      // Color overlay default (0-100 scale)
  darkOverlay: 0,        // Dark overlay default (0-100, 0 = disabled)
  backgroundImage: 100,  // Background image opacity default (100 = fully visible)
  imageOverlay: 0,       // Custom image overlay (0 = disabled)
} as const;

/**
 * Normalize opacity value to decimal (0-1) for CSS/email rendering
 * Handles both percentage (0-100) and decimal (0-1) inputs
 * 
 * @param value - Raw opacity value (can be 0-100 or 0-1)
 * @param defaultValue - Default value if undefined (in 0-100 scale)
 * @returns Normalized opacity as decimal (0-1) for CSS usage
 */
export function normalizeOpacityToDecimal(
  value: number | undefined | null, 
  defaultValue: number = 0
): number {
  const raw = value ?? defaultValue;
  // If value > 1, assume it's percentage (0-100) and convert to decimal
  return raw > 1 ? raw / 100 : raw;
}

/**
 * Normalize opacity value to percentage (0-100) for storage/UI
 * Handles both percentage (0-100) and decimal (0-1) inputs
 * 
 * @param value - Raw opacity value
 * @param defaultValue - Default value if undefined (in 0-100 scale)
 * @returns Normalized opacity as percentage (0-100)
 */
export function normalizeOpacityToPercentage(
  value: number | undefined | null, 
  defaultValue: number = 0
): number {
  const raw = value ?? defaultValue;
  // If value <= 1 and not 0, assume it's decimal and convert to percentage
  if (raw > 0 && raw <= 1) {
    return raw * 100;
  }
  return raw;
}

/**
 * Get normalized opacity values for a block (all overlay types)
 * Returns values ready for CSS (decimal 0-1 format)
 */
export function getBlockOpacities(block: {
  colorOverlayOpacity?: number | null;
  darkOverlayOpacity?: number | null;
  backgroundOpacity?: number | null;
  overlayOpacity?: number | null;
}) {
  return {
    colorOverlay: normalizeOpacityToDecimal(block.colorOverlayOpacity, OPACITY_DEFAULTS.colorOverlay),
    darkOverlay: normalizeOpacityToDecimal(block.darkOverlayOpacity, OPACITY_DEFAULTS.darkOverlay),
    backgroundImage: normalizeOpacityToDecimal(block.backgroundOpacity, OPACITY_DEFAULTS.backgroundImage),
    imageOverlay: normalizeOpacityToDecimal(block.overlayOpacity, OPACITY_DEFAULTS.imageOverlay),
  };
}

/**
 * Get raw opacity values for a block (percentage 0-100 format for storage)
 */
export function getBlockOpacitiesRaw(block: {
  colorOverlayOpacity?: number | null;
  darkOverlayOpacity?: number | null;
  backgroundOpacity?: number | null;
  overlayOpacity?: number | null;
}) {
  return {
    colorOverlayOpacity: normalizeOpacityToPercentage(block.colorOverlayOpacity, OPACITY_DEFAULTS.colorOverlay),
    darkOverlayOpacity: normalizeOpacityToPercentage(block.darkOverlayOpacity, OPACITY_DEFAULTS.darkOverlay),
    backgroundOpacity: normalizeOpacityToPercentage(block.backgroundOpacity, OPACITY_DEFAULTS.backgroundImage),
    overlayOpacity: normalizeOpacityToPercentage(block.overlayOpacity, OPACITY_DEFAULTS.imageOverlay),
  };
}
