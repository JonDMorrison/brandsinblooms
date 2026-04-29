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

const XSERIES_WEBHOOK_TYPES = [
  "sale.update",
  "customer.update",
  "product.update",
  "inventory.update",
] as const;

type XSeriesWebhookType = (typeof XSERIES_WEBHOOK_TYPES)[number];

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

function getWebhookType(webhook: any) {
  if (!webhook || typeof webhook !== "object") {
    return null;
  }

  return typeof webhook.type === "string"
    ? webhook.type
    : typeof webhook.event === "string"
      ? webhook.event
      : null;
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

async function createXSeriesWebhook(
  createEndpoint: string,
  headers: Record<string, string>,
  webhookUrl: string,
  webhookType: XSeriesWebhookType,
) {
  const createBody = {
    url: webhookUrl,
    type: webhookType,
    active: true,
  };

  console.log(
    `[ENSURE-LIGHTSPEED-WEBHOOKS] Creating webhook type=${webhookType}`,
  );
  console.log(
    "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series create body:",
    JSON.stringify(createBody),
  );

  const createResponse = await fetch(createEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(createBody),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(
      `[ENSURE-LIGHTSPEED-WEBHOOKS] Failed to create ${webhookType}:`,
      createResponse.status,
      errorText,
    );

    return {
      ok: false,
      status: createResponse.status,
      errorText,
      createdId: null,
    };
  }

  const createData = await createResponse.json();
  const createdWebhook = extractWebhookRecord(createData);
  const createdId = getWebhookId(createdWebhook);

  console.log(
    "[ENSURE-LIGHTSPEED-WEBHOOKS] Create response keys:",
    getResponseKeys(createData),
  );
  console.log(
    "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series create response:",
    JSON.stringify(createData),
  );
  if (createdId) {
    console.log(
      `[ENSURE-LIGHTSPEED-WEBHOOKS] ✓ Created ${webhookType}: ${createdId}`,
    );
  } else {
    console.warn(
      `[ENSURE-LIGHTSPEED-WEBHOOKS] ${webhookType} created but no ID was returned`,
    );
  }

  return {
    ok: true,
    status: createResponse.status,
    errorText: null,
    createdId,
  };
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

    // 4. Find our webhook(s)
    const ourWebhooks = webhooks.filter(
      (w: any) => w.url === webhookUrl || w.url === legacyWebhookUrl,
    );
    const existingWebhook = ourWebhooks[0] || null;
    console.log(
      `[ENSURE-LIGHTSPEED-WEBHOOKS] Found ${ourWebhooks.length} webhook(s) matching our URL`,
    );
    const existingWebhookId = getWebhookId(existingWebhook);

    let subscriptionId: string | null = null;
    let action: "created" | "updated" | "verified" = "verified";

    if (existingWebhook) {
      subscriptionId = existingWebhookId;

      if (detectedFormat === "x-series") {
        const existingTypes = new Set<string>();
        for (const webhook of ourWebhooks) {
          const webhookType = getWebhookType(webhook);
          if (webhookType) {
            existingTypes.add(webhookType);
          }
        }

        const missingTypes = XSERIES_WEBHOOK_TYPES.filter(
          (type) => !existingTypes.has(type),
        );

        if (missingTypes.length > 0) {
          console.log(
            `[ENSURE-LIGHTSPEED-WEBHOOKS] Missing webhook types: ${missingTypes.join(", ")}`,
          );

          for (const webhookType of missingTypes) {
            const result = await createXSeriesWebhook(
              endpoints.create,
              headers,
              webhookUrl,
              webhookType,
            );

            if (result.ok) {
              if (!subscriptionId && result.createdId) {
                subscriptionId = result.createdId;
              }
              action = "updated";
            } else {
              console.warn(
                `[ENSURE-LIGHTSPEED-WEBHOOKS] Failed to create missing type ${webhookType}: ${result.status}`,
              );
            }
          }
        }

        for (const webhook of ourWebhooks) {
          const webhookId = getWebhookId(webhook);
          if (!webhookId) {
            console.warn(
              "[ENSURE-LIGHTSPEED-WEBHOOKS] Matched X-Series webhook has no usable ID; skipping update",
            );
            continue;
          }

          if (!isWebhookEnabled(webhook) || webhook.url !== webhookUrl) {
            console.log(
              `[ENSURE-LIGHTSPEED-WEBHOOKS] Updating webhook ${webhookId} — active: ${webhook.active}, url match: ${webhook.url === webhookUrl}`,
            );

            const updateBody = { url: webhookUrl, active: true };
            const updateResponse = await fetch(endpoints.update(webhookId), {
              method: "PUT",
              headers,
              body: JSON.stringify(updateBody),
            });

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
        }
      } else if (existingWebhookId) {
        if (
          !isWebhookEnabled(existingWebhook) ||
          existingWebhook.url !== webhookUrl
        ) {
          console.log(
            "[ENSURE-LIGHTSPEED-WEBHOOKS] Updating webhook:",
            subscriptionId,
            "=>",
            webhookUrl,
          );

          const updateBody = { Webhook: { enabled: true, url: webhookUrl } };

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
      } else {
        console.warn(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] Existing R-Series webhook matched by URL but had no usable ID - creating a replacement",
        );
      }

      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Existing webhook(s) processed. Primary ID:",
        subscriptionId,
      );
    } else {
      // Create new webhook
      console.log(
        "[ENSURE-LIGHTSPEED-WEBHOOKS] Creating webhook to:",
        webhookUrl,
      );

      if (detectedFormat === "x-series") {
        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series: creating one webhook per event type",
        );

        const createdIds: string[] = [];
        const successfulTypes: XSeriesWebhookType[] = [];
        const failedTypes: string[] = [];

        for (const webhookType of XSERIES_WEBHOOK_TYPES) {
          const result = await createXSeriesWebhook(
            endpoints.create,
            headers,
            webhookUrl,
            webhookType,
          );

          if (result.ok) {
            successfulTypes.push(webhookType);
            if (result.createdId) {
              createdIds.push(result.createdId);
            }
            continue;
          }

          failedTypes.push(webhookType);
        }

        if (successfulTypes.length === 0) {
          const errorMsg = `All webhook type registrations failed: ${failedTypes.join(", ")}`;
          console.log("[ENSURE-LIGHTSPEED-WEBHOOKS]", errorMsg);
          await updateConnectionError(supabase, connectionId, errorMsg);
          return {
            success: false,
            verified: false,
            subscription_id: null,
            error: errorMsg,
            action: "failed",
          };
        }

        subscriptionId = createdIds[0] ?? subscriptionId;
        action = "created";
        const createBody = {
          created: successfulTypes,
          failed: failedTypes,
        };
        console.log(
          `[ENSURE-LIGHTSPEED-WEBHOOKS] Created ${successfulTypes.length}/${XSERIES_WEBHOOK_TYPES.length} webhooks. Primary ID: ${subscriptionId}`,
        );
        if (failedTypes.length > 0) {
          console.warn(
            `[ENSURE-LIGHTSPEED-WEBHOOKS] Failed types: ${failedTypes.join(", ")}`,
          );
        }
        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] X-Series create summary:",
          JSON.stringify(createBody),
        );
      } else {
        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] R-Series: creating single webhook",
        );

        const createResponse = await fetch(endpoints.create, {
          method: "POST",
          headers,
          body: JSON.stringify({
            Webhook: {
              url: webhookUrl,
              enabled: true,
              event: "all",
            },
          }),
        });

        if (!createResponse.ok) {
          const errorText = await createResponse.text();
          console.error(
            "[ENSURE-LIGHTSPEED-WEBHOOKS] R-Series create failed:",
            createResponse.status,
            errorText,
          );

          const errorData = parseWebhookErrorPayload(errorText);
          const errorMsg =
            (typeof errorData.message === "string"
              ? errorData.message
              : null) || `Create failed: ${createResponse.status}`;

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
        const createdWebhook =
          createData.Webhook ?? createData.data ?? createData;
        subscriptionId = getWebhookId(createdWebhook);
        action = "created";
        console.log(
          "[ENSURE-LIGHTSPEED-WEBHOOKS] R-Series webhook created:",
          subscriptionId,
        );
      }
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
      const allWebhooks = extractWebhookCollection(verifyData);

      if (detectedFormat === "x-series") {
        const ourActiveWebhooks = allWebhooks.filter(
          (w: any) =>
            (w.url === webhookUrl || w.url === legacyWebhookUrl) &&
            w.active !== false,
        );
        const activeTypes = new Set<string>();

        for (const webhook of ourActiveWebhooks) {
          const webhookType = getWebhookType(webhook);
          if (webhookType) {
            activeTypes.add(webhookType);
          }
        }

        const coveredCount = XSERIES_WEBHOOK_TYPES.filter((type) =>
          activeTypes.has(type),
        ).length;

        verified = coveredCount >= XSERIES_WEBHOOK_TYPES.length;
        subscriptionId = getWebhookId(ourActiveWebhooks[0]) ?? subscriptionId;

        console.log(
          `[ENSURE-LIGHTSPEED-WEBHOOKS] Verification: ${coveredCount}/${XSERIES_WEBHOOK_TYPES.length} types covered`,
        );
        if (!verified) {
          const missingTypes = XSERIES_WEBHOOK_TYPES.filter(
            (type) => !activeTypes.has(type),
          );
          console.warn(
            `[ENSURE-LIGHTSPEED-WEBHOOKS] Missing types after verify: ${missingTypes.join(", ")}`,
          );
        }
      } else {
        const confirmedWebhook = allWebhooks.find(
          (w: any) =>
            getWebhookId(w) === subscriptionId || w.url === webhookUrl,
        );

        if (confirmedWebhook && confirmedWebhook.enabled !== false) {
          verified = true;
          subscriptionId = getWebhookId(confirmedWebhook);
        }
      }

      if (verified) {
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
