/**
 * Shared CORS configuration for all Supabase Edge Functions
 *
 * This file provides standardized CORS headers that work reliably across
 * all browsers and comply with web standards.
 *
 * Key principles:
 * - Only use standard, widely-supported headers
 * - Remove non-standard headers like 'x-application-name' that can cause preflight failures
 * - Keep configuration consistent across all functions
 */

type CorsOptions = {
  allowHeaders?: string;
  allowMethods?: string;
  allowOrigin?: string;
  maxAge?: string;
};

const DEFAULT_ALLOW_ORIGIN = "*";
const DEFAULT_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, traceparent, tracestate";
const DEFAULT_ALLOW_METHODS = "GET, POST, PUT, DELETE, OPTIONS";
const DEFAULT_MAX_AGE = "86400";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://bloomsuite.app",
  "https://www.bloomsuite.app",
  "http://localhost:3000",
  "http://localhost:5173",
];

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

type EnvGet = (key: string) => string | undefined;
const denoEnvGet: EnvGet = (key) => Deno.env.get(key);

function readConfiguredOrigins(envGet: EnvGet = denoEnvGet): Set<string> {
  const configuredOrigins = new Set<string>();

  for (const origin of DEFAULT_ALLOWED_ORIGINS) {
    configuredOrigins.add(origin);
  }

  const envValues = [
    envGet("APP_ORIGIN"),
    envGet("APP_BASE_URL"),
    envGet("SITE_URL"),
    envGet("CMS_ORIGIN"),
    envGet("CRM_ORIGIN"),
    envGet("OAUTH_CORS_ORIGINS"),
  ];

  for (const envValue of envValues) {
    if (!envValue?.trim()) {
      continue;
    }

    for (const candidate of envValue.split(",")) {
      const normalized = normalizeOrigin(candidate.trim());
      if (normalized) {
        configuredOrigins.add(normalized);
      }
    }
  }

  return configuredOrigins;
}

/**
 * True only when `origin` (any URL; its origin is compared) is one of the platform's configured app origins.
 * A redirect back to the app after a provider flow uses a request- or state-supplied origin only when this
 * holds (central-login 59, crm-r2-F70); otherwise the caller falls back to its configured APP_ORIGIN.
 */
export function isConfiguredAppOrigin(
  origin: string | null | undefined,
  envGet: EnvGet = denoEnvGet,
): boolean {
  if (!origin) return false;
  const normalized = normalizeOrigin(origin);
  return normalized !== null && readConfiguredOrigins(envGet).has(normalized);
}

function resolveAllowOrigin(
  req?: Request,
  explicitAllowOrigin: string = DEFAULT_ALLOW_ORIGIN,
): string {
  if (explicitAllowOrigin !== DEFAULT_ALLOW_ORIGIN) {
    return explicitAllowOrigin;
  }

  const requestOrigin = req?.headers.get("Origin");
  if (!requestOrigin) {
    return DEFAULT_ALLOW_ORIGIN;
  }

  const normalizedOrigin = normalizeOrigin(requestOrigin);
  if (!normalizedOrigin) {
    return DEFAULT_ALLOW_ORIGIN;
  }

  return readConfiguredOrigins().has(normalizedOrigin)
    ? normalizedOrigin
    : DEFAULT_ALLOW_ORIGIN;
}

export const corsHeaders = {
  // TODO: tighten this with a validated tenant/storefront origin allowlist.
  "Access-Control-Allow-Origin": DEFAULT_ALLOW_ORIGIN,
  "Access-Control-Allow-Headers": DEFAULT_ALLOW_HEADERS,
  "Access-Control-Allow-Methods": DEFAULT_ALLOW_METHODS,
  "Access-Control-Max-Age": DEFAULT_MAX_AGE,
  Vary: "Origin",
};

export const buildCorsHeaders = (req?: Request, options: CorsOptions = {}) => ({
  "Access-Control-Allow-Origin": resolveAllowOrigin(req, options.allowOrigin),
  "Access-Control-Allow-Headers": options.allowHeaders ?? DEFAULT_ALLOW_HEADERS,
  "Access-Control-Allow-Methods": options.allowMethods ?? DEFAULT_ALLOW_METHODS,
  "Access-Control-Max-Age": options.maxAge ?? DEFAULT_MAX_AGE,
  Vary: "Origin",
});

/**
 * Handle CORS preflight requests
 * Call this at the beginning of your serve handler
 */
export const handleCorsPreflight = (
  req: Request,
  options: CorsOptions = {},
): Response | null => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(req, options),
    });
  }
  return null;
};

export const handleCorsPrelight = handleCorsPreflight;

/**
 * Add CORS headers to a response
 */
export const addCorsHeaders = (
  response: Response,
  options: CorsOptions = {},
): Response => {
  const headers = new Headers(response.headers);
  Object.entries(buildCorsHeaders(undefined, options)).forEach(
    ([key, value]) => {
      headers.set(key, value);
    },
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

/**
 * Create a JSON response with CORS headers
 */
export const corsJsonResponse = (
  data: unknown,
  options: {
    cors?: CorsOptions;
    status?: number;
    headers?: Record<string, string>;
  } = {},
): Response => {
  const { cors, status = 200, headers: additionalHeaders = {} } = options;

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(undefined, cors),
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
  });
};
