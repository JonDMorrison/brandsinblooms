import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  data: Record<string, any>;
  meta?: SubmissionMeta;
  honeypot?: string; // Hidden field for spam detection
}

// Rate limit configuration
const RATE_LIMIT_SHORT_WINDOW_SECONDS = 60;
const RATE_LIMIT_SHORT_MAX = 5;
const RATE_LIMIT_LONG_WINDOW_SECONDS = 600; // 10 minutes
const RATE_LIMIT_LONG_MAX = 20;

/**
 * Hash IP address for privacy
 */
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check rate limits using database-backed table
 */
async function checkRateLimit(
  supabase: any,
  tenantId: string,
  formId: string,
  ipHash: string
): Promise<{ allowed: boolean; reason?: string }> {
  const now = new Date();
  
  // Check short window (60 seconds)
  const shortWindowStart = new Date(now.getTime() - RATE_LIMIT_SHORT_WINDOW_SECONDS * 1000);
  
  const { data: shortWindowData } = await supabase
    .from('form_rate_limits')
    .select('count')
    .eq('form_id', formId)
    .eq('ip_hash', ipHash)
    .gte('window_start', shortWindowStart.toISOString());

  const shortWindowCount = shortWindowData?.reduce((sum: number, r: any) => sum + r.count, 0) || 0;
  
  if (shortWindowCount >= RATE_LIMIT_SHORT_MAX) {
    return { allowed: false, reason: `Rate limit exceeded: ${RATE_LIMIT_SHORT_MAX} submissions per minute` };
  }

  // Check long window (10 minutes)
  const longWindowStart = new Date(now.getTime() - RATE_LIMIT_LONG_WINDOW_SECONDS * 1000);
  
  const { data: longWindowData } = await supabase
    .from('form_rate_limits')
    .select('count')
    .eq('form_id', formId)
    .eq('ip_hash', ipHash)
    .gte('window_start', longWindowStart.toISOString());

  const longWindowCount = longWindowData?.reduce((sum: number, r: any) => sum + r.count, 0) || 0;
  
  if (longWindowCount >= RATE_LIMIT_LONG_MAX) {
    return { allowed: false, reason: `Rate limit exceeded: ${RATE_LIMIT_LONG_MAX} submissions per 10 minutes` };
  }

  // Record this submission attempt
  const windowStart = new Date(Math.floor(now.getTime() / 60000) * 60000); // Round to minute
  
  // Try to update existing record first
  const { data: existing } = await supabase
    .from('form_rate_limits')
    .select('id, count')
    .eq('form_id', formId)
    .eq('ip_hash', ipHash)
    .eq('window_start', windowStart.toISOString())
    .single();

  if (existing) {
    await supabase
      .from('form_rate_limits')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('form_rate_limits')
      .insert({
        tenant_id: tenantId,
        form_id: formId,
        ip_hash: ipHash,
        window_start: windowStart.toISOString(),
        count: 1,
      });
  }

  return { allowed: true };
}

/**
 * Validate required fields
 */
function validateFields(
  fields: FormField[],
  data: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    if (field.required) {
      const value = data[field.id];
      if (value === undefined || value === null || value === '') {
        errors.push(`${field.label} is required`);
      }
    }

    // Email validation
    if (field.type === 'email' && data[field.id]) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(String(data[field.id]))) {
        errors.push(`${field.label} must be a valid email address`);
      }
    }

    // Phone validation (basic)
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
 * Validate consent requirements
 */
