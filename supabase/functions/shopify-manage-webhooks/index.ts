import { createClient } from "npm:@supabase/supabase-js@2";

import { ensureShopifyWebhooks } from "../_shared/webhooks/ensureShopifyWebhooks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: userRow, error: userRowError } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userRowError || !userRow?.tenant_id) {
      throw new Error("No tenant found for user");
    }

    const { data: connection, error: connectionError } = await supabaseClient
      .from("shopify_connections")
      .select("*")
      .eq("tenant_id", userRow.tenant_id)
      .eq("status", "connected")
      .order("connected_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (connectionError || !connection) {
      throw new Error("No connected Shopify store found");
    }

    const body = await req.json().catch(() => ({}));
    const action = body?.action || "status";

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    if (action === "verify" || action === "retry" || action === "subscribe") {
      const result = await ensureShopifyWebhooks(serviceClient, connection.id);

      return new Response(
        JSON.stringify({
          success: result.success,
          action: result.action,
          verified: result.verified,
          subscription_ids: result.subscription_ids,
          error: result.error,
          topics: result.topics,
          message: result.verified
            ? "Shopify webhooks verified and active."
            : result.error || "Shopify webhook verification is pending.",
        }),
        {
          status: result.success ? 200 : 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        action: "status",
        connection_id: connection.id,
        shop_domain: connection.shop_domain,
        webhooks: {
          subscribed: connection.webhooks_subscribed || false,
          subscription_ids: connection.webhook_subscription_ids || [],
          last_checked_at: connection.webhooks_last_checked_at,
          last_error: connection.webhook_last_error,
          last_webhook_received_at: connection.last_webhook_received_at,
          retry_count: connection.webhook_retry_count || 0,
          next_retry_at: connection.webhook_next_retry_at,
        },
        message: connection.webhooks_subscribed
          ? "Shopify webhooks are active."
          : connection.webhook_last_error
            ? `Issue detected: ${connection.webhook_last_error}`
            : "Shopify webhooks are not configured.",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error: any) {
    console.error("[Shopify Webhook] Manage webhooks error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
});
