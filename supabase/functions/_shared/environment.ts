/**
 * Environment detection utility for edge functions
 * Determines if we're running in development/preview or production
 */

export type Environment = "development" | "production";

export function detectEnvironmentFromOrigin(
  value: string | null | undefined,
): Environment {
  const normalized = (value || "").toLowerCase();

  const isDev =
    normalized.includes("localhost") ||
    normalized.includes("lovableproject.com") ||
    normalized.includes("lovable.app");

  return isDev ? "development" : "production";
}

/**
 * Detect the current environment based on the request origin
 * Development includes: localhost, lovableproject.com preview URLs
 * Production: bloomsuite.app and custom domains
 */
export function detectEnvironment(req: Request): Environment {
  return detectEnvironmentFromOrigin(
    req.headers.get("origin") || req.headers.get("referer"),
  );
}

/**
 * Get environment-specific secret value
 * Looks for DEV or PROD suffix based on environment
 */
export function getEnvSecret(
  baseName: string,
  env: Environment,
  envGet: (key: string) => string | undefined = (key) => Deno.env.get(key),
): string | undefined {
  const suffix = env === "development" ? "_DEV" : "_PROD";

  // Prefer environment-specific secrets (recommended)
  const envSpecific = envGet(`${baseName}${suffix}`);
  if (envSpecific) return envSpecific;

  // Backwards-compatible fallback (some older deployments used unsuffixed secrets)
  // Example: LIGHTSPEED_CLIENT_ID / LIGHTSPEED_CLIENT_SECRET
  return envGet(baseName);
}

/**
 * Get Lightspeed credentials for the current environment
 */
export function getLightspeedCredentials(env: Environment): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: getEnvSecret("LIGHTSPEED_CLIENT_ID", env),
    clientSecret: getEnvSecret("LIGHTSPEED_CLIENT_SECRET", env),
  };
}

/**
 * Get Facebook/Meta credentials for the current environment
 */
export function getFacebookCredentials(env: Environment): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: getEnvSecret("FB_CLIENT_ID", env),
    clientSecret: getEnvSecret("FB_CLIENT_SECRET", env),
  };
}

/**
 * Get Mailchimp credentials for the current environment
 */
export function getMailchimpCredentials(env: Environment): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: getEnvSecret("MAILCHIMP_CLIENT_ID", env),
    clientSecret: getEnvSecret("MAILCHIMP_CLIENT_SECRET", env),
  };
}

/**
 * Get Square credentials for the current environment
 */
export function getSquareCredentials(env: Environment): {
  clientId: string | undefined;
  clientSecret: string | undefined;
} {
  return {
    clientId: getEnvSecret("SQUARE_CLIENT_ID", env),
    clientSecret: getEnvSecret("SQUARE_CLIENT_SECRET", env),
  };
}

/**
 * Get environment-aware redirect URI for OAuth callbacks
 *
 * ⚠️ DEPRECATED - DO NOT USE THIS FUNCTION
 * This function is NOT used by the OAuth flow and has incorrect development URL.
 *
 * The OAuth flow uses dynamic redirect URIs:
 * - Frontend: window.location.origin + '/oauth/callback' (via src/utils/environmentUtils.ts)
 * - Backend: Uses redirect_uri from frontend request body (no construction needed)
 *
 * Development: https://{preview-id}.lovableproject.com/oauth/callback
 * Production: https://bloomsuite.app/oauth/callback
 */
export function getOAuthRedirectUri(
  env: Environment,
  path: string = "/oauth/callback",
): string {
  console.warn(
    "⚠️ getOAuthRedirectUri() is deprecated and unused. Use frontend environment utils instead.",
  );
  const baseUrl =
    env === "development"
      ? "https://lovable.app" // ❌ INCORRECT - should be dynamic preview URL
      : "https://bloomsuite.app";
  return `${baseUrl}${path}`;
}
