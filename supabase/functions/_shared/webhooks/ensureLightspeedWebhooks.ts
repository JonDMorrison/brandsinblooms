/**
 * ensureLightspeedWebhooks - Idempotent webhook subscription manager for Lightspeed
 *
 * IMPORTANT: Per Lightspeed support (Julien), webhooks are available on ALL
 * POS plans. Business Rules is a separate Plus-plan-only feature that is NOT
 * related to webhook event subscriptions.
 *
 * X-Series uses lowercase /webhooks endpoints without .json suffix.
 * R-Series (legacy) uses /Webhook.json with capital W and .json suffix.
 * This function probes X-Series format first and falls back to R-Series.
 */

import { EnsureWebhooksResult, calculateNextRetry } from "./types.ts";
import { decryptToken } from "../crypto/tokens.ts";

const REQUIRED_EVENTS = [
  "sale.completed",
  "sale.updated",
  "customer.created",
  "customer.updated",
  "product.updated",
  "item.updated",
  "loyalty.updated",
];

type LightspeedWebhookFormat = "x-series" | "r-series";

function shouldTryRSeriesFallback(status: number) {
  return status === 403 || status === 404 || status === 405 || status >= 500;
}

function isWebhookUnavailableStatus(status: number | null) {
  return status === 403 || status === 404;
}

function extractWebhookCollection(payload: any) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  if (Array.isArray(payload.data)) {
    return payload.data;
  }

  if (Array.isArray(payload.webhooks)) {
    return payload.webhooks;
  }

  if (Array.isArray(payload.Webhook)) {
    return payload.Webhook;
  }

  return [];
}

function extractWebhookRecord(payload: any) {
  if (Array.isArray(payload)) {
    return payload[0] ?? null;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  if (Array.isArray(payload.data)) {
    return payload.data[0] ?? null;
  }

  return payload.data ?? payload.webhook ?? payload.Webhook ?? payload;
}

function getWebhookId(webhook: any) {
  if (!webhook || typeof webhook !== "object") {
    return null;
  }

  return (
    webhook.id?.toString() ??
    webhook.webhookID?.toString() ??
    webhook.webhook_id?.toString() ??
    null
  );
}

function isWebhookEnabled(webhook: any) {
  if (!webhook || typeof webhook !== "object") {
    return false;
  }

  return webhook.enabled !== false && webhook.active !== false;
}

function getResponseKeys(payload: any) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  return Object.keys(payload);
}

