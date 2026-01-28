import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── CORS Headers (hardened for public embed access) ───────────────────────
// These headers are included in ALL responses (success, error, 404, 429, etc.)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
} as const;

/**
 * Create a JSON response with CORS headers.
 * IMPORTANT: All responses MUST use this helper to ensure CORS headers are always included.
 */
function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

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
  // Handle CORS preflight - must include all CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    // ─── Step 1: Rate Limiting ─────────────────────────────────────────────
    const clientIP = getClientIP(req);
    
    if (isRateLimited(clientIP)) {
      // Log rate limit hit without PII
      console.log(`[get-form-config] Rate limit exceeded for IP hash: ${hashString(clientIP).toString(16)}`);
      return jsonResponse(
        { error: 'Too many requests. Please try again later.' },
        429,
        { 'Retry-After': '60' }
      );
    }

    // ─── Step 2: Validate embed_key ────────────────────────────────────────
    const url = new URL(req.url);
    const embedKey = url.searchParams.get('embed_key');

    const validation = validateEmbedKey(embedKey);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
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
      return jsonResponse({ error: 'Internal server error' }, 500);
    }

    if (!form) {
      // Log without exposing the embed_key (just first 8 chars for debugging)
      console.log(`[get-form-config] Form not found: ${embedKey!.slice(0, 8)}...`);
      return jsonResponse({ error: 'Form not found' }, 404);
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
      return jsonResponse({ error: 'Form not found' }, 404);
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

    // ─── Step 6: Build response (SANITIZED - no secrets, no PII) ────────────
    // SECURITY: All output is filtered through explicit allowlists
    const responseData = {
      form_id: form.id,
      fields_json: form.fields_json, // Fields define form structure, no secrets
      settings_json: sanitizeSettings(form.settings_json),
      compliance_json: sanitizeCompliance(form.compliance_json),
      // NOTE: audience_json is NOT returned to browser - it's backend-only
      // Persona/tag assignments happen server-side in submit-form
    };

    return jsonResponse(responseData, 200, { 'Cache-Control': 'public, max-age=60' });

  } catch (error) {
    console.error('[get-form-config] Unexpected error:', (error as Error).message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

// ─── Output Sanitization (SECURITY CRITICAL) ──────────────────────────────

/**
 * ALLOWLIST of settings_json fields safe to return to browser.
 * 
 * SECURITY: This is an explicit allowlist, NOT a denylist.
 * Only fields listed here will be returned to the client.
 * Any new settings must be explicitly added to this list after security review.
 * 
 * Categories:
 * - UI/Display: success_message, submit_button_text, show_branding
 * - Navigation: success_redirect_url
 * - Theming: theme object (colors, fonts, spacing)
 * - Layout: form_width, field_spacing, label_position
 * 
 * NEVER include in allowlist:
 * - notification_emails (admin PII)
 * - webhook_url, webhook_secret (backend secrets)
 * - api_key, secret_key (any secrets)
 * - internal_notes, admin_only (internal config)
 * - assign_personas, assign_tags (handled separately in audience_json)
 */
const SETTINGS_ALLOWLIST = {
  // ─── UI/Display Fields ───────────────────────────────────────────────────
  success_message: true,           // Message shown after successful submission
  submit_button_text: true,        // Text on submit button
  show_branding: true,             // Whether to show "Powered by BloomSuite"
  form_title: true,                // Optional title above form
  form_description: true,          // Optional description above form
  
  // ─── Navigation ──────────────────────────────────────────────────────────
  success_redirect_url: true,      // URL to redirect after success
  
  // ─── Theme Object ────────────────────────────────────────────────────────
  // Nested theme object is allowed with its own sub-allowlist
  theme: {
    primary_color: true,           // Primary brand color (hex)
    secondary_color: true,         // Secondary color (hex)
    text_color: true,              // Text color (hex)
    background_color: true,        // Form background (hex)
    font_family: true,             // Font family name
    border_radius: true,           // Border radius (px or rem)
    spacing: true,                 // Spacing density: 'compact' | 'normal' | 'relaxed'
    button_style: true,            // Button variant: 'filled' | 'outline' | 'rounded'
    input_style: true,             // Input variant: 'default' | 'underline' | 'filled'
  },
  
  // ─── Layout Options ──────────────────────────────────────────────────────
  form_width: true,                // Max width: 'narrow' | 'medium' | 'wide' | 'full'
  field_spacing: true,             // Gap between fields
  label_position: true,            // 'above' | 'inline' | 'floating'
  columns: true,                   // Number of columns (1-3)
} as const;

/**
 * Sanitize settings_json using strict allowlist.
 * Only explicitly allowed fields are returned to browser.
 * 
 * @param settings - Raw settings_json from database
 * @returns Sanitized settings safe for client
 */
function sanitizeSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return {};
  }

  const raw = settings as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Iterate through allowlist, not through raw data
  for (const [key, allowed] of Object.entries(SETTINGS_ALLOWLIST)) {
    if (!(key in raw)) continue;
    
    const value = raw[key];
    
    // Handle nested theme object with its own allowlist
    if (key === 'theme' && typeof allowed === 'object' && typeof value === 'object' && value !== null) {
      const themeRaw = value as Record<string, unknown>;
      const themeSanitized: Record<string, unknown> = {};
      
      for (const [themeKey, themeAllowed] of Object.entries(allowed)) {
        if (themeAllowed && themeKey in themeRaw) {
          themeSanitized[themeKey] = sanitizeValue(themeRaw[themeKey]);
        }
      }
      
      if (Object.keys(themeSanitized).length > 0) {
        sanitized.theme = themeSanitized;
      }
    } else if (allowed === true) {
      // Simple allowed field
      sanitized[key] = sanitizeValue(value);
    }
  }

  return sanitized;
}

