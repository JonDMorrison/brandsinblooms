import { createClient } from "npm:@supabase/supabase-js@2";

import { ensureLightspeedWebhooks } from "../_shared/webhooks/ensureLightspeedWebhooks.ts";
import {
  shouldRetry,
  WEBHOOK_RETRY_CONFIG,
} from "../_shared/webhooks/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const STALE_THRESHOLD_HOURS = 24;

type LightspeedWebhookConnection = {
  id: string;
  tenant_id: string;
  retailer_name: string | null;
  domain_prefix: string | null;
  webhooks_subscribed: boolean | null;
  webhook_last_error: string | null;
  webhook_retry_count: number | null;
  webhook_next_retry_at: string | null;
  last_webhook_received_at: string | null;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getBearerToken(authHeader: string | null) {
  if (!authHeader) {
    return null;
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return (match?.[1] ?? authHeader).trim();
}

function isStaleConnection(
  connection: LightspeedWebhookConnection,
  staleThresholdIso: string,
) {
  return (
    connection.webhooks_subscribed === true &&
    (!connection.last_webhook_received_at ||
      connection.last_webhook_received_at < staleThresholdIso)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[LIGHTSPEED-WEBHOOK-HEALTH] Starting health check");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authHeader = req.headers.get("Authorization");
    const bearerToken = getBearerToken(authHeader);

    if (!authHeader || !bearerToken) {
      throw new Error("Missing authorization header");
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const requestClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const isServiceRoleRequest = bearerToken === serviceRoleKey;

    let tenantId: string | null = null;
    if (!isServiceRoleRequest) {
      const {
        data: { user },
        error: userError,
      } = await requestClient.auth.getUser();

      if (userError || !user) {
        throw new Error("Unauthorized");
      }

      const { data: userData, error: tenantError } = await serviceClient
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .single();

      if (tenantError || !userData?.tenant_id) {
        throw new Error("Tenant not found");
      }

      tenantId = userData.tenant_id;
    }

    const body = await req.json().catch(() => ({}));
    const connectionId =
      typeof body?.connectionId === "string" &&
      body.connectionId.trim().length > 0
        ? body.connectionId.trim()
        : null;

    const staleThresholdIso = new Date(
      Date.now() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000,
    ).toISOString();

    const results: Array<Record<string, unknown>> = [];
    const processedConnectionIds = new Set<string>();

    const recordResult = async (
      connection: LightspeedWebhookConnection,
      forcedAction?: string,
    ) => {
      try {
        const result = await ensureLightspeedWebhooks(
          serviceClient,
          connection.id,
        );
        results.push({
          connection_id: connection.id,
          tenant_id: connection.tenant_id,
          retailer_name: connection.retailer_name,
          domain_prefix: connection.domain_prefix,
          action: forcedAction ?? result.action,
          verified: result.verified,
          subscription_id: result.subscription_id,
          error: result.error,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(
          `[LIGHTSPEED-WEBHOOK-HEALTH] Error processing ${connection.id}:`,
          message,
        );
        results.push({
          connection_id: connection.id,
          tenant_id: connection.tenant_id,
          retailer_name: connection.retailer_name,
          domain_prefix: connection.domain_prefix,
          action: "error",
          verified: false,
          error: message,
        });
      }
    };

    if (connectionId) {
      let query = serviceClient
        .from("lightspeed_connections")
        .select(
          "id,tenant_id,retailer_name,domain_prefix,webhooks_subscribed,webhook_last_error,webhook_retry_count,webhook_next_retry_at,last_webhook_received_at",
        )
        .eq("id", connectionId)
        .eq("status", "connected")
        .neq("encrypted_access_token", "pending")
        .limit(1);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: targetConnections, error: targetError } = await query;
      if (targetError) {
        throw targetError;
      }

      const targetConnection = (targetConnections?.[0] ??
        null) as LightspeedWebhookConnection | null;

      if (!targetConnection) {
        return jsonResponse(
          { success: false, error: "No eligible Lightspeed connection found." },
          404,
        );
      }

      processedConnectionIds.add(targetConnection.id);
      await recordResult(targetConnection, "verify");
    } else {
      let retryQuery = serviceClient
        .from("lightspeed_connections")
        .select(
          "id,tenant_id,retailer_name,domain_prefix,webhooks_subscribed,webhook_last_error,webhook_retry_count,webhook_next_retry_at,last_webhook_received_at",
        )
        .eq("status", "connected")
        .neq("encrypted_access_token", "pending")
        .or("webhooks_subscribed.is.false,webhooks_subscribed.is.null");

      let staleQuery = serviceClient
        .from("lightspeed_connections")
        .select(
          "id,tenant_id,retailer_name,domain_prefix,webhooks_subscribed,webhook_last_error,webhook_retry_count,webhook_next_retry_at,last_webhook_received_at",
        )
        .eq("status", "connected")
        .neq("encrypted_access_token", "pending")
        .eq("webhooks_subscribed", true)
        .or(
          `last_webhook_received_at.is.null,last_webhook_received_at.lt.${staleThresholdIso}`,
        );

      if (tenantId) {
        retryQuery = retryQuery.eq("tenant_id", tenantId);
        staleQuery = staleQuery.eq("tenant_id", tenantId);
      }

      const [retryConnectionsResult, staleConnectionsResult] =
        await Promise.all([retryQuery, staleQuery]);

      if (retryConnectionsResult.error) {
        throw retryConnectionsResult.error;
      }

      if (staleConnectionsResult.error) {
        throw staleConnectionsResult.error;
      }

      const retryConnections =
        (retryConnectionsResult.data as LightspeedWebhookConnection[] | null) ??
        [];
      const staleConnections =
        (staleConnectionsResult.data as LightspeedWebhookConnection[] | null) ??
        [];

      console.log(
        `[LIGHTSPEED-WEBHOOK-HEALTH] Found ${retryConnections.length} retry candidate(s) and ${staleConnections.length} stale candidate(s)`,
      );

      for (const connection of retryConnections) {
        if (processedConnectionIds.has(connection.id)) {
          continue;
        }

        processedConnectionIds.add(connection.id);

        if (
          (connection.webhook_retry_count ?? 0) >=
          WEBHOOK_RETRY_CONFIG.MAX_RETRIES
        ) {
          results.push({
            connection_id: connection.id,
            tenant_id: connection.tenant_id,
            retailer_name: connection.retailer_name,
            domain_prefix: connection.domain_prefix,
            action: "skipped",
            verified: false,
            reason: "max_retries_exceeded",
            retry_count: connection.webhook_retry_count ?? 0,
          });
          continue;
        }

        if (
          !shouldRetry(
            connection.webhooks_subscribed,
            connection.webhook_retry_count,
            connection.webhook_next_retry_at,
          )
        ) {
          results.push({
            connection_id: connection.id,
            tenant_id: connection.tenant_id,
            retailer_name: connection.retailer_name,
            domain_prefix: connection.domain_prefix,
            action: "skipped",
            verified: false,
            reason: "retry_not_due",
            next_retry_at: connection.webhook_next_retry_at,
          });
          continue;
        }

        await recordResult(connection);
      }

      for (const connection of staleConnections) {
        if (processedConnectionIds.has(connection.id)) {
          continue;
        }

        if (!isStaleConnection(connection, staleThresholdIso)) {
          continue;
        }

        processedConnectionIds.add(connection.id);
        await recordResult(connection, "re-verified");
      }
    }

    const summary = {
      total_checked: results.length,
      verified: results.filter((result) => result.verified).length,
      failed: results.filter(
        (result) => result.action === "failed" || result.action === "error",
      ).length,
      skipped: results.filter((result) => result.action === "skipped").length,
    };

    console.log(
      "[LIGHTSPEED-WEBHOOK-HEALTH] Complete:",
      JSON.stringify(summary),
    );

    return jsonResponse({
      success: true,
      message: connectionId
        ? "Lightspeed webhook verification complete."
        : "Lightspeed webhook health check complete.",
      summary,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[LIGHTSPEED-WEBHOOK-HEALTH] Error:", message);
    return jsonResponse({ success: false, error: message }, 400);
  }
});
