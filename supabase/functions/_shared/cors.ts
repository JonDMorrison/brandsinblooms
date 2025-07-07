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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Handle CORS preflight requests
 * Call this at the beginning of your serve handler
 */
export const handleCorsPrelight = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
};

/**
 * Add CORS headers to a response
 */
export const addCorsHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
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
  options: { status?: number; headers?: Record<string, string> } = {}
): Response => {
  const { status = 200, headers: additionalHeaders = {} } = options;
  
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  });
};