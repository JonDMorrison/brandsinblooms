import type { FormField } from "../../types/formBuilder";

const PUBLIC_FORM_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
} as const;

const TOP_LEVEL_META_KEYS = [
  "meta",
  "_meta",
  "page_url",
  "referrer",
  "source",
  "user_agent",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

export interface PublicFormLookupResult {
  embedKey: string;
  fields: FormField[];
  id: string;
  status: string;
}

export interface ForwardSubmissionParams {
  data: Record<string, unknown>;
  embedKey: string;
  headers: Record<string, string>;
  meta: Record<string, unknown>;
}

export interface PublicFormSubmissionDeps {
  forwardSubmission: (params: ForwardSubmissionParams) => Promise<Response>;
  lookupForm: (formId: string) => Promise<PublicFormLookupResult | null>;
}

interface NormalizedPublicSubmissionPayload {
  data: Record<string, unknown>;
  meta: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...PUBLIC_FORM_CORS_HEADERS,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

function normalizeFields(value: unknown): FormField[] {
  return Array.isArray(value) ? (value as FormField[]) : [];
}

function normalizeFieldMappingKey(mappingKey?: string): string | null {
  const trimmed = mappingKey?.trim();

  if (!trimmed || trimmed === "custom") {
    return null;
  }

  return trimmed;
}

function getFieldSubmissionKey(
  field: FormField,
  mappingKeyCounts: Map<string, number>,
): string {
  const mappingKey = normalizeFieldMappingKey(field.mapping_key);

  if (mappingKey && (mappingKeyCounts.get(mappingKey) ?? 0) === 1) {
    return mappingKey;
  }

  return field.id;
}

function getFieldMappingKeyCounts(fields: FormField[]): Map<string, number> {
  return fields.reduce<Map<string, number>>((counts, field) => {
    const mappingKey = normalizeFieldMappingKey(field.mapping_key);

    if (!mappingKey) {
      return counts;
    }

    counts.set(mappingKey, (counts.get(mappingKey) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
}

export function getClientIpFromRequest(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function getForwardHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = getClientIpFromRequest(request);
  const userAgent = request.headers.get("user-agent");

  if (forwardedFor) {
    headers["x-forwarded-for"] = forwardedFor;
  } else if (clientIp) {
    headers["x-forwarded-for"] = clientIp;
  }

  if (clientIp) {
    headers["x-real-ip"] = clientIp;
    headers["cf-connecting-ip"] = clientIp;
  }

  if (userAgent) {
    headers["user-agent"] = userAgent;
  }

  return headers;
}

function normalizeTopLevelMeta(
  candidate: Record<string, unknown>,
  request: Request,
): Record<string, unknown> {
  const explicitMeta =
    (isRecord(candidate.meta) ? candidate.meta : null) ||
    (isRecord(candidate._meta) ? candidate._meta : null) ||
    {};

  const referer = request.headers.get("referer") || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  return {
    ...explicitMeta,
    page_url:
      explicitMeta.page_url ?? candidate.page_url ?? referer ?? undefined,
    referrer: explicitMeta.referrer ?? candidate.referrer ?? undefined,
    source: explicitMeta.source ?? candidate.source ?? undefined,
    user_agent:
      explicitMeta.user_agent ?? candidate.user_agent ?? userAgent ?? undefined,
    utm_source: explicitMeta.utm_source ?? candidate.utm_source ?? undefined,
    utm_medium: explicitMeta.utm_medium ?? candidate.utm_medium ?? undefined,
    utm_campaign:
      explicitMeta.utm_campaign ?? candidate.utm_campaign ?? undefined,
  };
}

export function normalizePublicFormSubmissionPayload(
  body: unknown,
  request: Request,
): NormalizedPublicSubmissionPayload {
  if (!isRecord(body)) {
    throw new Error("Expected a JSON object body");
  }

  if (isRecord(body.data)) {
    return {
      data: body.data,
      meta: normalizeTopLevelMeta(body, request),
    };
  }

  const data = { ...body };
  TOP_LEVEL_META_KEYS.forEach((key) => {
    delete data[key];
  });

  return {
    data,
    meta: normalizeTopLevelMeta(body, request),
  };
}

function findFieldForValidationMessage(
  detail: string,
  fields: FormField[],
): FormField | null {
  const normalizedDetail = detail.toLowerCase();

  const directLabelMatch = fields.find((field) =>
    normalizedDetail.includes(field.label.toLowerCase()),
  );
  if (directLabelMatch) {
    return directLabelMatch;
  }

  if (normalizedDetail.includes("email consent")) {
    return fields.find((field) => field.type === "email_consent") ?? null;
  }

  if (normalizedDetail.includes("sms consent")) {
    return fields.find((field) => field.type === "sms_consent") ?? null;
  }

  if (normalizedDetail.includes("email is required")) {
    return (
      fields.find(
        (field) => field.type === "email" || field.mapping_key === "email",
      ) ?? null
    );
  }

  if (normalizedDetail.includes("phone")) {
    return (
      fields.find(
        (field) => field.type === "phone" || field.mapping_key === "phone",
      ) ?? null
    );
  }

  return null;
}

function mapValidationErrors(
  details: string[],
  fields: FormField[],
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  const mappingKeyCounts = getFieldMappingKeyCounts(fields);

  details.forEach((detail) => {
    const matchedField = findFieldForValidationMessage(detail, fields);
    if (!matchedField) {
      fieldErrors.form = detail;
      return;
    }

    fieldErrors[getFieldSubmissionKey(matchedField, mappingKeyCounts)] = detail;
  });

  return fieldErrors;
}

function normalizeSuccessPayload(body: Record<string, unknown>) {
  return {
    success: true,
    message:
      typeof body.message === "string"
        ? body.message
        : "Form submitted successfully",
    redirectUrl:
      typeof body.redirect_url === "string" || body.redirect_url === null
        ? body.redirect_url
        : null,
    customerId:
      typeof body.customer_id === "string" || body.customer_id === null
        ? body.customer_id
        : null,
    suppressed: body.suppressed === true,
  };
}

export async function handlePublicFormSubmission(
  request: Request,
  formId: string,
  deps: PublicFormSubmissionDeps,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: PUBLIC_FORM_CORS_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse(
      {
        success: false,
        error: "Method not allowed",
      },
      405,
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Invalid JSON body",
      },
      400,
    );
  }

  let normalizedPayload: NormalizedPublicSubmissionPayload;
  try {
    normalizedPayload = normalizePublicFormSubmissionPayload(rawBody, request);
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Expected a JSON object body",
      },
      400,
    );
  }

  let form: PublicFormLookupResult | null;
  try {
    form = await deps.lookupForm(formId);
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Unable to resolve this form",
      },
      500,
    );
  }

  if (!form || form.status !== "published") {
    return jsonResponse(
      {
        success: false,
        error: "Form not found",
      },
      404,
    );
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await deps.forwardSubmission({
      embedKey: form.embedKey,
      data: normalizedPayload.data,
      meta: normalizedPayload.meta,
      headers: getForwardHeaders(request),
    });
  } catch {
    return jsonResponse(
      {
        success: false,
        error: "Unable to reach the submission service",
      },
      502,
    );
  }

  let upstreamBody: Record<string, unknown> = {};
  try {
    upstreamBody = (await upstreamResponse.json()) as Record<string, unknown>;
  } catch {
    upstreamBody = {};
  }

  if (upstreamResponse.ok) {
    return jsonResponse(
      normalizeSuccessPayload(upstreamBody),
      upstreamResponse.status,
    );
  }

  if (upstreamResponse.status === 400) {
    const details = Array.isArray(upstreamBody.details)
      ? upstreamBody.details.filter(
          (detail): detail is string => typeof detail === "string",
        )
      : [];

    return jsonResponse(
      {
        success: false,
        error:
          typeof upstreamBody.error === "string"
            ? upstreamBody.error
            : "Validation failed",
        details,
        errors: mapValidationErrors(details, normalizeFields(form.fields)),
      },
      400,
    );
  }

  if (upstreamResponse.status === 404) {
    return jsonResponse(
      {
        success: false,
        error:
          typeof upstreamBody.error === "string"
            ? upstreamBody.error
            : "Form not found",
      },
      404,
    );
  }

  if (upstreamResponse.status === 429) {
    const retryAfter = upstreamResponse.headers.get("Retry-After") || undefined;

    return jsonResponse(
      {
        success: false,
        error:
          typeof upstreamBody.error === "string"
            ? upstreamBody.error
            : "Too many submissions",
        retryAfter: retryAfter ? Number(retryAfter) || retryAfter : undefined,
      },
      429,
      retryAfter ? { "Retry-After": retryAfter } : {},
    );
  }

  return jsonResponse(
    {
      success: false,
      error:
        typeof upstreamBody.error === "string"
          ? upstreamBody.error
          : "Internal server error",
    },
    upstreamResponse.status || 500,
  );
}
