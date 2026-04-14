import { createClient } from "npm:@supabase/supabase-js@2";
import { sanitizeFileFieldRules } from "../_shared/formFileUploads.ts";

// ─── CORS Headers (hardened for public embed access) ───────────────────────
// These headers are included in ALL responses (success, error, 404, 429, etc.)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
  "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
} as const;

/**
 * Create a JSON response with CORS headers.
 * IMPORTANT: All responses MUST use this helper to ensure CORS headers are always included.
 */
function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

// ─── In-Memory Rate Limiting ───────────────────────────────────────────────
// Lightweight first-layer protection (per IP, resets on cold start)
const rateLimitStore = new Map<
  string,
  { count: number; windowStart: number }
>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute per IP

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
function validateEmbedKey(embedKey: string | null): {
  valid: boolean;
  error?: string;
} {
  if (!embedKey) {
    return { valid: false, error: "embed_key query parameter is required" };
  }

  // Must be exactly 32 lowercase hex characters
  if (typeof embedKey !== "string" || embedKey.length !== 32) {
    return { valid: false, error: "Invalid embed_key format" };
  }

  if (!/^[a-f0-9]{32}$/.test(embedKey.toLowerCase())) {
    return { valid: false, error: "Invalid embed_key format" };
  }

  return { valid: true };
}

