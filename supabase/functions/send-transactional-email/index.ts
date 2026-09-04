import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  reply_to?: string;
  tags?: unknown[];
  headers?: Record<string, string>;
}

interface ResendApiResult {
  id?: string;
  data?: { id?: string };
  error?: { message?: string; name?: string };
  message?: string;
  name?: string;
}

/**
 * Transactional email sender for automation outbox.
 * Returns Resend message ID (external_id) for tracking.
 * Logs full HTTP response for debugging.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: E1 - Add JWT authentication to prevent unauthenticated access
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authorization required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey,
  );
  if (token !== serviceRoleKey) {
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // This low-level sender accepts arbitrary recipients and sender fields.
    // Tenant campaign sends use their governed workers; the only browser
    // caller here is the platform-admin outreach tool.
    const { data: isMasterAdmin, error: roleError } = await supabaseClient.rpc(
      "is_master_admin",
      { _user_id: user.id },
    );
    if (roleError || !isMasterAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      to,
      subject,
      html_content,
      from_name,
      from_email,
      reply_to: explicit_reply_to,
      tags,
      unsubscribe_url,
      idempotency_key,
    } = body;
    // Reply-to: prefer explicit value, fallback to sender email
    const reply_to = explicit_reply_to || from_email;

    // Validate required fields
    if (!to || !html_content) {
      console.error("❌ Missing required fields: to or html_content");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: to and html_content are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const hasApiKey = !!resendApiKey;
    console.log(`📧 [TransactionalEmail] API key present: ${hasApiKey}`);

    if (!resendApiKey) {
      console.error("❌ RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Email service not configured",
          skipable: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Build from address
    const fromAddress = from_name
      ? `${from_name} <${from_email || "hello@notify.bloomsuite.app"}>`
      : from_email || "hello@notify.bloomsuite.app";

    console.log(
      `📧 [TransactionalEmail] Sending to: ${to}, from: ${fromAddress}, subject: ${subject?.substring(0, 50)}...`,
    );

    // Send email via Resend
    const emailPayload: ResendEmailPayload = {
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject: subject || "Message from automation",
      html: html_content,
    };

    if (reply_to) {
      emailPayload.reply_to = reply_to;
    }

    if (tags && Array.isArray(tags)) {
      emailPayload.tags = tags;
    }

    if (typeof unsubscribe_url === "string") {
      const expectedBase = `${Deno.env.get("SUPABASE_URL") || ""}/functions/v1/handle-unsubscribe`;
      const parsedUrl = new URL(unsubscribe_url);
      if (`${parsedUrl.origin}${parsedUrl.pathname}` === expectedBase) {
        emailPayload.headers = {
          "List-Unsubscribe": `<${unsubscribe_url}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        };
      }
    }

    const normalizedIdempotencyKey =
      typeof idempotency_key === "string" ? idempotency_key.trim() : "";
    if (normalizedIdempotencyKey.length > 256) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Idempotency key must not exceed 256 characters",
          canRetry: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Call the API directly so the provider idempotency header is guaranteed
    // even when the bundled SDK version changes. A stable outbox key makes a
    // retry safe when the provider accepted the message but our database
    // acknowledgement failed.
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
        ...(normalizedIdempotencyKey
          ? { "Idempotency-Key": normalizedIdempotencyKey }
          : {}),
      },
      body: JSON.stringify(emailPayload),
    });
    const response = (await resendResponse
      .json()
      .catch(() => ({}))) as ResendApiResult;
    const duration = Date.now() - startTime;

    // Log full response for debugging
    console.log(
      `📧 [TransactionalEmail] Resend response (${duration}ms):`,
      JSON.stringify(response),
    );

    // Check for errors
    if (!resendResponse.ok || response.error) {
      const providerError = response.error || response;
      const canRetry =
        resendResponse.status === 429 || resendResponse.status >= 500;
      console.error(
        `❌ [TransactionalEmail] Resend error:`,
        JSON.stringify(providerError),
      );
      return new Response(
        JSON.stringify({
          success: false,
          error: providerError.message || "Email send failed",
          error_name: providerError.name,
          provider_status: resendResponse.status,
          canRetry,
          duration_ms: duration,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Success - return the Resend message ID
    const messageId = response.data?.id || response.id;
    console.log(
      `✅ [TransactionalEmail] Sent successfully. Message ID: ${messageId}`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        external_id: messageId,
        duration_ms: duration,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error(
      `❌ [TransactionalEmail] Exception (${duration}ms):`,
      errorMessage,
      errorStack,
    );

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        duration_ms: duration,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
