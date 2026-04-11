import { createClient } from "npm:@supabase/supabase-js@2";
import {
  sanitizeFormSubmissionData,
  type FormFieldWithVisibility,
} from "../_shared/formVisibility.ts";
import {
  buildFormPermanentUploadPath,
  FORM_UPLOAD_BUCKET,
  getFileFieldAllowedMimeTypes,
  getFileFieldMaxFileSizeMb,
  getFileFieldMaxFiles,
  getFormFileUploadReferences,
  isFormFileUploadReference,
  isTemporaryFormUploadPath,
  matchesAcceptedFileType,
} from "../_shared/formFileUploads.ts";

// ─── CORS Headers (hardened for public embed access) ───────────────────────
// These headers are included in ALL responses (success, error, 404, 429, etc.)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
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

// ─── Types ─────────────────────────────────────────────────────────────────

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  mapping_key: string;
  field_key?: string;
  options?: string[];
  default_value?: string | boolean;
  visibility_rules?: Array<{
    field_id: string;
    operator: "equals" | "not_equals" | "contains" | "not_empty" | "is_empty";
    value?: string;
  }>;
  rules?: {
    min_length?: number;
    max_length?: number;
    pattern?: string;
    pattern_message?: string;
    max_files?: number;
    max_file_size_mb?: number;
    allowed_mime_types?: string[];
  };
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
}

interface FormAudience {
  assign_personas?: string[]; // Array of persona IDs to assign
  assign_tags?: string[]; // Array of crm_tags IDs, with legacy tag-name fallback
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
  data?: Record<string, unknown>;
  form_data?: Record<string, unknown>;
  meta?: SubmissionMeta;
  page_url?: string;
  referrer?: string;
  user_agent?: string;
}

interface NormalizedSubmissionPayload {
  embedKey: string;
  data: Record<string, unknown>;
  meta: SubmissionMeta;
  usedLegacyPayload: boolean;
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
  const salt = Deno.env.get("RATE_LIMIT_SALT");

  if (!salt) {
    // Log warning but don't expose any secrets
    console.warn(
      "[submit-form] RATE_LIMIT_SALT not configured - using fallback. Set this env var for better security.",
    );
    return "bloomsuite-form-rate-limit-v1";
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
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Extract client IP from request headers
 */
function getClientIP(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
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
  ipHash: string,
): Promise<{ allowed: boolean; reason?: string; count?: number }> {
  const now = new Date();

  // Calculate window boundaries
  const shortWindowStart = new Date(
    now.getTime() - RATE_LIMIT_SHORT_WINDOW_SECONDS * 1000,
  );
  const longWindowStart = new Date(
    now.getTime() - RATE_LIMIT_LONG_WINDOW_SECONDS * 1000,
  );

  // Current minute window (rounded to minute boundary)
  const currentWindowStart = new Date(
    Math.floor(now.getTime() / 60000) * 60000,
  );

  // Step 1: Atomic increment for current window using raw SQL via RPC
  // This uses ON CONFLICT DO UPDATE to atomically increment the counter
  const { data: upsertResult, error: upsertError } = await supabase.rpc(
    "upsert_rate_limit",
    {
      p_tenant_id: tenantId,
      p_form_id: formId,
      p_ip_hash: ipHash,
      p_window_start: currentWindowStart.toISOString(),
    },
  );

  if (upsertError) {
    // If RPC doesn't exist, fall back to direct upsert
    console.warn(
      "[submit-form] Rate limit RPC failed, using direct upsert:",
      upsertError.message,
    );

    // Fallback: Direct upsert (still atomic due to unique constraint)
    const { error: insertError } = await supabase
      .from("form_rate_limits")
      .upsert(
        {
          tenant_id: tenantId,
          form_id: formId,
          ip_hash: ipHash,
          window_start: currentWindowStart.toISOString(),
          count: 1,
        },
        {
          onConflict: "form_id,ip_hash,window_start",
          ignoreDuplicates: false,
        },
      );

    if (insertError && !insertError.message.includes("duplicate")) {
      console.error("[submit-form] Rate limit upsert error:", insertError);
    }
  }

  // Step 2: Count submissions in short window (last 60 seconds)
  const { data: shortWindowData } = await supabase
    .from("form_rate_limits")
    .select("count")
    .eq("form_id", formId)
    .eq("ip_hash", ipHash)
    .gte("window_start", shortWindowStart.toISOString());

  const shortWindowCount =
    shortWindowData?.reduce(
      (sum: number, r: { count: number }) => sum + r.count,
      0,
    ) || 0;

  if (shortWindowCount > RATE_LIMIT_SHORT_MAX) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${RATE_LIMIT_SHORT_MAX} submissions per minute`,
      count: shortWindowCount,
    };
  }

  // Step 3: Count submissions in long window (last 10 minutes)
  const { data: longWindowData } = await supabase
    .from("form_rate_limits")
    .select("count")
    .eq("form_id", formId)
    .eq("ip_hash", ipHash)
    .gte("window_start", longWindowStart.toISOString());

  const longWindowCount =
    longWindowData?.reduce(
      (sum: number, r: { count: number }) => sum + r.count,
      0,
    ) || 0;

  if (longWindowCount > RATE_LIMIT_LONG_MAX) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${RATE_LIMIT_LONG_MAX} submissions per 10 minutes`,
      count: longWindowCount,
    };
  }