function getClientIP(req: Request): string {
  // Check common headers for proxied requests
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP.trim();
  }

  // Fallback - use a hash of user-agent + some request info as pseudo-IP
  const ua = req.headers.get("user-agent") || "unknown";
  return `ua-${hashString(ua).toString(16)}`;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// ─── Main Handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Handle CORS preflight - must include all CORS headers
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Only allow GET requests
  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    // ─── Step 1: Rate Limiting ─────────────────────────────────────────────
    const clientIP = getClientIP(req);

    if (isRateLimited(clientIP)) {
      // Log rate limit hit without PII
      console.log(
        `[get-form-config] Rate limit exceeded for IP hash: ${hashString(clientIP).toString(16)}`,
      );
      return jsonResponse(
        { error: "Too many requests. Please try again later." },
        429,
        { "Retry-After": "60" },
      );
    }

    // ─── Step 2: Validate embed_key ────────────────────────────────────────
    const url = new URL(req.url);
    const embedKey = url.searchParams.get("embed_key");

    const validation = validateEmbedKey(embedKey);
    if (!validation.valid) {
      return jsonResponse({ error: validation.error }, 400);
    }

    // ─── Step 3: Fetch form from database ──────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Query form by embed_key - tenant_id derived from the form record only
    const { data: form, error } = await supabase
      .from("forms")
      .select("id, tenant_id, fields_json, settings_json, compliance_json")
      .eq("embed_key", embedKey!.toLowerCase())
      .maybeSingle();

    // ─── Step 4: Validate form exists and is published ─────────────────────
    if (error) {
      console.error("[get-form-config] Database error:", error.message);
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    if (!form) {
      // Log without exposing the embed_key (just first 8 chars for debugging)
      console.log(
        `[get-form-config] Form not found: ${embedKey!.slice(0, 8)}...`,
      );
      return jsonResponse({ error: "Form not found" }, 404);
    }

    // Check if form has a status field and validate it
    // Fetch status separately to ensure published check
    const { data: statusCheck, error: statusError } = await supabase
      .from("forms")
      .select("status")
      .eq("id", form.id)
      .single();

    if (statusError || !statusCheck || statusCheck.status !== "published") {
      console.log(
        `[get-form-config] Form not published: ${embedKey!.slice(0, 8)}...`,
      );
      return jsonResponse({ error: "Form not found" }, 404);
    }

    // ─── Step 5: Build response (SANITIZED - no secrets, no PII) ────────────
    // SECURITY: All output is filtered through explicit allowlists
    const responseData = {
      form_id: form.id,
      fields_json: sanitizeFields(form.fields_json),
      settings_json: sanitizeSettings(form.settings_json),
      compliance_json: sanitizeCompliance(form.compliance_json),
    };

    return jsonResponse(responseData, 200, {
      "Cache-Control": "public, max-age=60",
    });
  } catch (error) {
    console.error(
      "[get-form-config] Unexpected error:",
      (error as Error).message,
    );
    return jsonResponse({ error: "Internal server error" }, 500);
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
 * - Layout: form_width, label_position, columns
 *
 * NEVER include in allowlist:
 * - notification_emails (admin PII)
 * - webhook_url, webhook_secret (backend secrets)
 * - api_key, secret_key (any secrets)
 * - internal_notes, admin_only (internal config)
 * - assign_personas, assign_tags (backend-only audience configuration)
 */
const SETTINGS_ALLOWLIST = {
  // ─── UI/Display Fields ───────────────────────────────────────────────────
  success_message: true, // Message shown after successful submission
  submit_button_text: true, // Text on submit button
  show_branding: true, // Whether to show "Powered by BloomSuite"
  form_title: true, // Optional title above form
  form_description: true, // Optional description above form
  form_headline: true, // Headline displayed above form
  form_subheadline: true, // Subheadline displayed below headline

  // ─── Navigation ──────────────────────────────────────────────────────────
  success_redirect_url: true, // URL to redirect after success

  // ─── Theme Object ────────────────────────────────────────────────────────
  // Nested theme object is allowed with its own sub-allowlist
  theme: {
    primary_color: true, // Primary brand color (hex)
    secondary_color: true, // Secondary color (hex)
    text_color: true, // Text color (hex)
    background_color: true, // Form background (hex)
    font_family: true, // Font family name
    border_radius: true, // Border radius (px or rem)
    spacing: true, // Spacing density: 'compact' | 'normal' | 'relaxed'
    button_style: true, // Button variant: 'filled' | 'outline' | 'rounded'
    button_shape: true, // Button shape: 'rounded' | 'pill' | 'square'
    button_width: true, // Button width: 'full' | 'auto' | 'medium'
    input_style: true, // Input variant: 'default' | 'underline' | 'filled'
  },

  // ─── Layout Options ──────────────────────────────────────────────────────
  form_width: true, // Max width: 'narrow' | 'medium' | 'wide' | 'full'
  label_position: true, // Currently only 'above' is supported end-to-end
  columns: true, // Number of columns (1-2)
  steps: true, // Optional step metadata for multi-step forms
} as const;

/**
 * Sanitize settings_json using strict allowlist.
 * Only explicitly allowed fields are returned to browser.
 *
 * @param settings - Raw settings_json from database
 * @returns Sanitized settings safe for client
 */
function sanitizeSettings(settings: unknown): Record<string, unknown> {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  const raw = settings as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Iterate through allowlist, not through raw data
  for (const [key, allowed] of Object.entries(SETTINGS_ALLOWLIST)) {
    if (!(key in raw)) continue;

    const value = raw[key];

    // Handle nested theme object with its own allowlist
    if (
      key === "theme" &&
      typeof allowed === "object" &&
      typeof value === "object" &&
      value !== null
    ) {
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
    } else if (key === "columns") {
      const columns = sanitizeColumns(value);
      if (columns !== null) {
        sanitized.columns = columns;
      }
    } else if (key === "steps") {
      const steps = sanitizeSteps(value);
      if (steps.length > 0) {
        sanitized.steps = steps;
      }
    } else if (key === "label_position") {
      sanitized.label_position = sanitizeLabelPosition(value);
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
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;

  // Strings: basic sanitization (no HTML tags in settings)
  if (typeof value === "string") {
    // Limit length to prevent DoS
    const trimmed = value.slice(0, 2000);
    // For URLs, validate format
    if (trimmed.includes("://")) {
      try {
        const url = new URL(trimmed);
        // Only allow http/https
        if (url.protocol === "http:" || url.protocol === "https:") {
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
      .filter((item) => typeof item === "string")
      .map((item) => String(item).slice(0, 500))
      .slice(0, 100); // Max 100 items
  }

  // Disallow nested objects except theme (handled separately)
  return null;
}

function sanitizeColumns(value: unknown): number | null {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return Math.max(1, Math.min(2, Math.trunc(numericValue)));
}

function sanitizeSteps(
  value: unknown,
): Array<{ index: number; title: string; description: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((step, index) => {
      if (!step || typeof step !== "object" || Array.isArray(step)) {
        return null;
      }

      const rawStep = step as Record<string, unknown>;
      const rawIndex = rawStep.index;
      const nextIndex =
        typeof rawIndex === "number" && Number.isFinite(rawIndex)
          ? Math.max(0, Math.trunc(rawIndex))
          : index;

      return {
        index: nextIndex,
        title:
          typeof rawStep.title === "string" && rawStep.title.trim()
            ? rawStep.title.slice(0, 120)
            : `Step ${index + 1}`,
        description:
          typeof rawStep.description === "string"
            ? rawStep.description.slice(0, 280)
            : "",
      };
    })
    .filter(
      (step): step is { index: number; title: string; description: string } =>
        step !== null,
    )
    .map((step, index) => ({
      ...step,
      index,
      title: step.title.trim() || `Step ${index + 1}`,
    }));
}

function sanitizeLabelPosition(_value: unknown): "above" {
  // Inline and floating labels remain disabled until the public renderers support them end-to-end.
  return "above";
}

const PUBLIC_FIELD_TYPES = new Set([
  "email",
  "text",
  "phone",
  "select",
  "checkbox",
  "file",
  "hidden",
  "email_consent",
  "sms_consent",
]);

const VISIBILITY_OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "not_empty",
  "is_empty",
]);

function sanitizeFields(fields: unknown): Record<string, unknown>[] {
  if (!Array.isArray(fields)) {
    return [];
  }

  return fields
    .map((field, index) => sanitizeField(field, index))
    .filter((field): field is Record<string, unknown> => field !== null);
}

function sanitizeField(
  field: unknown,
  index: number,
): Record<string, unknown> | null {
  if (!field || typeof field !== "object" || Array.isArray(field)) {
    return null;
  }

  const raw = field as Record<string, unknown>;
  const type =
    typeof raw.type === "string" && PUBLIC_FIELD_TYPES.has(raw.type)
      ? raw.type
      : null;

  if (!type) {
    return null;
  }

  const sanitized: Record<string, unknown> = {
    id:
      typeof raw.id === "string" && raw.id.trim()
        ? raw.id.slice(0, 120)
        : `field_${index + 1}`,
    type,
    label:
      typeof raw.label === "string" && raw.label.trim()
        ? raw.label.slice(0, 240)
        : `Field ${index + 1}`,
    required: raw.required === true,
    mapping_key:
      typeof raw.mapping_key === "string" && raw.mapping_key.trim()
        ? raw.mapping_key.slice(0, 120)
        : typeof raw.id === "string" && raw.id.trim()
          ? raw.id.slice(0, 120)
          : `field_${index + 1}`,
  };

  if (typeof raw.placeholder === "string") {
    sanitized.placeholder = raw.placeholder.slice(0, 240);
  }

  if (Array.isArray(raw.options)) {
    const options = raw.options
      .filter((option): option is string => typeof option === "string")
      .map((option) => option.slice(0, 240))
      .slice(0, 100);

    if (options.length > 0) {
      sanitized.options = options;
    }
  }

  if (typeof raw.step_index === "number" && Number.isFinite(raw.step_index)) {
    sanitized.step_index = Math.max(0, Math.trunc(raw.step_index));
  }

  if (type === "checkbox") {
    sanitized.default_value = raw.default_value === true;
  } else if (
    type !== "file" &&
    typeof raw.default_value === "string" &&
    raw.default_value.length > 0
  ) {
    sanitized.default_value = raw.default_value.slice(0, 1000);
  }

  const visibilityRules = sanitizeVisibilityRules(raw.visibility_rules);
  if (visibilityRules.length > 0) {
    sanitized.visibility_rules = visibilityRules;
  }

  const rules = sanitizeFieldRules(type, raw.rules);
  if (rules) {
    sanitized.rules = rules;
  }

  return sanitized;
}

function sanitizeVisibilityRules(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((rule) => {
      if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        return null;
      }

      const rawRule = rule as Record<string, unknown>;
      const operator =
        typeof rawRule.operator === "string" &&
        VISIBILITY_OPERATORS.has(rawRule.operator)
          ? rawRule.operator
          : null;
      const fieldId =
        typeof rawRule.field_id === "string" && rawRule.field_id.trim()
          ? rawRule.field_id.slice(0, 120)
          : null;

      if (!operator || !fieldId) {
        return null;
      }

      return {
        field_id: fieldId,
        operator,
        ...(typeof rawRule.value === "string"
          ? { value: rawRule.value.slice(0, 240) }
          : {}),
      };
    })
    .filter((rule): rule is Record<string, unknown> => rule !== null)
    .slice(0, 20);
}

function sanitizeFieldRules(
  type: string,
  value: unknown,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return type === "file" ? sanitizeFileFieldRules(undefined) : null;
  }

  if (type === "file") {
    return sanitizeFileFieldRules(value);
  }

  if (type !== "text" && type !== "email" && type !== "phone") {
    return null;
  }

  const rawRules = value as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  if (
    typeof rawRules.min_length === "number" &&
    Number.isFinite(rawRules.min_length)
  ) {
    sanitized.min_length = Math.max(
      0,
      Math.min(5000, Math.trunc(rawRules.min_length)),
    );
  }

  if (
    typeof rawRules.max_length === "number" &&
    Number.isFinite(rawRules.max_length)
  ) {
    sanitized.max_length = Math.max(
      0,
      Math.min(5000, Math.trunc(rawRules.max_length)),
    );
  }

  if (typeof rawRules.pattern === "string" && rawRules.pattern.trim()) {
    sanitized.pattern = rawRules.pattern.slice(0, 400);
  }

  if (
    typeof rawRules.pattern_message === "string" &&
    rawRules.pattern_message.trim()
  ) {
    sanitized.pattern_message = rawRules.pattern_message.slice(0, 240);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Sanitize compliance_json - only return fields needed by embed.js
 */
function sanitizeCompliance(compliance: unknown): Record<string, unknown> {
  if (
    !compliance ||
    typeof compliance !== "object" ||
    Array.isArray(compliance)
  ) {
    return {};
  }

  const raw = compliance as Record<string, unknown>;

  // Explicit allowlist for compliance fields
  return {
    email_consent_required: raw.email_consent_required === true,
    email_consent_text:
      typeof raw.email_consent_text === "string"
        ? raw.email_consent_text.slice(0, 1000)
        : null,
    sms_consent_required: raw.sms_consent_required === true,
    sms_consent_text:
      typeof raw.sms_consent_text === "string"
        ? raw.sms_consent_text.slice(0, 1000)
        : null,
    // Never expose internal compliance flags
    // gdpr_compliant, double_opt_in, etc. are backend-only
  };
}