/**
 * Sanitize individual values to prevent injection.
 * 
 * @param value - Raw value from database
 * @returns Sanitized value or null if invalid type
 */
function sanitizeValue(value: unknown): unknown {
  // Allow primitives
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value;
  
  // Strings: basic sanitization (no HTML tags in settings)
  if (typeof value === 'string') {
    // Limit length to prevent DoS
    const trimmed = value.slice(0, 2000);
    // For URLs, validate format
    if (trimmed.includes('://')) {
      try {
        const url = new URL(trimmed);
        // Only allow http/https
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return trimmed;
        }
        return null; // Invalid protocol
      } catch {
        // Not a valid URL, might be a color or other value
        return trimmed;
      }
    }
    return trimmed;
  }
  
  // Arrays of strings (for select options, etc.)
  if (Array.isArray(value)) {
    return value
      .filter(item => typeof item === 'string')
      .map(item => String(item).slice(0, 500))
      .slice(0, 100); // Max 100 items
  }
  
  // Disallow nested objects except theme (handled separately)
  return null;
}

/**
 * Sanitize compliance_json - only return fields needed by embed.js
 */
function sanitizeCompliance(compliance: unknown): Record<string, unknown> {
  if (!compliance || typeof compliance !== 'object' || Array.isArray(compliance)) {
    return {};
  }

  const raw = compliance as Record<string, unknown>;
  
  // Explicit allowlist for compliance fields
  return {
    email_consent_required: raw.email_consent_required === true,
    email_consent_text: typeof raw.email_consent_text === 'string' 
      ? raw.email_consent_text.slice(0, 1000) 
      : null,
    sms_consent_required: raw.sms_consent_required === true,
    sms_consent_text: typeof raw.sms_consent_text === 'string' 
      ? raw.sms_consent_text.slice(0, 1000) 
      : null,
    // Never expose internal compliance flags
    // gdpr_compliant, double_opt_in, etc. are backend-only
  };
}