  return { allowed: true, count: shortWindowCount };
}

/**
 * Check for honeypot spam (hidden fields that bots fill out)
 */
function checkHoneypot(data: Record<string, unknown>): boolean {
  // Common honeypot field names
  const honeypotFields = [
    "_honeypot",
    "honeypot",
    "_hp",
    "hp_field",
    "website",
    "url",
    "_blank",
  ];

  for (const field of honeypotFields) {
    const value = data[field];
    if (value !== undefined && value !== null && value !== "") {
      return true; // Spam detected
    }
  }

  return false;
}

function normalizeSubmissionPayload(
  payload: SubmissionPayload,
): NormalizedSubmissionPayload {
  const embedKey = payload.embed_key;

  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return {
      embedKey,
      data: payload.data,
      meta: payload.meta || {},
      usedLegacyPayload: false,
    };
  }

  if (
    payload.form_data &&
    typeof payload.form_data === "object" &&
    !Array.isArray(payload.form_data)
  ) {
    return {
      embedKey,
      data: payload.form_data,
      meta: {
        page_url: payload.page_url,
        referrer: payload.referrer,
        user_agent: payload.user_agent,
      },
      usedLegacyPayload: true,
    };
  }

  return {
    embedKey,
    data: {},
    meta: payload.meta || {},
    usedLegacyPayload: false,
  };
}

function getFieldValue(
  field: FormField,
  data: Record<string, unknown>,
  extraKeys: string[] = [],
): unknown {
  return getFieldValueMatch(field, data, extraKeys).value;
}

function getFieldValueMatch(
  field: FormField,
  data: Record<string, unknown>,
  extraKeys: string[] = [],
): { key?: string; value: unknown } {
  const candidateKeys = [
    field.mapping_key || undefined,
    field.id,
    field.field_key,
    ...extraKeys,
  ].filter(
    (key, index, allKeys): key is string =>
      Boolean(key) && allKeys.indexOf(key) === index,
  );

  for (const key of candidateKeys) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      return { key, value: data[key] };
    }
  }

  return { value: undefined };
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

/**
 * Validate required fields
 */
