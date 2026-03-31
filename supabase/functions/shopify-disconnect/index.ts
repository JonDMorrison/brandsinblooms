import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";
import {
  assertEncryptionKeyConfigured,
  decryptToken,
} from "../_shared/crypto/tokens.ts";

try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error("[shopify-disconnect] FATAL:", error.message);
}

type ShopifyConnectionRecord = {
  id: string;
  tenant_id: string;
  user_id: string;
  shop_domain: string;
  encrypted_access_token: string | null;
  webhook_subscription_ids: unknown;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function normalizeWebhookIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.map((entry) => String(entry ?? "").trim()).filter(Boolean);
}

function getWebhookBaseUrl(shopDomain: string) {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify-webhook-handler/${shopDomain}`;
}

async function resolveTenantId(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve tenant: ${error.message}`);
  }

  return data?.tenant_id ?? null;
}

async function deleteRemoteShopifyWebhooks(
  connection: ShopifyConnectionRecord,
) {
  if (!connection.encrypted_access_token) {
    return { deletedWebhookCount: 0, warning: null as string | null };
  }

  try {
    const accessToken = await decryptToken(connection.encrypted_access_token);
    const webhookUrl = getWebhookBaseUrl(connection.shop_domain);
    const webhookBaseUrl = webhookUrl.split("/").slice(0, -1).join("/");
    const headers = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    };

    const listResponse = await fetch(
      `https://${connection.shop_domain}/admin/api/2024-01/webhooks.json`,
      { headers },
    );

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      throw new Error(
        `Webhook list failed: ${listResponse.status} ${errorText}`,
      );
    }

    const payload = (await listResponse.json()) as {
      webhooks?: Array<{ id: number; address: string }>;
    };
    const storedIds = new Set(
      normalizeWebhookIds(connection.webhook_subscription_ids),
    );
    const targets = (payload.webhooks ?? []).filter((webhook) => {
      const webhookId = String(webhook.id);
      return (
        storedIds.has(webhookId) ||
        webhook.address === webhookUrl ||
        webhook.address.startsWith(webhookBaseUrl)
      );
    });

    await Promise.all(
      targets.map(async (webhook) => {
        const deleteResponse = await fetch(
          `https://${connection.shop_domain}/admin/api/2024-01/webhooks/${webhook.id}.json`,
          {
            method: "DELETE",
            headers,
          },
        );

        if (!deleteResponse.ok && deleteResponse.status !== 404) {
          const errorText = await deleteResponse.text();
          throw new Error(
            `Webhook delete failed for ${webhook.id}: ${deleteResponse.status} ${errorText}`,
          );
        }
      }),
    );

    return {
      deletedWebhookCount: targets.length,
      warning: null as string | null,
    };
  } catch (error: any) {
    console.error("[shopify-disconnect] Remote webhook cleanup failed:", error);
    return {
      deletedWebhookCount: 0,
      warning: error.message ?? "Remote webhook cleanup failed.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(
        { error: true, message: "Authentication required" },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAuthed = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthed.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: true, message: "Invalid session" }, 401);
    }

    const tenantId = await resolveTenantId(supabaseAdmin, user.id);
    if (!tenantId) {
      return jsonResponse(
        { error: true, message: "No tenant found for user." },
        400,
      );
    }

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("shopify_connections")
      .select(
        "id, tenant_id, user_id, shop_domain, encrypted_access_token, webhook_subscription_ids",
      )
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .in("status", ["connected", "revoked"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<ShopifyConnectionRecord>();

    if (connectionError) {
      throw new Error(
        `Failed to load Shopify connection: ${connectionError.message}`,
      );
    }

    if (!connection) {
      return jsonResponse(
        { error: true, message: "Shopify connection not found." },
        404,
      );
    }

    const { deletedWebhookCount, warning } =
      await deleteRemoteShopifyWebhooks(connection);

    const { error: updateError } = await supabaseAdmin
      .from("shopify_connections")
      .update({
        status: "revoked",
        encrypted_access_token: null,
        encrypted_refresh_token: null,
        webhooks_subscribed: false,
        webhook_subscription_ids: null,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_last_error: warning,
        webhook_retry_count: 0,
        webhook_next_retry_at: null,
      })
      .eq("id", connection.id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      throw new Error(`Failed to disconnect Shopify: ${updateError.message}`);
    }

    return jsonResponse({
      success: true,
      deletedWebhookCount,
      warning,
      message: warning
        ? `Shopify disconnected with cleanup warning: ${warning}`
        : "Shopify disconnected successfully",
    });
  } catch (error: any) {
    console.error("[shopify-disconnect] Error:", error);
    return jsonResponse(
      {
        error: true,
        message: error.message ?? "Shopify disconnect failed.",
      },
      500,
    );
  }
});
