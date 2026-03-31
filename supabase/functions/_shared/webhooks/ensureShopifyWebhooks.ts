import { decryptToken } from "../crypto/tokens.ts";

const REQUIRED_TOPICS = [
  "customers/create",
  "customers/update",
  "orders/create",
  "orders/updated",
  "orders/paid",
  "orders/fulfilled",
  "orders/cancelled",
  "refunds/create",
  "products/create",
  "products/update",
  "app/uninstalled",
] as const;

export interface EnsureShopifyWebhooksResult {
  success: boolean;
  verified: boolean;
  subscription_ids: string[];
  error: string | null;
  action: "created" | "updated" | "verified" | "failed";
  topics?: string[];
}

type ShopifyWebhookRecord = {
  id: number;
  address: string;
  topic: string;
};

function getShopifyWebhookUrl(shopDomain: string) {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/shopify-webhook-handler/${shopDomain}`;
}

function getRetryDelayMinutes(retryCount: number) {
  const retryDelays = [5, 15, 45, 120, 360, 1440];
  return retryDelays[
    Math.min(Math.max(retryCount - 1, 0), retryDelays.length - 1)
  ];
}

async function updateConnectionError(
  supabase: any,
  connectionId: string,
  error: string,
) {
  try {
    const { data: connection } = await supabase
      .from("shopify_connections")
      .select("webhook_retry_count")
      .eq("id", connectionId)
      .single();

    const retryCount = (connection?.webhook_retry_count || 0) + 1;
    const nextRetryMinutes = getRetryDelayMinutes(retryCount);

    await supabase
      .from("shopify_connections")
      .update({
        webhooks_subscribed: false,
        webhook_last_error: error,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_retry_count: retryCount,
        webhook_next_retry_at: new Date(
          Date.now() + nextRetryMinutes * 60 * 1000,
        ).toISOString(),
      })
      .eq("id", connectionId);
  } catch (updateError) {
    console.error(
      "[SHOPIFY-ENSURE-WEBHOOKS] Failed to persist webhook error:",
      updateError,
    );
  }
}

export async function ensureShopifyWebhooks(
  supabase: any,
  connectionId: string,
): Promise<EnsureShopifyWebhooksResult> {
  try {
    const { data: connection, error: connectionError } = await supabase
      .from("shopify_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connectionError || !connection) {
      return {
        success: false,
        verified: false,
        subscription_ids: [],
        error: "Connection not found",
        action: "failed",
      };
    }

    if (
      !connection.shop_domain ||
      !connection.encrypted_access_token ||
      connection.encrypted_access_token === "pending"
    ) {
      return {
        success: false,
        verified: false,
        subscription_ids: [],
        error: "Shopify OAuth has not completed yet",
        action: "failed",
      };
    }

    const accessToken = await decryptToken(connection.encrypted_access_token);
    const webhookUrl = getShopifyWebhookUrl(connection.shop_domain);
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
      await updateConnectionError(
        supabase,
        connectionId,
        `Shopify webhook list failed: ${listResponse.status} ${errorText}`,
      );
      return {
        success: false,
        verified: false,
        subscription_ids: [],
        error: `Shopify webhook list failed: ${listResponse.status}`,
        action: "failed",
      };
    }

    const listData = (await listResponse.json()) as {
      webhooks?: ShopifyWebhookRecord[];
    };
    const existingWebhooks = listData.webhooks ?? [];
    const existingByTopic = new Map(
      existingWebhooks
        .filter(
          (webhook) =>
            webhook.address === webhookUrl ||
            webhook.address.startsWith(webhookBaseUrl),
        )
        .map((webhook) => [webhook.topic, webhook]),
    );

    const subscriptionIds = new Set<string>();
    let action: "created" | "updated" | "verified" = "verified";

    for (const topic of REQUIRED_TOPICS) {
      const existing = existingByTopic.get(topic);

      if (existing) {
        subscriptionIds.add(String(existing.id));
        continue;
      }

      const createResponse = await fetch(
        `https://${connection.shop_domain}/admin/api/2024-01/webhooks.json`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            webhook: {
              topic,
              address: webhookUrl,
              format: "json",
            },
          }),
        },
      );

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        await updateConnectionError(
          supabase,
          connectionId,
          `Shopify webhook create failed for ${topic}: ${createResponse.status} ${errorText}`,
        );
        return {
          success: false,
          verified: false,
          subscription_ids: Array.from(subscriptionIds),
          error: `Shopify webhook create failed for ${topic}`,
          action: "failed",
        };
      }

      const createData = (await createResponse.json()) as {
        webhook?: ShopifyWebhookRecord;
      };

      if (createData.webhook?.id) {
        subscriptionIds.add(String(createData.webhook.id));
        action = "created";
      }
    }

    const verifyResponse = await fetch(
      `https://${connection.shop_domain}/admin/api/2024-01/webhooks.json`,
      { headers },
    );

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      await updateConnectionError(
        supabase,
        connectionId,
        `Shopify webhook verification failed: ${verifyResponse.status} ${errorText}`,
      );
      return {
        success: false,
        verified: false,
        subscription_ids: Array.from(subscriptionIds),
        error: "Shopify webhook verification failed",
        action: "failed",
      };
    }

    const verifyData = (await verifyResponse.json()) as {
      webhooks?: ShopifyWebhookRecord[];
    };
    const verifiedWebhooks = (verifyData.webhooks ?? []).filter(
      (webhook) =>
        webhook.address === webhookUrl ||
        webhook.address.startsWith(webhookBaseUrl),
    );
    const verifiedTopics = new Set(
      verifiedWebhooks.map((webhook) => webhook.topic),
    );
    const verified = REQUIRED_TOPICS.every((topic) =>
      verifiedTopics.has(topic),
    );
    const verifiedIds = verifiedWebhooks.map((webhook) => String(webhook.id));
    const lastReceivedAt = connection.last_webhook_received_at
      ? new Date(connection.last_webhook_received_at).getTime()
      : 0;
    const isStale =
      Boolean(connection.webhooks_subscribed) &&
      lastReceivedAt > 0 &&
      Date.now() - lastReceivedAt > 24 * 60 * 60 * 1000;
    if (isStale && action === "verified") {
      action = "updated";
    }
    const retryCount = verified ? 0 : (connection.webhook_retry_count || 0) + 1;

    await supabase
      .from("shopify_connections")
      .update({
        webhooks_subscribed: verified,
        webhook_subscription_ids: verifiedIds,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_last_error: verified
          ? null
          : "One or more required webhook topics could not be verified",
        webhook_retry_count: retryCount,
        webhook_next_retry_at: verified
          ? null
          : new Date(
              Date.now() + getRetryDelayMinutes(retryCount) * 60 * 1000,
            ).toISOString(),
      })
      .eq("id", connectionId);

    return {
      success: true,
      verified,
      subscription_ids: verifiedIds,
      error: verified ? null : "Verification pending",
      action,
      topics: [...REQUIRED_TOPICS],
    };
  } catch (error: any) {
    await updateConnectionError(supabase, connectionId, error.message);
    return {
      success: false,
      verified: false,
      subscription_ids: [],
      error: error.message,
      action: "failed",
    };
  }
}