function validateConsent(
  fields: FormField[],
  compliance: FormCompliance,
  data: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if email field exists
  const hasEmailField = fields.some(f => f.type === 'email' || f.mapping_key === 'email');
  const hasPhoneField = fields.some(f => f.type === 'phone' || f.mapping_key === 'phone');

  // Email consent validation
  if (hasEmailField && compliance.email_consent_required) {
    const emailConsentField = fields.find(f => f.type === 'email_consent');
    if (emailConsentField) {
      if (!data[emailConsentField.id]) {
        errors.push('Email consent is required');
      }
    } else {
      // No explicit consent field but consent is required
      errors.push('Email consent is required');
    }
  }

  // SMS consent validation (TCPA requirement)
  if (hasPhoneField && compliance.sms_consent_required) {
    const smsConsentField = fields.find(f => f.type === 'sms_consent');
    if (smsConsentField) {
      if (!data[smsConsentField.id]) {
        errors.push('SMS consent is required when providing a phone number');
      }
    } else {
      errors.push('SMS consent is required when providing a phone number');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract mapped values from form data
 */
function extractMappedValues(
  fields: FormField[],
  data: Record<string, any>
): Record<string, any> {
  const mapped: Record<string, any> = {};

  for (const field of fields) {
    const value = data[field.id];
    if (value !== undefined && value !== null && value !== '') {
      if (field.mapping_key && field.mapping_key !== 'custom') {
        mapped[field.mapping_key] = value;
      }
    }
  }

  return mapped;
}

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

  try {
    const payload: SubmissionPayload = await req.json();
    const { embed_key, data, meta, honeypot } = payload;

    // Validate embed_key
    if (!embed_key || !/^[a-f0-9]{32}$/i.test(embed_key)) {
      return new Response(
        JSON.stringify({ error: 'Invalid embed_key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Honeypot check (spam detection)
    if (honeypot) {
      console.log(`[submit-form] Honeypot triggered for embed_key: ${embed_key}`);
      // Silently accept but don't process
      return new Response(
        JSON.stringify({ success: true, message: 'Thank you for your submission!' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Look up form by embed_key, confirm published
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('id, tenant_id, fields_json, settings_json, compliance_json')
      .eq('embed_key', embed_key)
      .eq('status', 'published')
      .single();

    if (formError || !form) {
      console.log(`[submit-form] Form not found for embed_key: ${embed_key}`);
      return new Response(
        JSON.stringify({ error: 'Form not found or not published' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formId = form.id;
    const tenantId = form.tenant_id;
    const fields = form.fields_json as FormField[];
    const compliance = form.compliance_json as FormCompliance;
    const settings = form.settings_json as any;

    // Step 2: Rate limit using DB-backed table
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
                  || req.headers.get('cf-connecting-ip') 
                  || 'unknown';
    const ipHash = await hashIP(clientIP);

    const rateLimitResult = await checkRateLimit(supabase, tenantId, formId, ipHash);
    
    if (!rateLimitResult.allowed) {
      console.log(`[submit-form] Rate limited: ${rateLimitResult.reason}`);
      
      // Record rejected submission
      await supabase.from('form_submissions').insert({
        tenant_id: tenantId,
        form_id: formId,
        data: data,
        metadata: { ...meta, user_agent: req.headers.get('user-agent') },
        ip_hash: ipHash,
        result: 'rejected_rate_limited',
        reason: rateLimitResult.reason,
      });

      return new Response(
        JSON.stringify({ error: rateLimitResult.reason }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Validate required fields
    const fieldValidation = validateFields(fields, data);
    if (!fieldValidation.valid) {
      await supabase.from('form_submissions').insert({
        tenant_id: tenantId,
        form_id: formId,
        data: data,
        metadata: { ...meta, user_agent: req.headers.get('user-agent') },
        ip_hash: ipHash,
        result: 'rejected_invalid',
        reason: fieldValidation.errors.join(', '),
      });

      return new Response(
        JSON.stringify({ error: 'Validation failed', details: fieldValidation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Consent validation
    const consentValidation = validateConsent(fields, compliance, data);
    if (!consentValidation.valid) {
      await supabase.from('form_submissions').insert({
        tenant_id: tenantId,
        form_id: formId,
        data: data,
        metadata: { ...meta, user_agent: req.headers.get('user-agent') },
        ip_hash: ipHash,
        result: 'rejected_invalid',
        reason: consentValidation.errors.join(', '),
      });

      return new Response(
        JSON.stringify({ error: 'Consent required', details: consentValidation.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Extract mapped values
    const mappedValues = extractMappedValues(fields, data);
    const email = mappedValues.email?.toLowerCase()?.trim();
    const phone = mappedValues.phone ? String(mappedValues.phone).replace(/\D/g, '') : null;
    const firstName = mappedValues.first_name?.trim();
    const lastName = mappedValues.last_name?.trim();

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Check consent field values
    const emailConsentField = fields.find(f => f.type === 'email_consent');
    const smsConsentField = fields.find(f => f.type === 'sms_consent');
    const emailConsent = emailConsentField ? !!data[emailConsentField.id] : false;
    const smsConsent = smsConsentField ? !!data[smsConsentField.id] : false;
    const now = new Date().toISOString();

    // Build metadata for submission
    const submissionMetadata = {
      page_url: meta?.page_url,
      referrer: meta?.referrer,
      utm_source: meta?.utm_source,
      utm_medium: meta?.utm_medium,
      utm_campaign: meta?.utm_campaign,
      user_agent: req.headers.get('user-agent'),
      email_consent: emailConsent,
      email_consent_text: emailConsent ? compliance.email_consent_text : null,
      email_consent_at: emailConsent ? now : null,
      sms_consent: smsConsent,
      sms_consent_text: smsConsent ? compliance.sms_consent_text : null,
      sms_consent_at: smsConsent ? now : null,
      consent_source: 'form',
      form_embed_key: embed_key,
    };

    // Step 7: Check if customer is suppressed (don't block, just note)
    const { data: existingCustomer } = await supabase
      .from('crm_customers')
      .select('id, suppressed, email_opt_in, sms_opt_in')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .single();

    const isSuppressed = existingCustomer?.suppressed === true;

    // Step 8: Upsert customer
    const customerData: Record<string, any> = {
      tenant_id: tenantId,
      email: email,
      updated_at: now,
    };

    // Only set names if provided
    if (firstName) customerData.first_name = firstName;
    if (lastName) customerData.last_name = lastName;
    if (phone) customerData.phone = phone;

    // Only update opt-in if consent was given (never downgrade)
    if (emailConsent && !existingCustomer?.email_opt_in) {
      customerData.email_opt_in = true;
      customerData.email_opt_in_at = now;
      customerData.email_consent_source = 'form';
      customerData.email_consent_details = {
        consent_text: compliance.email_consent_text,
        page_url: meta?.page_url,
        form_id: formId,
        form_embed_key: embed_key,
        captured_at: now,
      };
    }

    if (smsConsent && phone && !existingCustomer?.sms_opt_in) {
      customerData.sms_opt_in = true;
      customerData.sms_opt_in_at = now;
      customerData.sms_consent_source = 'form';
      customerData.sms_consent_details = {
        consent_text: compliance.sms_consent_text,
        page_url: meta?.page_url,
        form_id: formId,
        form_embed_key: embed_key,
        captured_at: now,
      };
    }

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
      console.error('[submit-form] Customer upsert error:', customerError);
      throw customerError;
    }

    const customerId = customer.id;

    // Step 9: Insert form submission record
    const { error: submissionError } = await supabase.from('form_submissions').insert({
      tenant_id: tenantId,
      form_id: formId,
      customer_id: customerId,
      data: data,
      metadata: submissionMetadata,
      ip_hash: ipHash,
      result: 'accepted',
    });

    if (submissionError) {
      console.error('[submit-form] Submission insert error:', submissionError);
    }

    // Step 10: Persona assignment (if any configured in form settings)
    // This would need to be added to form settings - for now we skip
    // TODO: Add audience.assign_personas to form model and process here

    // Step 11: Trigger segment evaluation
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
        console.warn('[submit-form] Segment evaluation failed:', await segmentResponse.text());
      } else {
        console.log('[submit-form] Segment evaluation triggered successfully');
      }
    } catch (segmentError) {
      console.warn('[submit-form] Error triggering segment evaluation:', segmentError);
      // Non-fatal - don't fail the submission
    }

    const duration = Date.now() - startTime;
    console.log(`[submit-form] Submission accepted in ${duration}ms for customer ${customerId}${isSuppressed ? ' (suppressed)' : ''}`);

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: settings.success_message || 'Thank you for your submission!',
        redirect_url: settings.success_redirect_url || null,
        customer_id: customerId,
        suppressed: isSuppressed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-form] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
