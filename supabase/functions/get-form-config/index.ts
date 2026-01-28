import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// ─── In-Memory Rate Limiting ───────────────────────────────────────────────
// Lightweight first-layer protection (per IP, resets on cold start)
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;  // 60 requests per minute per IP

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(ip, { count: 1, windowStart: now });
    return false;
  }

  record.count++;
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }

  return false;
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(ip);
    }
  }
}, 300_000);

// ─── Validation ────────────────────────────────────────────────────────────
function validateEmbedKey(embedKey: string | null): { valid: boolean; error?: string } {
  if (!embedKey) {
    return { valid: false, error: 'embed_key query parameter is required' };
  }

  // Must be exactly 32 lowercase hex characters
  if (typeof embedKey !== 'string' || embedKey.length !== 32) {
    return { valid: false, error: 'Invalid embed_key format' };
  }

  if (!/^[a-f0-9]{32}$/.test(embedKey.toLowerCase())) {
    return { valid: false, error: 'Invalid embed_key format' };
  }

  return { valid: true };
}

function getClientIP(req: Request): string {
  // Check common headers for proxied requests
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIP = req.headers.get('x-real-ip');
  if (realIP) {
    return realIP.trim();
  }

  // Fallback - use a hash of user-agent + some request info as pseudo-IP
  const ua = req.headers.get('user-agent') || 'unknown';
  return `ua-${hashString(ua).toString(16)}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ─── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // ─── Step 1: Rate Limiting ─────────────────────────────────────────────
    const clientIP = getClientIP(req);
    
    if (isRateLimited(clientIP)) {
      // Log rate limit hit without PII
      console.log(`[get-form-config] Rate limit exceeded for IP hash: ${hashString(clientIP).toString(16)}`);
      return new Response(
        JSON.stringify({ error: 'Too many requests. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    // ─── Step 2: Validate embed_key ────────────────────────────────────────
    const url = new URL(req.url);
    const embedKey = url.searchParams.get('embed_key');

    const validation = validateEmbedKey(embedKey);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 3: Fetch form from database ──────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query form by embed_key - tenant_id derived from the form record only
    const { data: form, error } = await supabase
      .from('forms')
      .select('id, tenant_id, fields_json, settings_json, compliance_json')
      .eq('embed_key', embedKey!.toLowerCase())
      .maybeSingle();

    // ─── Step 4: Validate form exists and is published ─────────────────────
    if (error) {
      console.error('[get-form-config] Database error:', error.message);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!form) {
      // Log without exposing the embed_key (just first 8 chars for debugging)
      console.log(`[get-form-config] Form not found: ${embedKey!.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if form has a status field and validate it
    // Fetch status separately to ensure published check
    const { data: statusCheck, error: statusError } = await supabase
      .from('forms')
      .select('status')
      .eq('id', form.id)
      .single();

    if (statusError || !statusCheck || statusCheck.status !== 'published') {
      console.log(`[get-form-config] Form not published: ${embedKey!.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 5: Build audience_json from related tables ───────────────────
    // Fetch any persona assignments configured for this form
    let audienceJson: { assign_personas: string[]; assign_tags: string[] } = {
      assign_personas: [],
      assign_tags: []
    };

    // Check if there's audience configuration in settings_json
    const settings = form.settings_json as Record<string, unknown> | null;
    if (settings && typeof settings === 'object') {
      // Some forms might store audience config in settings
      if (Array.isArray((settings as any).assign_personas)) {
        audienceJson.assign_personas = (settings as any).assign_personas;
      }
      if (Array.isArray((settings as any).assign_tags)) {
        audienceJson.assign_tags = (settings as any).assign_tags;
      }
    }

    // ─── Step 6: Build response (no secrets, no PII) ───────────────────────
    const response = {
      form_id: form.id,
      fields_json: form.fields_json,
      settings_json: sanitizeSettings(form.settings_json),
      compliance_json: form.compliance_json,
      audience_json: audienceJson
    };

    return new Response(
      JSON.stringify(response),
      { 
        status: 200,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60', // Cache for 1 minute
        } 
      }
    );

  } catch (error) {
    console.error('[get-form-config] Unexpected error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Remove any sensitive fields from settings before returning to client
 */
function sanitizeSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object') {
    return {};
  }

  const sanitized = { ...(settings as Record<string, unknown>) };
  
  // Remove any notification_emails (internal admin config)
  delete sanitized.notification_emails;
  
  // Remove any webhook URLs that might be configured
  delete sanitized.webhook_url;
  delete sanitized.webhook_secret;
  
  // Remove internal tracking fields
  delete sanitized.internal_notes;
  delete sanitized.admin_only;

  return sanitized;
}
