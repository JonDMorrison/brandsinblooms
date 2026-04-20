export type Environment = "development" | "production";

/**
 * Detect the current environment based on the window location
 * Development: localhost
 * Production: bloomsuite.app and custom domains
 */
export function detectEnvironment(): Environment {
  const hostname = window.location.hostname;
  const isDev =
    hostname.includes("localhost") ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local");
  return isDev ? "development" : "production";
}

/**
 * Get environment-aware OAuth redirect URI
 */
export function getOAuthRedirectUri(path: string = "/auth/callback"): string {
  // Always use the current origin so PKCE code_verifier (stored in
  // localStorage on this origin) matches the domain where the code
  // will be exchanged. Previous hardcode of https://bloomsuite.app
  // broke flows initiated from https://www.bloomsuite.app.
  return `${window.location.origin}${path}`;
}

/**
 * Get a display-friendly name for the current environment
 */
export function getEnvironmentName(): string {
  return detectEnvironment() === "development" ? "Development" : "Production";
}

/**
 * Check if currently in development environment
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === "development";
}