function validateRequiredFields(
  fields: FormField[],
  data: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const field of fields) {
    if (field.type === "hidden") {
      continue;
    }

    const value = getFieldValue(field, data);

    if (field.required) {
      const fileReferences =
        field.type === "file" ? getFormFileUploadReferences(value) : [];
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (typeof value === "string" && !value.trim()) ||
        (field.type === "checkbox" && value !== true) ||
        (field.type === "file" && fileReferences.length === 0);

      if (isEmpty) {
        errors.push(`${field.label} is required`);
      }
    }

    // Email format validation
    if (field.type === "email" && typeof value === "string" && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        errors.push(`${field.label} must be a valid email address`);
      }
    }

    // Phone format validation (basic)
    if (
      field.type === "phone" &&
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      const phone = String(value).replace(/\D/g, "");
      if (phone.length < 10) {
        errors.push(`${field.label} must be a valid phone number`);
      }
    }

    if (
      field.type !== "file" &&
      value !== undefined &&
      value !== null &&
      value !== "" &&
      typeof value !== "boolean"
    ) {
      const textValue = String(value);
      const minLength = field.rules?.min_length;
      const maxLength = field.rules?.max_length;
      const pattern = field.rules?.pattern;

      if (
        typeof minLength === "number" &&
        minLength > 0 &&
        textValue.length < minLength
      ) {
        errors.push(`${field.label} must be at least ${minLength} characters`);
      }

      if (
        typeof maxLength === "number" &&
        maxLength > 0 &&
        textValue.length > maxLength
      ) {
        errors.push(`${field.label} must be ${maxLength} characters or fewer`);
      }

      if (pattern) {
        try {
          const regex = new RegExp(pattern);
          if (!regex.test(textValue)) {
            errors.push(
              field.rules?.pattern_message ||
                `${field.label} must match the expected format`,
            );
          }
        } catch (error) {
          console.warn(
            `[submit-form] Ignoring invalid regex pattern for field ${field.id}`,
            error,
          );
        }
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
  data: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check field presence
  const hasEmailField = fields.some(
    (f) => f.type === "email" || f.mapping_key === "email",
  );
  const hasPhoneField = fields.some(
    (f) => f.type === "phone" || f.mapping_key === "phone",
  );

  // Email consent validation (CASL)
  if (hasEmailField && compliance.email_consent_required) {
    const emailConsentField = fields.find((f) => f.type === "email_consent");
    const consentValue = emailConsentField
      ? getFieldValue(emailConsentField, data, [
          "email_consent",
          "__email_consent",
        ])
      : (data.email_consent ?? data.__email_consent);

    if (!consentValue) {
      errors.push("Email consent is required");
    }
  }

  // SMS consent validation (TCPA) - must be separate from email
  if (hasPhoneField && compliance.sms_consent_required) {
    const smsConsentField = fields.find((f) => f.type === "sms_consent");
    const consentValue = smsConsentField
      ? getFieldValue(smsConsentField, data, ["sms_consent", "__sms_consent"])
      : (data.sms_consent ?? data.__sms_consent);

    if (!consentValue) {
      errors.push("SMS consent is required when providing a phone number");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Extract mapped values from form data based on field definitions
 */
function extractMappedValues(
  fields: FormField[],
  data: Record<string, unknown>,
): Record<string, string | undefined> {
  const mapped: Record<string, string | undefined> = {};

  for (const field of fields) {
    const value = getFieldValue(field, data);
    if (field.type === "file") {
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      const targetKey = field.mapping_key || field.id;

      if (targetKey !== "custom") {
        mapped[targetKey] = String(value);
      }
    }
  }

  return mapped;
}

/**
 * Stored result values:
 * - accepted: Submission processed successfully
 * - rejected_invalid: Validation or contract failure
 * - rejected_rate_limited: Rate limit exceeded
 * - rejected_spam: Spam detected
 *
 * rejection_type values (stored in metadata.rejection_type):
 * - invalid: Validation errors
 * - rate_limited: Rate limit exceeded
 * - spam: Spam detected
 */
type StoredSubmissionResult =
  | "accepted"
  | "rejected_invalid"
  | "rejected_rate_limited"
  | "rejected_spam";
type RejectionType = "invalid" | "rate_limited" | "spam";

/**
 * Record submission to form_submissions table
 */
async function recordSubmission(
  supabase: ReturnType<typeof createClient>,
  params: {
    submissionId?: string;
    tenantId: string;
    formId: string;
    customerId?: string;
    data: Record<string, unknown>;
    metadata: Record<string, unknown>;
    ipHash: string;
    result: StoredSubmissionResult;
    rejectionType?: RejectionType;
    reason?: string;
    throwOnError?: boolean;
  },
): Promise<string | null> {
  try {
    // Add rejection_type to metadata if present
    const fullMetadata = params.rejectionType
      ? { ...params.metadata, rejection_type: params.rejectionType }
      : params.metadata;

    const { data, error } = await supabase
      .from("form_submissions")
      .insert({
        id: params.submissionId,
        tenant_id: params.tenantId,
        form_id: params.formId,
        customer_id: params.customerId || null,
        data: params.data,
        metadata: fullMetadata,
        ip_hash: params.ipHash,
        result: params.result,
        reason: params.reason || null,
      })
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data?.id || params.submissionId || null;
  } catch (error) {
    console.error("[submit-form] Failed to record submission:", error);

    if (params.throwOnError) {
      throw error;
    }

    return null;
  }
}

function stripFileUploadReferencesFromData(
  data: Record<string, unknown>,
  fields?: FormField[],
): Record<string, unknown> {
  const nextData = { ...data };

  if (fields && fields.length > 0) {
    for (const field of fields) {
      if (field.type !== "file") {
        continue;
      }

      const matched = getFieldValueMatch(field, nextData);
      if (matched.key) {
        delete nextData[matched.key];
      }
    }

    return nextData;
  }

  for (const [key, value] of Object.entries(nextData)) {
    if (isFormFileUploadReference(value)) {
      delete nextData[key];
      continue;
    }

    if (Array.isArray(value)) {
      const references = getFormFileUploadReferences(value);
      if (value.length > 0 && references.length === value.length) {
        delete nextData[key];
      }
    }
  }

  return nextData;
}

async function finalizeUploadedFilesForSubmission(
  supabase: ReturnType<typeof createClient>,
  params: {
    embedKey: string;
    tenantId: string;
    formId: string;
    submissionId: string;
    fields: FormField[];
    data: Record<string, unknown>;
  },
): Promise<{
  valid: boolean;
  data: Record<string, unknown>;
  errors: string[];
}> {
  const nextData = { ...params.data };
  const errors: string[] = [];
  const copiedPaths: string[] = [];
  const tempPathsToDelete: string[] = [];

  for (const field of params.fields) {
    if (field.type !== "file") {
      continue;
    }

    const matched = getFieldValueMatch(field, nextData);
    const dataKey = matched.key || field.mapping_key || field.id;
    const rawValue = matched.value;

    if (rawValue === undefined) {
      continue;
    }

    if (!Array.isArray(rawValue)) {
      errors.push(`${field.label} contains an invalid upload payload`);
      continue;
    }

    const fileReferences = getFormFileUploadReferences(rawValue);
    if (fileReferences.length !== rawValue.length) {
      errors.push(`${field.label} contains an invalid upload reference`);
      continue;
    }

    if (fileReferences.length === 0) {
      nextData[dataKey] = [];
      continue;
    }

    const maxFiles = getFileFieldMaxFiles(field.rules);
    if (fileReferences.length > maxFiles) {
      errors.push(`${field.label} exceeds the maximum file count`);
      continue;
    }

    const maxFileSizeBytes =
      getFileFieldMaxFileSizeMb(field.rules) * 1024 * 1024;
    const allowedMimeTypes = getFileFieldAllowedMimeTypes(field.rules);
    const finalizedReferences = [];

    for (const fileReference of fileReferences) {
      if (fileReference.bucket !== FORM_UPLOAD_BUCKET) {
        errors.push(`${field.label} contains an invalid upload bucket`);
        break;
      }

      if (fileReference.field_id !== field.id) {
        errors.push(`${field.label} contains a mismatched upload reference`);
        break;
      }

      if (
        !isTemporaryFormUploadPath(
          fileReference.path,
          params.embedKey,
          field.id,
          fileReference.upload_id,
        )
      ) {
        errors.push(`${field.label} contains an invalid upload path`);
        break;
      }

      if (fileReference.file_size > maxFileSizeBytes) {
        errors.push(`${fileReference.file_name} exceeds the file size limit`);
        break;
      }

      if (
        !matchesAcceptedFileType(
          {
            file_name: fileReference.file_name,
            mime_type: fileReference.mime_type,
          },
          allowedMimeTypes,
        )
      ) {
        errors.push(`${fileReference.file_name} is not an allowed file type`);
        break;
      }

      const permanentPath = buildFormPermanentUploadPath(
        params.tenantId,
        params.formId,
        params.submissionId,
        field.id,
        fileReference.upload_id,
        fileReference.file_name,
      );

      const { error: copyError } = await supabase.storage
        .from(FORM_UPLOAD_BUCKET)
        .copy(fileReference.path, permanentPath);

      if (copyError) {
        console.error(
          "[submit-form] Failed to finalize file upload:",
          copyError.message,
        );
        errors.push(`Failed to finalize ${fileReference.file_name}`);
        break;
      }

      copiedPaths.push(permanentPath);
      tempPathsToDelete.push(fileReference.path);
      finalizedReferences.push({
        ...fileReference,
        bucket: FORM_UPLOAD_BUCKET,
        path: permanentPath,
        field_id: field.id,
      });
    }

    if (finalizedReferences.length === fileReferences.length) {
      nextData[dataKey] = finalizedReferences;
    }
  }

  if (errors.length > 0) {
    if (copiedPaths.length > 0) {
      const { error: cleanupError } = await supabase.storage
        .from(FORM_UPLOAD_BUCKET)
        .remove(copiedPaths);

      if (cleanupError) {
        console.warn(
          "[submit-form] Failed to roll back copied file uploads:",
          cleanupError.message,
        );
      }
    }

    return {
      valid: false,
      data: stripFileUploadReferencesFromData(nextData, params.fields),
      errors,
    };
  }

  if (tempPathsToDelete.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(FORM_UPLOAD_BUCKET)
      .remove(tempPathsToDelete);

    if (removeError) {
      console.warn(
        "[submit-form] Failed to delete temporary uploads:",
        removeError.message,
      );
    }
  }

  return {
    valid: true,
    data: nextData,
    errors: [],
  };
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const startTime = Date.now();

  // Variables needed for submission recording
  let tenantId: string | undefined;
  let formId: string | undefined;
  let ipHash: string | undefined;
  let submissionData: Record<string, unknown> = {};
  let submissionMeta: Record<string, unknown> = {};
  let activeFieldsForRecording: FormField[] = [];

  try {
    // Parse request body
    const payload: SubmissionPayload = await req.json();
    const normalizedPayload = normalizeSubmissionPayload(payload);
    const { embedKey, data, meta, usedLegacyPayload } = normalizedPayload;
    const rawSubmissionData = data;
    submissionData = rawSubmissionData;
    submissionMeta = {
      ...meta,
      user_agent: meta.user_agent || req.headers.get("user-agent") || undefined,
    };

    if (usedLegacyPayload) {
      console.warn(
        `[submit-form] Deprecated legacy form_data payload received for ${embedKey.slice(0, 8)}...`,
      );
    }

    // ─── Step 1: Validate embed_key and look up form ───────────────────────
    if (!embedKey || typeof embedKey !== "string") {
      return jsonResponse({ error: "embed_key is required" }, 400);
    }

    if (!/^[a-f0-9]{32}$/i.test(embedKey)) {
      return jsonResponse({ error: "Invalid embed_key format" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Look up form by embed_key - tenant_id ONLY from this record
    const { data: form, error: formError } = await supabase
      .from("forms")
      .select(
        "id, tenant_id, status, fields_json, settings_json, compliance_json, audience_json",
      )
      .eq("embed_key", embedKey.toLowerCase())
      .maybeSingle();

    if (formError) {
      console.error("[submit-form] Database error:", formError.message);
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    // Validate form exists and is published
    if (!form || form.status !== "published") {
      console.log(
        `[submit-form] Form not found or not published: ${embedKey.slice(0, 8)}...`,
      );
      return jsonResponse({ error: "Form not found" }, 404);
    }

    // Extract form data - tenant_id derived from form record ONLY
    formId = form.id;
    tenantId = form.tenant_id;
    const fields = (form.fields_json || []) as FormField[];
    const compliance = (form.compliance_json || {}) as FormCompliance;
    const settings = (form.settings_json || {}) as FormSettings;
    const audience = (form.audience_json || {}) as FormAudience;

    // Get client IP and hash it
    const clientIP = getClientIP(req);
    ipHash = await hashIP(clientIP);

    // ─── Step 2: DB-backed rate limiting ───────────────────────────────────
    const rateLimitResult = await checkRateLimit(
      supabase,
      tenantId,
      formId,
      ipHash,
    );

    if (!rateLimitResult.allowed) {
      console.log(`[submit-form] Rate limited: ${rateLimitResult.reason}`);

      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: stripFileUploadReferencesFromData(submissionData),
        metadata: submissionMeta,
        ipHash,
        result: "rejected_rate_limited",
        rejectionType: "rate_limited",
        reason: rateLimitResult.reason,
      });

      return jsonResponse({ error: rateLimitResult.reason }, 429, {
        "Retry-After": "60",
      });
    }

    // ─── Step 3: Honeypot spam check ───────────────────────────────────────
    if (checkHoneypot(rawSubmissionData)) {
      console.log(
        `[submit-form] Honeypot triggered for form: ${formId.slice(0, 8)}...`,
      );

      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: stripFileUploadReferencesFromData(submissionData),
        metadata: submissionMeta,
        ipHash,
        result: "rejected_spam",
        rejectionType: "spam",
        reason: "Spam detected (honeypot)",
      });

      // Return fake success to not tip off bots
      return jsonResponse(
        { success: true, message: "Thank you for your submission!" },
        200,
      );
    }

    const sanitizedSubmission = sanitizeFormSubmissionData(
      fields as FormFieldWithVisibility[],
      rawSubmissionData,
    );
    const activeFields = sanitizedSubmission.activeFields as FormField[];
    activeFieldsForRecording = activeFields;
    submissionData = sanitizedSubmission.sanitizedData;

    // ─── Step 4: Validate required fields ──────────────────────────────────
    const fieldValidation = validateRequiredFields(
      activeFields,
      submissionData,
    );
    if (!fieldValidation.valid) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: stripFileUploadReferencesFromData(submissionData, activeFields),
        metadata: submissionMeta,
        ipHash,
        result: "rejected_invalid",
        rejectionType: "invalid",
        reason: fieldValidation.errors.join("; "),
      });

      return jsonResponse(
        { error: "Validation failed", details: fieldValidation.errors },
        400,
      );
    }

    // ─── Step 5: Validate consent rules ────────────────────────────────────
    const consentValidation = validateConsentRules(
      activeFields,
      compliance,
      submissionData,
    );
    if (!consentValidation.valid) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: stripFileUploadReferencesFromData(submissionData, activeFields),
        metadata: submissionMeta,
        ipHash,
        result: "rejected_invalid",
        rejectionType: "invalid",
        reason: consentValidation.errors.join("; "),
      });

      return jsonResponse(
        { error: "Consent required", details: consentValidation.errors },
        400,
      );
    }

    // ─── Step 6: Extract and validate mapped values ────────────────────────
    const mappedValues = extractMappedValues(activeFields, submissionData);
    const email = mappedValues.email?.toLowerCase()?.trim();
    const phone = mappedValues.phone
      ? String(mappedValues.phone).replace(/\D/g, "")
      : undefined;
    const firstName = mappedValues.first_name?.trim();
    const lastName = mappedValues.last_name?.trim();

    if (!email) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        data: stripFileUploadReferencesFromData(submissionData, activeFields),
        metadata: submissionMeta,
        ipHash,
        result: "rejected_invalid",
        rejectionType: "invalid",
        reason: "Email is required",
      });

      return jsonResponse({ error: "Email is required" }, 400);
    }

    // ─── Step 6a: Determine consent values from form data ────────────────────
    const emailConsentField = activeFields.find(
      (f) => f.type === "email_consent",
    );
    const smsConsentField = activeFields.find((f) => f.type === "sms_consent");

    // Extract consent boolean values (explicitly check for true)
    const emailConsent = emailConsentField
      ? getFieldValue(emailConsentField, submissionData, [
          "email_consent",
          "__email_consent",
        ]) === true
      : (submissionData.email_consent ?? submissionData.__email_consent) ===
        true;
    const smsConsent = smsConsentField
      ? getFieldValue(smsConsentField, submissionData, [
          "sms_consent",
          "__sms_consent",
        ]) === true
      : (submissionData.sms_consent ?? submissionData.__sms_consent) === true;

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
      user_agent: meta?.user_agent || req.headers.get("user-agent") || null,

      // Form identification
      form_embed_key: embedKey,

      form_id: formId,
      consent_source: "form",

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
      .from("crm_customers")
      .select("id, suppressed, email_opt_in, sms_opt_in")
      .eq("tenant_id", tenantId)
      .eq("email", email)
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
        customerData.email_consent_source = "form";
      }
      // Always update consent details with latest submission (for audit trail)
      customerData.email_consent_details = {
        consent_text: compliance.email_consent_text,
        consent_required: compliance.email_consent_required,
        page_url: meta?.page_url || null,
        referrer: meta?.referrer || null,
        form_id: formId,
        form_embed_key: embedKey,
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
        customerData.sms_consent_source = "form";
      }
      // Always update consent details with latest submission (for audit trail)
      customerData.sms_consent_details = {
        consent_text: compliance.sms_consent_text,
        consent_required: compliance.sms_consent_required,
        phone: phone,
        page_url: meta?.page_url || null,
        referrer: meta?.referrer || null,
        form_id: formId,
        form_embed_key: embedKey,
        user_agent: meta?.user_agent || null,
        captured_at: now,
      };
    }
    // IMPORTANT: Do NOT set sms_opt_in=false here - that's only for unsubscribe endpoint

    // CRITICAL: NEVER set opt_out=true from form submission
    // opt_out is ONLY set by explicit unsubscribe actions (webhook, preference center, admin)

    // Upsert customer
    const { data: customer, error: customerError } = await supabase
      .from("crm_customers")
      .upsert(customerData, {
        onConflict: "tenant_id,email",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (customerError) {
      console.error(
        "[submit-form] Customer upsert error:",
        customerError.message,
      );
      throw customerError;
    }

    const customerId = customer.id;
    const acceptedSubmissionId = crypto.randomUUID();

    const finalizedFiles = await finalizeUploadedFilesForSubmission(supabase, {
      embedKey,
      tenantId,
      formId,
      submissionId: acceptedSubmissionId,
      fields: activeFields,
      data: submissionData,
    });

    if (!finalizedFiles.valid) {
      await recordSubmission(supabase, {
        tenantId,
        formId,
        customerId,
        data: finalizedFiles.data,
        metadata: fullMetadata,
        ipHash,
        result: "rejected_invalid",
        rejectionType: "invalid",
        reason: finalizedFiles.errors.join("; "),
      });

      return jsonResponse(
        { error: "Validation failed", details: finalizedFiles.errors },
        400,
      );
    }

    submissionData = finalizedFiles.data;

    // ─── Step 7: Record accepted submission ────────────────────────────────
    await recordSubmission(supabase, {
      submissionId: acceptedSubmissionId,
      tenantId,
      formId,
      customerId,
      data: submissionData,
      metadata: fullMetadata,
      ipHash,
      result: "accepted",
      throwOnError: true,
    });

    // ─── Step 8: Apply audience rules (personas) with safe error handling ───
    // Audience rules come from forms.audience_json, NOT settings_json
    // Supports both custom personas (persona_id) and predefined personas (predefined_persona_id)
    const personaIds = audience.assign_personas || [];
    const requestedTagIdentifiers = Array.from(
      new Set(
        (audience.assign_tags || [])
          .map((tagIdentifier) => tagIdentifier?.trim())
          .filter((tagIdentifier): tagIdentifier is string =>
            Boolean(tagIdentifier),
          ),
      ),
    );
    const debugInfo: Record<string, unknown> = {};
    let personasAssigned = 0;
    let personaErrors: string[] = [];
    let tagsAssigned = 0;
    let tagErrors: string[] = [];

    if (personaIds.length > 0) {
      try {
        // Validate personas exist and determine their type (custom vs predefined)
        const { data: validPersonas, error: personaValidationError } =
          await supabase
            .from("crm_personas")
            .select("id, is_custom")
            .in("id", personaIds)
            .or(`tenant_id.eq.${tenantId},is_custom.eq.false`);

        if (personaValidationError) {
          console.warn(
            "[submit-form] Persona validation error:",
            personaValidationError.message,
          );
          personaErrors.push(`validation_failed`);
          debugInfo.persona_validation_error = personaValidationError.code;
        } else {
          // Separate custom and predefined personas
          const customPersonas =
            validPersonas?.filter((p) => p.is_custom === true) || [];
          const predefinedPersonas =
            validPersonas?.filter((p) => p.is_custom === false) || [];

          const customPersonaIds = customPersonas.map((p) => p.id);
          const predefinedPersonaIds = predefinedPersonas.map((p) => p.id);

          const invalidCount = personaIds.filter(
            (id) =>
              ![...customPersonaIds, ...predefinedPersonaIds].includes(id),
          ).length;

          if (invalidCount > 0) {
            console.warn(
              `[submit-form] Invalid persona IDs ignored: ${invalidCount}`,
            );
            debugInfo.invalid_persona_count = invalidCount;
          }

          // ─── IDEMPOTENT INSERT: Check existing assignments for BOTH types ───
          // DB has partial unique indexes:
          // - unique_customer_custom_persona(customer_id, persona_id) WHERE persona_id IS NOT NULL
          // - unique_customer_predefined_persona(customer_id, predefined_persona_id) WHERE predefined_persona_id IS NOT NULL

          // Get all existing assignments for this customer
          const { data: existingAssignments } = await supabase
            .from("customer_personas")
            .select("persona_id, predefined_persona_id")
            .eq("customer_id", customerId);

          const existingCustomIds = new Set(
            existingAssignments
              ?.filter((a) => a.persona_id)
              ?.map((a) => a.persona_id) || [],
          );
          const existingPredefinedIds = new Set(
            existingAssignments
              ?.filter((a) => a.predefined_persona_id)
              ?.map((a) => a.predefined_persona_id) || [],
          );

          // Filter to only new assignments
          const newCustomPersonaIds = customPersonaIds.filter(
            (id) => !existingCustomIds.has(id),
          );
          const newPredefinedPersonaIds = predefinedPersonaIds.filter(
            (id) => !existingPredefinedIds.has(id),
          );

          const totalNew =
            newCustomPersonaIds.length + newPredefinedPersonaIds.length;

          if (totalNew > 0) {
            // Build insert records for both types
            const personaAssignments: Array<{
              customer_id: string;
              persona_id?: string;
              predefined_persona_id?: string;
            }> = [];

            // Custom personas use persona_id column
            for (const personaId of newCustomPersonaIds) {
              personaAssignments.push({
                customer_id: customerId,
                persona_id: personaId,
              });
            }

            // Predefined personas use predefined_persona_id column
            for (const personaId of newPredefinedPersonaIds) {
              personaAssignments.push({
                customer_id: customerId,
                predefined_persona_id: personaId,
              });
            }

            const { error: personaInsertError } = await supabase
              .from("customer_personas")
              .insert(personaAssignments);

            if (personaInsertError) {
              // Handle race condition: if duplicate key error, it's actually success
              if (personaInsertError.code === "23505") {
                // Unique violation = already assigned, treat as success
                personasAssigned =
                  customPersonaIds.length + predefinedPersonaIds.length;
                debugInfo.persona_race_condition = true;
              } else {
                console.warn(
                  "[submit-form] Persona insert error:",
                  personaInsertError.message,
                );
                personaErrors.push(`insert_failed`);
                debugInfo.persona_insert_error = personaInsertError.code;
              }
            } else {
              personasAssigned = totalNew;
              console.log(
                `[submit-form] Assigned ${personasAssigned} new personas (${newCustomPersonaIds.length} custom, ${newPredefinedPersonaIds.length} predefined) to customer ${customerId.slice(0, 8)}...`,
              );
            }
          } else {
            // All personas already assigned
            personasAssigned =
              customPersonaIds.length + predefinedPersonaIds.length;
            debugInfo.personas_already_assigned = true;
          }

          // Log breakdown for debugging
          debugInfo.custom_personas_requested = customPersonaIds.length;
          debugInfo.predefined_personas_requested = predefinedPersonaIds.length;
          debugInfo.custom_personas_new = newCustomPersonaIds.length;
          debugInfo.predefined_personas_new = newPredefinedPersonaIds.length;
        }
      } catch (personaError) {
        const errorMsg = (personaError as Error).message;
        console.warn(
          "[submit-form] Unexpected persona assignment error:",
          errorMsg,
        );
        personaErrors.push(`unexpected_error`);
        debugInfo.persona_unexpected_error = errorMsg.slice(0, 100); // Truncate, no PII
        // Non-fatal - submission is still accepted
      }
    }

    // ─── Step 9: Apply audience rules (tags) with safe error handling ───────
    if (requestedTagIdentifiers.length > 0) {
      try {
        const resolvedTags = new Map<string, { id: string; name: string }>();
        const matchedIdentifiers = new Set<string>();
        const requestedTagIds = requestedTagIdentifiers.filter(isUuidLike);
        let tagLookupFailed = false;

        if (requestedTagIds.length > 0) {
          const { data: tagsById, error: tagsByIdError } = await supabase
            .from("crm_tags")
            .select("id, name")
            .eq("tenant_id", tenantId)
            .in("id", requestedTagIds);

          if (tagsByIdError) {
            console.warn(
              "[submit-form] Tag ID lookup error:",
              tagsByIdError.message,
            );
            tagLookupFailed = true;
            debugInfo.tag_id_lookup_error = tagsByIdError.code;
          } else {
            for (const tag of tagsById || []) {
              resolvedTags.set(tag.id, tag);
              matchedIdentifiers.add(tag.id);
            }
          }
        }

        const { data: tagsByName, error: tagsByNameError } = await supabase
          .from("crm_tags")
          .select("id, name")
          .eq("tenant_id", tenantId)
          .in("name", requestedTagIdentifiers);

        if (tagsByNameError) {
          console.warn(
            "[submit-form] Tag name lookup error:",
            tagsByNameError.message,
          );
          tagLookupFailed = true;
          debugInfo.tag_name_lookup_error = tagsByNameError.code;
        } else {
          for (const tag of tagsByName || []) {
            resolvedTags.set(tag.id, tag);
            matchedIdentifiers.add(tag.name);
            matchedIdentifiers.add(tag.id);
          }
        }

        if (tagLookupFailed) {
          tagErrors.push("validation_failed");
        }

        const validTagIds = Array.from(resolvedTags.keys());
        const invalidTagCount = requestedTagIdentifiers.filter(
          (identifier) => !matchedIdentifiers.has(identifier),
        ).length;

        if (invalidTagCount > 0) {
          console.warn(
            `[submit-form] Invalid tag identifiers ignored: ${invalidTagCount}`,
          );
          debugInfo.invalid_tag_count = invalidTagCount;
        }

        if (validTagIds.length > 0) {
          const { data: existingTagAssignments, error: existingTagsError } =
            await supabase
              .from("customer_tags")
              .select("tag_id")
              .eq("contact_id", customerId)
              .in("tag_id", validTagIds);

          if (existingTagsError) {
            console.warn(
              "[submit-form] Existing tag lookup error:",
              existingTagsError.message,
            );
            tagErrors.push("lookup_failed");
            debugInfo.tag_existing_lookup_error = existingTagsError.code;
          } else {
            const existingTagIds = new Set(
              existingTagAssignments?.map((assignment) => assignment.tag_id) ||
                [],
            );
            const newTagIds = validTagIds.filter(
              (tagId) => !existingTagIds.has(tagId),
            );

            if (newTagIds.length > 0) {
              const { error: tagInsertError } = await supabase
                .from("customer_tags")
                .insert(
                  newTagIds.map((tagId) => ({
                    contact_id: customerId,
                    tag_id: tagId,
                  })),
                );

              if (tagInsertError) {
                if (tagInsertError.code === "23505") {
                  tagsAssigned = validTagIds.length;
                  debugInfo.tag_race_condition = true;
                } else {
                  console.warn(
                    "[submit-form] Tag assignment error:",
                    tagInsertError.message,
                  );
                  tagErrors.push("insert_failed");
                  debugInfo.tag_insert_error = tagInsertError.code;
                }
              } else {
                tagsAssigned = validTagIds.length;
                console.log(
                  `[submit-form] Assigned ${newTagIds.length} new tags to customer ${customerId.slice(0, 8)}...`,
                );
              }
            } else {
              tagsAssigned = validTagIds.length;
              debugInfo.tags_already_assigned = true;
            }

            debugInfo.valid_tag_count = validTagIds.length;
            debugInfo.new_tag_count = newTagIds.length;
          }
        }
      } catch (tagError) {
        const errorMsg = (tagError as Error).message;
        console.warn(
          "[submit-form] Unexpected tag assignment error:",
          errorMsg,
        );
        tagErrors.push("unexpected_error");
        debugInfo.tag_unexpected_error = errorMsg.slice(0, 100);
      }
    }

    // ─── Step 10: Trigger segment evaluation (BEST-EFFORT) ──────────────────
    // If this fails, submission still returns 200. Error is recorded for debugging.
    let segmentsJoined: string[] = [];
    let segmentsLeft: string[] = [];

    try {
      const segmentResponse = await fetch(
        `${supabaseUrl}/functions/v1/evaluate-customer-segments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            customer_id: customerId,
            tenant_id: tenantId,
          }),
        },
      );

      if (!segmentResponse.ok) {
        const errorText = await segmentResponse.text();
        console.warn("[submit-form] Segment evaluation failed:", errorText);
        debugInfo.segment_eval_status = segmentResponse.status;
        debugInfo.segment_eval_error = errorText.slice(0, 100); // Truncate, no PII
      } else {
        const segmentResult = await segmentResponse.json();
        segmentsJoined = segmentResult.segments_joined || [];
        segmentsLeft = segmentResult.segments_left || [];
        console.log(
          `[submit-form] Segment evaluation complete: joined=${segmentsJoined.length}, left=${segmentsLeft.length}`,
        );
      }
    } catch (segmentError) {
      const errorMsg = (segmentError as Error).message;
      console.warn(
        "[submit-form] Error triggering segment evaluation:",
        errorMsg,
      );
      debugInfo.segment_eval_exception = errorMsg.slice(0, 100); // Truncate, no PII
      // Non-fatal - submission is still accepted
    }

    // ─── Step 11: Update submission metadata with debug info ─────────────────
    // Record audience processing results for audit trail (no PII in debug)
    const hasAudienceActivity =
      personasAssigned > 0 ||
      personaErrors.length > 0 ||
      tagsAssigned > 0 ||
      tagErrors.length > 0 ||
      segmentsJoined.length > 0 ||
      segmentsLeft.length > 0 ||
      Object.keys(debugInfo).length > 0;

    if (hasAudienceActivity) {
      try {
        await supabase
          .from("form_submissions")
          .update({
            metadata: {
              ...fullMetadata,
              audience_processing: {
                personas_requested: personaIds.length,
                personas_assigned: personasAssigned,
                personas_errors:
                  personaErrors.length > 0 ? personaErrors : null,
                tags_requested: requestedTagIdentifiers.length,
                tags_assigned: tagsAssigned,
                tags_errors: tagErrors.length > 0 ? tagErrors : null,
                segments_joined:
                  segmentsJoined.length > 0 ? segmentsJoined : null,
                segments_left: segmentsLeft.length > 0 ? segmentsLeft : null,
                processed_at: new Date().toISOString(),
              },
              // Debug info: error codes only, no PII, no raw messages
              debug: Object.keys(debugInfo).length > 0 ? debugInfo : undefined,
            },
          })
          .eq("id", acceptedSubmissionId);
      } catch (updateError) {
        console.warn(
          "[submit-form] Failed to update submission with audience results:",
          updateError,
        );
        // Non-fatal
      }
    }

    // ─── Success Response ──────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log(
      `[submit-form] Accepted in ${duration}ms for customer ${customerId.slice(0, 8)}...${isSuppressed ? " (suppressed)" : ""}`,
    );

    return jsonResponse(
      {
        success: true,
        message: settings.success_message || "Thank you for your submission!",
        redirect_url: settings.success_redirect_url || null,
        customer_id: customerId,
        suppressed: isSuppressed, // Inform caller if sends will be blocked
      },
      200,
    );
  } catch (error) {
    console.error("[submit-form] Unexpected error:", (error as Error).message);

    // Try to record failed submission if we have enough context
    if (tenantId && formId && ipHash) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        await recordSubmission(supabase, {
          tenantId,
          formId,
          data: stripFileUploadReferencesFromData(
            submissionData,
            activeFieldsForRecording,
          ),
          metadata: submissionMeta,
          ipHash,
          result: "rejected_invalid",
          reason: `Internal error: ${(error as Error).message}`,
        });
      } catch {
        // Ignore recording errors
      }
    }

    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
