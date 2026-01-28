import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ─── Types ─────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  mapping_key: string;
  options?: string[];
}

interface FormCompliance {
  email_consent_required: boolean;
  email_consent_text: string;
  sms_consent_required: boolean;
  sms_consent_text: string;
}

interface FormSettings {
  success_message?: string;
  success_redirect_url?: string | null;
  assign_personas?: string[];
  assign_tags?: string[];
}

interface SubmissionMeta {
  page_url?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  user_agent?: string;
}

interface SubmissionPayload {
  embed_key: string;
  data: Record<string, unknown>;
  meta?: SubmissionMeta;
}

// ─── Rate Limit Configuration ──────────────────────────────────────────────
const RATE_LIMIT_SHORT_WINDOW_SECONDS = 60;
const RATE_LIMIT_SHORT_MAX = 5;
const RATE_LIMIT_LONG_WINDOW_SECONDS = 600; // 10 minutes
const RATE_LIMIT_LONG_MAX = 20;

// ─── Helper Functions ──────────────────────────────────────────────────────

/**
 * Get rate limit salt from environment
 * IMPORTANT: Do NOT use SUPABASE_SERVICE_ROLE_KEY as salt - use dedicated RATE_LIMIT_SALT
 */
function getRateLimitSalt(): string {
  const salt = Deno.env.get('RATE_LIMIT_SALT');
  
  if (!salt) {
    // Log warning but don't expose any secrets
    console.warn('[submit-form] RATE_LIMIT_SALT not configured - using fallback. Set this env var for better security.');
    return 'bloomsuite-form-rate-limit-v1';
  }
  
  return salt;
}

/**
 * Hash IP address for privacy (SHA-256 with dedicated salt)
 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = getRateLimitSalt();
  const data = encoder.encode(ip + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract client IP from request headers
 */
function getClientIP(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('cf-connecting-ip')
    || req.headers.get('x-real-ip')
    || 'unknown';
}

/**
 * Atomic rate limit check and increment using UPSERT
 * 
 * Why this fixes burst race conditions:
 * - Previous approach: SELECT → check count → UPDATE/INSERT (3 queries, race window)
 * - New approach: Single atomic UPSERT with ON CONFLICT DO UPDATE
 * - The unique constraint on (form_id, ip_hash, window_start) ensures exactly one row per minute window
 * - Postgres guarantees atomicity of the UPSERT, so concurrent requests serialize properly
 * - The RETURNING clause gives us the new count immediately for decision-making
 */
async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  formId: string,
  ipHash: string
): Promise<{ allowed: boolean; reason?: string; count?: number }> {
  const now = new Date();
  
  // Calculate window boundaries
  const shortWindowStart = new Date(now.getTime() - RATE_LIMIT_SHORT_WINDOW_SECONDS * 1000);
  const longWindowStart = new Date(now.getTime() - RATE_LIMIT_LONG_WINDOW_SECONDS * 1000);
  
  // Current minute window (rounded to minute boundary)
  const currentWindowStart = new Date(Math.floor(now.getTime() / 60000) * 60000);

  // Step 1: Atomic increment for current window using raw SQL via RPC
  // This uses ON CONFLICT DO UPDATE to atomically increment the counter
  const { data: upsertResult, error: upsertError } = await supabase.rpc(
    'upsert_rate_limit',
    {
      p_tenant_id: tenantId,
      p_form_id: formId,
      p_ip_hash: ipHash,
      p_window_start: currentWindowStart.toISOString()
    }
  );

  if (upsertError) {
    // If RPC doesn't exist, fall back to direct upsert
    console.warn('[submit-form] Rate limit RPC failed, using direct upsert:', upsertError.message);
    
    // Fallback: Direct upsert (still atomic due to unique constraint)
    const { error: insertError } = await supabase
      .from('form_rate_limits')
      .upsert(
        {
          tenant_id: tenantId,
          form_id: formId,
          ip_hash: ipHash,
          window_start: currentWindowStart.toISOString(),
          count: 1,
        },
        { 
          onConflict: 'form_id,ip_hash,window_start',
          ignoreDuplicates: false 
        }
      );

    if (insertError && !insertError.message.includes('duplicate')) {
      console.error('[submit-form] Rate limit upsert error:', insertError);
    }
  }

  // Step 2: Count submissions in short window (last 60 seconds)
  const { data: shortWindowData } = await supabase
    .from('form_rate_limits')
    .select('count')
    .eq('form_id', formId)
    .eq('ip_hash', ipHash)
    .gte('window_start', shortWindowStart.toISOString());

  const shortWindowCount = shortWindowData?.reduce((sum: number, r: { count: number }) => sum + r.count, 0) || 0;
  
  if (shortWindowCount > RATE_LIMIT_SHORT_MAX) {
    return { 
      allowed: false, 
      reason: `Rate limit exceeded: ${RATE_LIMIT_SHORT_MAX} submissions per minute`,
      count: shortWindowCount 
    };
  }

  // Step 3: Count submissions in long window (last 10 minutes)
  const { data: longWindowData } = await supabase
    .from('form_rate_limits')
    .select('count')
    .eq('form_id', formId)
    .eq('ip_hash', ipHash)
    .gte('window_start', longWindowStart.toISOString());

  const longWindowCount = longWindowData?.reduce((sum: number, r: { count: number }) => sum + r.count, 0) || 0;
  
  if (longWindowCount > RATE_LIMIT_LONG_MAX) {
    return { 
      allowed: false, 
      reason: `Rate limit exceeded: ${RATE_LIMIT_LONG_MAX} submissions per 10 minutes`,
      count: longWindowCount 
    };
  }

  return { allowed: true, count: shortWindowCount };
}

