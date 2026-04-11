/**
 * Email Domains Configuration
 * Centralized configuration for email domain setup including Entri Connect integration
 */

/**
 * Get Entri Application ID from environment variable
 * This is a publishable key, safe for frontend usage
 */
const getEntriAppId = (): string => {
  const appId = import.meta.env.VITE_ENTRI_APPLICATION_ID?.trim();

  if (appId) {
    return appId;
  }

  // Development fallback with warning
  if (import.meta.env.DEV) {
    return "bloomsuite";
  }

  // Production: warn but don't crash the app - Entri auto-setup will be disabled
  return "";
};

export const emailDomainsConfig = {
  // Entri Connect configuration
  entriEnabled: true,
  // This is a publishable key, safe for frontend
  entriAppId: getEntriAppId(),
  entriScriptUrl: "https://cdn.goentri.com/entri.js",

  // Feature flags
  autoSetupRecommended: true,

  // Validation
  isEntriConfigured(): boolean {
    return (
      this.entriEnabled &&
      this.entriAppId.length > 0 &&
      this.entriAppId !== "YOUR_ENTRI_APP_ID"
    );
  },
};
