/**
 * Height left for the app below the impersonation banner. The banner sets
 * --impersonation-banner-height on <html> while it shows (0 otherwise), so
 * full-height shells never push the document into a scroll.
 */
export const IMPERSONATION_BANNER_HEIGHT_VAR = "--impersonation-banner-height";

export const APP_VIEWPORT_HEIGHT = `calc(100dvh - var(${IMPERSONATION_BANNER_HEIGHT_VAR}, 0px))`;
