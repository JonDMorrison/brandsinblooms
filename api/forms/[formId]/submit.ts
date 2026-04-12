import { createClient } from "@supabase/supabase-js";

import { SUPABASE_URL } from "../../../src/integrations/supabase/config";
import type { Database } from "../../../src/integrations/supabase/types";
import {
  handlePublicFormSubmission,
  type ForwardSubmissionParams,
  type PublicFormLookupResult,
} from "../../../src/lib/forms/publicSubmission";
import type { FormField } from "../../../src/types/formBuilder";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseUrl = process.env.SUPABASE_URL || SUPABASE_URL;
const submitFormUrl = `${supabaseUrl}/functions/v1/submit-form`;
const publicRouteHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Content-Type": "application/json",
} as const;

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: publicRouteHeaders,
  });
}

function getFormIdFromRequest(request: Request): string {
  const pathname = new URL(request.url).pathname;
  const segments = pathname.split("/").filter(Boolean);

  if (
    segments.length < 4 ||
    segments[0] !== "api" ||
    segments[1] !== "forms" ||
    segments[3] !== "submit"
  ) {
    return "";
  }

  return decodeURIComponent(segments[2] || "");
}

function getServiceClient() {
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function lookupPublishedForm(
  formId: string,
): Promise<PublicFormLookupResult | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("forms")
    .select("id, embed_key, status, fields_json")
    .eq("id", formId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id || !data.embed_key) {
    return null;
  }

  return {
    id: data.id,
    embedKey: data.embed_key,
    status: data.status || "draft",
    fields: Array.isArray(data.fields_json)
      ? (data.fields_json as FormField[])
      : [],
  };
}

async function forwardSubmission(
  params: ForwardSubmissionParams,
): Promise<Response> {
  return fetch(submitFormUrl, {
    method: "POST",
    headers: params.headers,
    body: JSON.stringify({
      embed_key: params.embedKey,
      data: params.data,
      meta: params.meta,
    }),
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (!serviceRoleKey) {
    return jsonResponse(
      {
        success: false,
        error: "Server configuration is incomplete",
      },
      500,
    );
  }

  const formId = getFormIdFromRequest(request);

  return handlePublicFormSubmission(request, formId, {
    lookupForm: lookupPublishedForm,
    forwardSubmission,
  });
}
