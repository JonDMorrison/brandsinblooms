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

export const corsHeaders = {
  // TODO: tighten this with a validated tenant/storefront origin allowlist.
  'Access-Control-Allow-Origin': DEFAULT_ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': DEFAULT_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': DEFAULT_ALLOW_METHODS,
  'Access-Control-Max-Age': DEFAULT_MAX_AGE,
};

export const buildCorsHeaders = (
  _req?: Request,
  options: CorsOptions = {},
) => ({
  'Access-Control-Allow-Origin': options.allowOrigin ?? DEFAULT_ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': options.allowHeaders ?? DEFAULT_ALLOW_HEADERS,
  'Access-Control-Allow-Methods': options.allowMethods ?? DEFAULT_ALLOW_METHODS,
  'Access-Control-Max-Age': options.maxAge ?? DEFAULT_MAX_AGE,
});

/**
 * Handle CORS preflight requests
 * Call this at the beginning of your serve handler
 */
export const handleCorsPreflight = (
  req: Request,
  options: CorsOptions = {},
): Response | null => {
  if (req.method === 'OPTIONS') {
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
  Object.entries(buildCorsHeaders(undefined, options)).forEach(([key, value]) => {
    headers.set(key, value);
  });
  
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
  data: any, 
  options: {
    cors?: CorsOptions;
    status?: number;
    headers?: Record<string, string>;
  } = {}
): Response => {
  const { cors, status = 200, headers: additionalHeaders = {} } = options;
  
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...buildCorsHeaders(undefined, cors),
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  });
};