/**
 * Check for honeypot spam (hidden fields that bots fill out)
 */
function checkHoneypot(data: Record<string, unknown>): boolean {
  // Common honeypot field names
  const honeypotFields = ['_honeypot', 'honeypot', '_hp', 'website', 'url', '_blank'];
  
  for (const field of honeypotFields) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== '') {
      return true; // Spam detected
    }
  }
  
  return false;
}

/**
 * Validate required fields
 */
function validateRequiredFields(
  fields: FormField[],
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    if (field.required) {
      const value = data[field.id];
      if (value === undefined || value === null || value === '') {
        errors.push(`${field.label} is required`);
      }
    }

    // Email format validation
    if (field.type === 'email' && data[field.id]) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(data[field.id]))) {
        errors.push(`${field.label} must be a valid email address`);
      }
    }

    // Phone format validation (basic)
    if (field.type === 'phone' && data[field.id]) {
      const phone = String(data[field.id]).replace(/\D/g, '');
      if (phone.length < 10) {
        errors.push(`${field.label} must be a valid phone number`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate consent requirements (CASL/TCPA compliance)
 */
function validateConsentRules(
  fields: FormField[],
  compliance: FormCompliance,
  data: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check field presence
  const hasEmailField = fields.some(f => f.type === 'email' || f.mapping_key === 'email');
  const hasPhoneField = fields.some(f => f.type === 'phone' || f.mapping_key === 'phone');

  // Email consent validation (CASL)
  if (hasEmailField && compliance.email_consent_required) {
    const emailConsentField = fields.find(f => f.type === 'email_consent');
    const consentValue = emailConsentField ? data[emailConsentField.id] : data['email_consent'];
    
    if (!consentValue) {
      errors.push('Email consent is required');
    }
  }

  // SMS consent validation (TCPA) - must be separate from email
  if (hasPhoneField && compliance.sms_consent_required) {
    const smsConsentField = fields.find(f => f.type === 'sms_consent');
    const consentValue = smsConsentField ? data[smsConsentField.id] : data['sms_consent'];
    
    if (!consentValue) {
      errors.push('SMS consent is required when providing a phone number');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract mapped values from form data based on field definitions
 */
function extractMappedValues(
  fields: FormField[],
  data: Record<string, unknown>
): Record<string, string | undefined> {
  const mapped: Record<string, string | undefined> = {};

  for (const field of fields) {
    const value = data[field.id];
    if (value !== undefined && value !== null && value !== '') {
      if (field.mapping_key && field.mapping_key !== 'custom') {
        mapped[field.mapping_key] = String(value);
      }
    }
  }

  return mapped;
}

/**
 * Record submission to form_submissions table
 */
async function recordSubmission(
  supabase: ReturnType<typeof createClient>,
  params: {
    tenantId: string;
    formId: string;
    customerId?: string;
    data: Record<string, unknown>;
    metadata: Record<string, unknown>;
    ipHash: string;
    result: 'accepted' | 'rejected_invalid' | 'rejected_rate_limited' | 'rejected_spam';
    reason?: string;
  }
): Promise<void> {
  try {
    await supabase.from('form_submissions').insert({
      tenant_id: params.tenantId,
      form_id: params.formId,
      customer_id: params.customerId || null,
      data: params.data,
      metadata: params.metadata,
      ip_hash: params.ipHash,
      result: params.result,
      reason: params.reason || null,
    });
  } catch (error) {
    console.error('[submit-form] Failed to record submission:', error);
  }
}

// ─── Main Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const startTime = Date.now();
  
  // Variables needed for submission recording
  let tenantId: string | undefined;
  let formId: string | undefined;
  let ipHash: string | undefined;
  let submissionData: Record<string, unknown> = {};
  let submissionMeta: Record<string, unknown> = {};

  try {
    // Parse request body
    const payload: SubmissionPayload = await req.json();
    const { embed_key, data, meta } = payload;
    submissionData = data || {};
    submissionMeta = { ...meta, user_agent: req.headers.get('user-agent') };

    // ─── Step 1: Validate embed_key and look up form ───────────────────────
    if (!embed_key || typeof embed_key !== 'string') {
      return new Response(
        JSON.stringify({ error: 'embed_key is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/^[a-f0-9]{32}$/i.test(embed_key)) {
      return new Response(
        JSON.stringify({ error: 'Invalid embed_key format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up form by embed_key - tenant_id ONLY from this record
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, tenant_id, status, fields_json, settings_json, compliance_json')
      .eq('embed_key', embed_key.toLowerCase())
      .maybeSingle();

    if (formError) {
      console.error('[submit-form] Database error:', formError.message);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate form exists and is published
    if (!form || form.status !== 'published') {
      console.log(`[submit-form] Form not found or not published: ${embed_key.slice(0, 8)}...`);
      return new Response(
        JSON.stringify({ error: 'Form not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract form data - tenant_id derived from form record ONLY
    formId = form.id;
    tenantId = form.tenant_id;
    const fields = (form.fields_json || []) as FormField[];
    const compliance = (form.compliance_json || {}) as FormCompliance;
    const settings = (form.settings_json || {}) as FormSettings;

    // Get client IP and hash it
    const clientIP = getClientIP(req);
    ipHash = await hashIP(clientIP);

    // ─── Step 2: DB-backed rate limiting ───────────────────────────────────
    const rateLimitResult = await checkRateLimit(supabase, tenantId, formId, ipHash);
    
    if (!rateLimitResult.allowed) {
      console.log(`[submit-form] Rate limited: ${rateLimitResult.reason}`);
      
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: submissionData,
        metadata: submissionMeta,
        ipHash,
        result: 'rejected_rate_limited',
        reason: rateLimitResult.reason,
      });

      return new Response(
        JSON.stringify({ error: rateLimitResult.reason }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
      );
    }

    // ─── Step 3: Honeypot spam check ───────────────────────────────────────
    if (checkHoneypot(submissionData)) {
      console.log(`[submit-form] Honeypot triggered for form: ${formId.slice(0, 8)}...`);
      
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: submissionData,
        metadata: submissionMeta,
        ipHash,
        result: 'rejected_spam',
        reason: 'Spam detected (honeypot)',
      });

      // Return fake success to not tip off bots
      return new Response(
        JSON.stringify({ success: true, message: 'Thank you for your submission!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 4: Validate required fields ──────────────────────────────────
    const fieldValidation = validateRequiredFields(fields, submissionData);
    if (!fieldValidation.valid) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: submissionData,
        metadata: submissionMeta,
        ipHash,
        result: 'rejected_invalid',
        reason: fieldValidation.errors.join('; '),
      });

      return new Response(
        JSON.stringify({ error: 'Validation failed', details: fieldValidation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 5: Validate consent rules ────────────────────────────────────
    const consentValidation = validateConsentRules(fields, compliance, submissionData);
    if (!consentValidation.valid) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: submissionData,
        metadata: submissionMeta,
        ipHash,
        result: 'rejected_invalid',
        reason: consentValidation.errors.join('; '),
      });

      return new Response(
        JSON.stringify({ error: 'Consent required', details: consentValidation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 6: Extract and validate mapped values ────────────────────────
    const mappedValues = extractMappedValues(fields, submissionData);
    const email = mappedValues.email?.toLowerCase()?.trim();
    const phone = mappedValues.phone ? String(mappedValues.phone).replace(/\D/g, '') : undefined;
    const firstName = mappedValues.first_name?.trim();
    const lastName = mappedValues.last_name?.trim();

    if (!email) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: submissionData,
        metadata: submissionMeta,
        ipHash,
        result: 'rejected_invalid',
        reason: 'Email is required',
      });

      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ─── Step 6a: Determine consent values from form data ────────────────────
    const emailConsentField = fields.find(f => f.type === 'email_consent');
    const smsConsentField = fields.find(f => f.type === 'sms_consent');
    
    // Extract consent boolean values (explicitly check for true)
    const emailConsent = emailConsentField 
      ? submissionData[emailConsentField.id] === true 
      : submissionData['email_consent'] === true;
    const smsConsent = smsConsentField 
      ? submissionData[smsConsentField.id] === true 
      : submissionData['sms_consent'] === true;
    
    const now = new Date().toISOString();

    // ─── Step 6b: Build comprehensive metadata for audit trail ─────────────────
    // CASL/TCPA Compliance: ALWAYS store consent state, text, and timestamp
    // regardless of whether consent was granted or not
    const fullMetadata: Record<string, unknown> = {
      // Page & tracking context (ALWAYS captured)
      page_url: meta?.page_url || null,
      referrer: meta?.referrer || null,
      utm_source: meta?.utm_source || null,
      utm_medium: meta?.utm_medium || null,
      utm_campaign: meta?.utm_campaign || null,
      user_agent: meta?.user_agent || req.headers.get('user-agent') || null,
      
      // Form identification
      form_embed_key: embed_key,
      form_id: formId,
      consent_source: 'form',
      
      // Email consent (ALWAYS store - even if false)
      email_consent: emailConsent,
      email_consent_text: compliance.email_consent_text || null,
      email_consent_at: emailConsent ? now : null,
      email_consent_required: compliance.email_consent_required || false,
      
      // SMS consent (ALWAYS store - even if false)
      sms_consent: smsConsent,
      sms_consent_text: compliance.sms_consent_text || null,
      sms_consent_at: smsConsent ? now : null,
      sms_consent_required: compliance.sms_consent_required || false,
      
      // Submission timestamp
      submitted_at: now,
    };

    // ─── Step 6: Upsert customer (never overwrite opt-in to false) ─────────
    // First check existing customer state
    const { data: existingCustomer } = await supabase
      .from('crm_customers')
      .select('id, suppressed, email_opt_in, sms_opt_in')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle();

    const isSuppressed = existingCustomer?.suppressed === true;

    // Build customer data - ONLY set opt-in to true, never to false
    const customerData: Record<string, unknown> = {
      tenant_id: tenantId,
      email: email,
      updated_at: now,
    };

    // Set names only if provided (don't overwrite with empty)
    if (firstName) customerData.first_name = firstName;
    if (lastName) customerData.last_name = lastName;
    if (phone) customerData.phone = phone;

    // ─── CRITICAL: CASL/TCPA Compliant Opt-In Logic ───────────────────────────
    // 
    // Rules:
    // 1. ONLY set email_opt_in=true when explicit consent is granted
    // 2. NEVER set email_opt_in=false from a form submission (that would be an unsubscribe)
    // 3. NEVER touch opt_out field - that's only for explicit unsubscribe actions
    // 4. Store verbatim consent text for legal defensibility
    // 
    // This ensures:
    // - Existing subscribers are not accidentally unsubscribed
    // - Consent is only "upgraded", never "downgraded"
    // - Full audit trail is maintained in email_consent_details

    // Email opt-in: ONLY upgrade to true, NEVER downgrade or set false
    if (emailConsent === true) {
      // Only update if not already opted in (preserve original opt-in date if already true)
      if (existingCustomer?.email_opt_in !== true) {
        customerData.email_opt_in = true;
        customerData.email_opt_in_at = now;
        customerData.email_consent_source = 'form';
      }
      // Always update consent details with latest submission (for audit trail)
      customerData.email_consent_details = {
        consent_text: compliance.email_consent_text,
        consent_required: compliance.email_consent_required,
        page_url: meta?.page_url || null,
        referrer: meta?.referrer || null,
        form_id: formId,
        form_embed_key: embed_key,
        user_agent: meta?.user_agent || null,
        captured_at: now,
      };
    }
    // IMPORTANT: Do NOT set email_opt_in=false here - that's only for unsubscribe endpoint

    // SMS opt-in: ONLY upgrade to true, NEVER downgrade or set false
    if (smsConsent === true && phone) {
      // Only update if not already opted in (preserve original opt-in date if already true)
      if (existingCustomer?.sms_opt_in !== true) {
        customerData.sms_opt_in = true;
        customerData.sms_opt_in_at = now;
        customerData.sms_consent_source = 'form';
      }
      // Always update consent details with latest submission (for audit trail)
      customerData.sms_consent_details = {
        consent_text: compliance.sms_consent_text,
        consent_required: compliance.sms_consent_required,
        phone: phone,
        page_url: meta?.page_url || null,
        referrer: meta?.referrer || null,
        form_id: formId,
        form_embed_key: embed_key,
        user_agent: meta?.user_agent || null,
        captured_at: now,
      };
    }
    // IMPORTANT: Do NOT set sms_opt_in=false here - that's only for unsubscribe endpoint

    // CRITICAL: NEVER set opt_out=true from form submission
    // opt_out is ONLY set by explicit unsubscribe actions (webhook, preference center, admin)

    // Upsert customer
    const { data: customer, error: customerError } = await supabase
      .from('crm_customers')
      .upsert(customerData, {
        onConflict: 'tenant_id,email',
        ignoreDuplicates: false,
      })
      .select('id')
      .single();

    if (customerError) {
      console.error('[submit-form] Customer upsert error:', customerError.message);
      throw customerError;
    }

    const customerId = customer.id;

    // ─── Step 7: Record accepted submission ────────────────────────────────
    await recordSubmission(supabase, {
      tenantId,
      formId,
      customerId,
      data: submissionData,
      metadata: fullMetadata,
      ipHash,
      result: 'accepted',
    });

    // ─── Step 8: Assign personas ───────────────────────────────────────────
    const personaIds = settings.assign_personas || [];
    
    if (personaIds.length > 0) {
      try {
        // Insert persona assignments (ignore conflicts)
        for (const personaId of personaIds) {
          await supabase
            .from('customer_personas')
            .upsert({
              customer_id: customerId,
              persona_id: personaId,
              tenant_id: tenantId,
            }, {
              onConflict: 'customer_id,persona_id',
              ignoreDuplicates: true,
            });
        }
        console.log(`[submit-form] Assigned ${personaIds.length} personas to customer ${customerId.slice(0, 8)}...`);
      } catch (personaError) {
        console.warn('[submit-form] Persona assignment error:', personaError);
        // Non-fatal
      }
    }

    // ─── Step 9: Trigger segment evaluation ────────────────────────────────
    try {
      const segmentResponse = await fetch(
        `${supabaseUrl}/functions/v1/evaluate-customer-segments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            customer_id: customerId,
            tenant_id: tenantId,
          }),
        }
      );

      if (!segmentResponse.ok) {
        const errorText = await segmentResponse.text();
        console.warn('[submit-form] Segment evaluation failed:', errorText);
      } else {
        const segmentResult = await segmentResponse.json();
        console.log(`[submit-form] Segment evaluation complete: joined=${segmentResult.segments_joined?.length || 0}, left=${segmentResult.segments_left?.length || 0}`);
      }
    } catch (segmentError) {
      console.warn('[submit-form] Error triggering segment evaluation:', segmentError);
      // Non-fatal
    }

    // ─── Success Response ──────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log(`[submit-form] Accepted in ${duration}ms for customer ${customerId.slice(0, 8)}...${isSuppressed ? ' (suppressed)' : ''}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: settings.success_message || 'Thank you for your submission!',
        redirect_url: settings.success_redirect_url || null,
        customer_id: customerId,
        suppressed: isSuppressed, // Inform caller if sends will be blocked
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-form] Unexpected error:', (error as Error).message);
    
    // Try to record failed submission if we have enough context
    if (tenantId && formId && ipHash) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await recordSubmission(supabase, {
          tenantId,
          formId,
          data: submissionData,
          metadata: submissionMeta,
          ipHash,
          result: 'rejected_invalid',
          reason: `Internal error: ${(error as Error).message}`,
        });
      } catch {
        // Ignore recording errors
      }
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