function parseWebhookErrorPayload(errorText: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(errorText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function getWebhookErrorMessage(
  errorData: Record<string, unknown>,
  status: number,
  errorText: string,
) {
  return (
    (typeof errorData.error === "string" ? errorData.error : null) ||
    (typeof errorData.message === "string" ? errorData.message : null) ||
    (typeof errorData.details === "string" ? errorData.details : null) ||
    (Array.isArray(errorData.errors)
      ? JSON.stringify(errorData.errors)
      : null) ||
    `Create failed: ${status} — ${errorText.slice(0, 200)}`
  );
}

export async function ensureLightspeedWebhooks(
  supabase: any,
  connectionId: string,
): Promise<EnsureWebhooksResult> {
  console.log(
    "[ENSURE-LIGHTSPEED-WEBHOOKS] Starting for connection:",
    connectionId,
  );

  try {
    // 1. Load connection
    const { data: connection, error: connError } = await supabase
      .from("lightspeed_connections")
      .select("*")
      .eq("id", connectionId)
      .single();

    if (connError || !connection) {
      console.error(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Connection not found:",
        connError?.message,
      );
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: "Connection not found",
        action: "failed",
      };
    }

    if (
      !connection.encrypted_access_token ||
      connection.encrypted_access_token === "pending"
    ) {
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: "OAuth not completed",
        action: "failed",
      };
    }

    // 2. Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
      if (!accessToken) throw new Error("Decryption returned empty");
    } catch (e: any) {
      console.error(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Token decryption failed:",
        e.message,
      );
      await updateConnectionError(
        supabase,
        connectionId,
        `Token decryption failed: ${e.message}`,
      );
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: "Token decryption failed",
        action: "failed",
      };
    }

    const domainPrefix = connection.domain_prefix;
    if (!domainPrefix) {
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: "No domain prefix configured",
        action: "failed",
      };
    }

    const baseUrl = `https://${domainPrefix}.retail.lightspeed.app/api/2.0`;
    const handlerBaseUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/lightspeed-webhook-handler`;
    const webhookUrl = `${handlerBaseUrl}/${domainPrefix}`;
    const legacyWebhookUrl = handlerBaseUrl;
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };

    const xSeriesEndpoints = {
      list: `${baseUrl}/webhooks`,
      create: `${baseUrl}/webhooks`,
      update: (id: string) => `${baseUrl}/webhooks/${id}`,
    };
    const rSeriesEndpoints = {
      list: `${baseUrl}/Webhook.json`,
      create: `${baseUrl}/Webhook.json`,
      update: (id: string) => `${baseUrl}/Webhook/${id}.json`,
    };

    // 3. List existing webhooks
    console.log("[ENSURE-LIGHTSPEED-WEBHOOKS] Fetching existing webhooks...");
    let detectedFormat: LightspeedWebhookFormat = "x-series";
    let endpoints = xSeriesEndpoints;
    let xSeriesStatus: number | null = null;
    let rSeriesStatus: number | null = null;

    let listResponse = await fetch(xSeriesEndpoints.list, {
      method: "GET",
      headers,
    });
    xSeriesStatus = listResponse.status;

    if (!listResponse.ok && shouldTryRSeriesFallback(listResponse.status)) {
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series /webhooks returned",
        listResponse.status,
        "- trying R-Series /Webhook.json fallback",
      );

      const fallbackResponse = await fetch(rSeriesEndpoints.list, {
        method: "GET",
        headers,
      });
      rSeriesStatus = fallbackResponse.status;

      if (fallbackResponse.ok) {
        listResponse = fallbackResponse;
        detectedFormat = "r-series";
        endpoints = rSeriesEndpoints;
      } else {
        listResponse = fallbackResponse;
      }
    }

    if (!listResponse.ok) {
      const bothFormatsUnavailable =
        isWebhookUnavailableStatus(xSeriesStatus) &&
        isWebhookUnavailableStatus(rSeriesStatus);

      if (bothFormatsUnavailable) {
        console.warn(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Both webhook endpoint formats returned unavailable statuses:",
          { xSeriesStatus, rSeriesStatus },
        );

        await supabase
          .from("lightspeed_connections")
          .update({
            webhook_registered: false,
            webhooks_subscribed: false,
            webhook_last_error:
              "Lightspeed webhook API not available for both X-Series and R-Series endpoint formats. Sync-only mode.",
            webhooks_last_checked_at: new Date().toISOString(),
          })
          .eq("id", connectionId);

        return {
          success: true,
          verified: false,
          subscription_id: null,
          error: "Webhook API not available - sync-only",
          action: "skipped",
        };
      }

      const errorText = await listResponse.text();
      const statusDetail = `X-Series ${xSeriesStatus}${rSeriesStatus !== null ? `, R-Series ${rSeriesStatus}` : ""}`;
      console.error(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] List failed:",
        statusDetail,
        errorText,
      );
      await updateConnectionError(
        supabase,
        connectionId,
        `Webhook list failed (${statusDetail})`,
      );
      return {
        success: false,
        verified: false,
        subscription_id: null,
        error: `Lightspeed API error: ${statusDetail}`,
        action: "failed",
      };
    }

    console.log(
      "[ENSURE-LIGHTSPEED-WEBHOOKS] Webhook list succeeded via",
      detectedFormat,
      "format",
    );

    const listData = await listResponse.json();
    const webhooks = extractWebhookCollection(listData);
    console.log(
      "[ENSURE-LIGHTSPEED-WEBHOOKS] Found",
      webhooks.length,
      "existing webhooks",
    );
    console.log(
      "[ENSURE-LIGHTSPEED-WEBHOOKS] Response keys:",
      getResponseKeys(listData),
    );
    if (webhooks.length > 0) {
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] First webhook keys:",
        getResponseKeys(webhooks[0]),
      );
    }

    // 4. Find our webhook
    const existingWebhook = webhooks.find(
      (w: any) => w.url === webhookUrl || w.url === legacyWebhookUrl,
    );
    const existingWebhookId = getWebhookId(existingWebhook);

    let subscriptionId: string | null = null;
    let action: "created" | "updated" | "verified" = "verified";

    if (existingWebhook && existingWebhookId) {
      // Webhook exists - check if it's enabled
      subscriptionId = existingWebhookId;

      if (
        !isWebhookEnabled(existingWebhook) ||
        existingWebhook.url !== webhookUrl
      ) {
        // Enable the webhook and migrate legacy generic URLs to the store-specific path.
        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Updating webhook:",
          subscriptionId,
          "=>",
          webhookUrl,
        );

        const updateBody =
          detectedFormat === "x-series"
            ? { url: webhookUrl, active: true }
            : { Webhook: { enabled: true, url: webhookUrl } };

        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Updating webhook with body:",
          JSON.stringify(updateBody),
        );

        const updateResponse = await fetch(
          endpoints.update(existingWebhookId),
          {
            method: "PUT",
            headers,
            body: JSON.stringify(updateBody),
          },
        );

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(
            "[ENSURE-LIGHTSPEED-WEBHOOKS] Update failed:",
            updateResponse.status,
            errorText,
          );
          await updateConnectionError(
            supabase,
            connectionId,
            `Update failed: ${updateResponse.status}`,
          );
          return {
            success: false,
            verified: false,
            subscription_id: null,
            error: `Update failed: ${updateResponse.status}`,
            action: "failed",
          };
        }

        action = "updated";
      }

      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Webhook exists:",
        subscriptionId,
      );
    } else {
      if (existingWebhook && !existingWebhookId) {
        console.warn(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Existing webhook matched by URL but had no usable ID - creating a replacement",
        );
      }

      // Create new webhook
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Creating webhook to:",
        webhookUrl,
      );

      let createResponse: Response | null = null;
      let createAttemptLabel = "r-series";
      let createErrorText: string | null = null;

      if (detectedFormat === "x-series") {
        const createAttempts: Array<{
          label: string;
          body: Record<string, unknown>;
        }> = [
          {
            label: 'type="general.webhook"',
            body: { url: webhookUrl, type: "general.webhook" },
          },
          {
            label: 'type="webhook"',
            body: { url: webhookUrl, type: "webhook" },
          },
          {
            label: 'type="all"',
            body: { url: webhookUrl, type: "all" },
          },
          {
            label: 'type="url"',
            body: { url: webhookUrl, type: "url" },
          },
        ];

        for (const attempt of createAttempts) {
          createAttemptLabel = attempt.label;
          createErrorText = null;

          console.log(
            "[ENSURE-LIGHTSPEED-WEBHOOKS] Attempting X-Series create with",
            attempt.label,
          );
          console.log(
            "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series create body:",
            JSON.stringify(attempt.body),
          );

          createResponse = await fetch(endpoints.create, {
            method: "POST",
            headers,
            body: JSON.stringify(attempt.body),
          });

          if (createResponse.status !== 422) {
            break;
          }

          createErrorText = await createResponse.text();
          console.warn(
            `[ENSURE-LIGHTSPEED-WEBHOOKS] ${attempt.label} rejected with 422`,
          );
          console.warn(
            "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series create 422 response:",
            createErrorText,
          );
        }
      } else {
        const createBody = {
          Webhook: { url: webhookUrl, enabled: true, event: "all" },
        };
        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Creating webhook with body:",
          JSON.stringify(createBody),
        );
        createResponse = await fetch(endpoints.create, {
          method: "POST",
          headers,
          body: JSON.stringify(createBody),
        });
      }

      if (!createResponse) {
        throw new Error("Webhook create request was not attempted");
      }

      if (!createResponse.ok) {
        const errorText = createErrorText ?? (await createResponse.text());
        console.error(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Create failed — status:",
          createResponse.status,
        );
        console.error(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Create failed — attempt:",
          createAttemptLabel,
        );
        console.error(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Create failed — full response:",
          errorText,
        );

        const errorData = parseWebhookErrorPayload(errorText);
        const errorMsg = getWebhookErrorMessage(
          errorData,
          createResponse.status,
          errorText,
        );
        console.error(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Create error parsed:",
          errorMsg,
        );
        await updateConnectionError(supabase, connectionId, errorMsg);
        return {
          success: false,
          verified: false,
          subscription_id: null,
          error: errorMsg,
          action: "failed",
        };
      }

      const createData = await createResponse.json();
      const createdWebhook = extractWebhookRecord(createData);
      subscriptionId = getWebhookId(createdWebhook);
      action = "created";
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Create succeeded with attempt:",
        createAttemptLabel,
      );
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Create response keys:",
        getResponseKeys(createData),
      );
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series create response:",
        JSON.stringify(createData),
      );
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Created webhook ID:",
        subscriptionId,
      );
    }

    // 5. Verify webhook exists
    console.log("[ENSURE-LIGHTSPEED-WEBHOOKS] Verifying...");
    const verifyResponse = await fetch(endpoints.list, {
      method: "GET",
      headers,
    });

    let verified = false;
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      const verifyWebhooks = extractWebhookCollection(verifyData);
      const confirmedWebhook = verifyWebhooks.find(
        (w: any) => getWebhookId(w) === subscriptionId || w.url === webhookUrl,
      );

      if (confirmedWebhook && isWebhookEnabled(confirmedWebhook)) {
        verified = true;
        subscriptionId = getWebhookId(confirmedWebhook);
        console.log("[ENSURE-LIGHTSPEED-WEBHOOKS] ✓ VERIFIED:", subscriptionId);
      }
    }

    // 6. Update connection state
    await supabase
      .from("lightspeed_connections")
      .update({
        webhook_registered: verified,
        webhooks_subscribed: verified,
        webhook_subscription_id: subscriptionId,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_last_error: verified ? null : "Verification failed",
        webhook_retry_count: verified
          ? 0
          : (connection.webhook_retry_count || 0) + 1,
        webhook_next_retry_at: verified
          ? null
          : calculateNextRetry(
              (connection.webhook_retry_count || 0) + 1,
            ).toISOString(),
      })
      .eq("id", connectionId);

    return {
      success: true,
      verified,
      subscription_id: subscriptionId,
      error: verified ? null : "Verification pending",
      action,
    };
  } catch (error: any) {
    console.error("[ENSURE-LIGHTSPEED-WEBHOOKS] Error:", error.message);
    await updateConnectionError(supabase, connectionId, error.message);
    return {
      success: false,
      verified: false,
      subscription_id: null,
      error: error.message,
      action: "failed",
    };
  }
}

async function updateConnectionError(
  supabase: any,
  connectionId: string,
  error: string,
) {
  try {
    const { data: conn } = await supabase
      .from("lightspeed_connections")
      .select("webhook_retry_count")
      .eq("id", connectionId)
      .single();

    const retryCount = (conn?.webhook_retry_count || 0) + 1;

    await supabase
      .from("lightspeed_connections")
      .update({
        webhook_registered: false,
        webhooks_subscribed: false,
        webhook_last_error: error,
        webhooks_last_checked_at: new Date().toISOString(),
        webhook_retry_count: retryCount,
        webhook_next_retry_at: calculateNextRetry(retryCount).toISOString(),
      })
      .eq("id", connectionId);
  } catch (e) {
    console.error(
      "[ENSURE-LIGHTSPEED-WEBHOOKS] Failed to update error state:",
      e,
    );
  }
}
