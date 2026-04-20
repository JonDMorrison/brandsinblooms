/**
 * Environment detection utility for edge functions
 * Determines if we're running in development/preview or production
 */

export type Environment = "development" | "production";

type EnvGetter = (key: string) => string | undefined;

export interface CredentialResolution {
  clientId: string | undefined;
  clientSecret: string | undefined;
  clientIdSource: string | null;
  clientSecretSource: string | null;
  warnings: string[];
}

function normalizeOriginCandidate(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;

  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    try {
      return new URL(`https://${trimmed}`).origin.toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }
}

function extractHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return value
      .replace(/^[a-z]+:\/\//i, "")
      .split("/")[0]
      .split(":")[0]
      .toLowerCase();
  }
}

function isDevelopmentHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".local") ||
    hostname === "lovable.app" ||
    hostname.endsWith(".lovable.app") ||
    hostname.endsWith(".lovableproject.com")
  );
}

export function extractRequestOrigin(
  req: Request,
  envGet: EnvGetter = (key) => Deno.env.get(key),
): string | null {
  const candidates = [
    req.headers.get("origin"),
    req.headers.get("referer"),
    envGet("APP_ORIGIN"),
    envGet("APP_BASE_URL"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOriginCandidate(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function detectEnvironmentFromOrigin(
  value: string | null | undefined,
): Environment {
  const normalized = normalizeOriginCandidate(value);
  if (!normalized) return "production";

  const hostname = extractHostname(normalized);
  const isDev = isDevelopmentHostname(hostname);

  return isDev ? "development" : "production";
}

/**
 * Detect the current environment based on the request origin
 * Development includes: localhost, lovableproject.com preview URLs
 * Production: bloomsuite.app and custom domains
 */
export function detectEnvironment(req: Request): Environment {
  const extractedOrigin = extractRequestOrigin(req);
  const environment = detectEnvironmentFromOrigin(extractedOrigin);

  console.log(
    `🌍 Environment detected: ${environment} (origin: ${extractedOrigin || "unknown"})`,
  );

  return environment;
}

/**
 * Get environment-specific secret value
 * Looks for DEV or PROD suffix based on environment
 */
export function getEnvSecret(
  baseName: string,
  env: Environment,
  envGet: EnvGetter = (key) => Deno.env.get(key),
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

export function resolveFacebookCredentials(
  env: Environment,
  envGet: EnvGetter = (key) => Deno.env.get(key),
): CredentialResolution {
  const suffix = env === "development" ? "_DEV" : "_PROD";
  const envClientId = envGet(`FB_CLIENT_ID${suffix}`);
  const envClientSecret = envGet(`FB_CLIENT_SECRET${suffix}`);
  const legacyClientId = envGet("FB_CLIENT_ID");
  const legacyClientSecret = envGet("FB_CLIENT_SECRET");
  const warnings: string[] = [];

  if (env === "production") {
    if (!envClientId && legacyClientId) {
      warnings.push(
        "❌ FB_CLIENT_ID_PROD is not set for production environment. Falling back to legacy FB_CLIENT_ID — this may cause redirect URI mismatches if the legacy key belongs to a different Meta App.",
      );
    }

    if (!envClientSecret && legacyClientSecret) {
      warnings.push(
        "❌ FB_CLIENT_SECRET_PROD is not set for production environment. Falling back to legacy FB_CLIENT_SECRET — this may cause token exchange failures if the legacy secret belongs to a different Meta App.",
      );
    }
  }

  return {
    clientId: envClientId || legacyClientId,
    clientSecret: envClientSecret || legacyClientSecret,
    clientIdSource: envClientId
      ? `FB_CLIENT_ID${suffix}`
      : legacyClientId
        ? "FB_CLIENT_ID"
        : null,
    clientSecretSource: envClientSecret
      ? `FB_CLIENT_SECRET${suffix}`
      : legacyClientSecret
        ? "FB_CLIENT_SECRET"
        : null,
    warnings,
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
