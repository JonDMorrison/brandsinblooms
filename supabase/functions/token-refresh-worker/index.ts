import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getSquareCredentials,
  getLightspeedCredentials,
} from "../_shared/environment.ts";
import { logActivityEvent } from "../_shared/activityLogger.ts";
import { encryptToken, decryptToken } from "../_shared/crypto/tokens.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function logLightspeedTokenRefreshActivity(
  connection: {
    id: string;
    tenant_id: string;
    domain_prefix: string | null;
  },
  {
    activityType,
    status,
    title,
    descriptionText,
    metadata = {},
    errorMessage = null,
  }: {
    activityType: string;
    status: "success" | "failed";
    title: string;
    descriptionText: string;
    metadata?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  try {
    await logActivityEvent(supabaseAdmin, {
      tenant_id: connection.tenant_id,
      actor_type: "integration",
      actor_id: connection.id,
      source: "automation",
      integration_name: "lightspeed",
      activity_type: activityType,
      status,
      title,
      description: {
        parts: [{ type: "text", text: descriptionText }],
      },
      metadata: {
        connection_id: connection.id,
        domain_prefix: connection.domain_prefix,
        ...metadata,
      },
      related_entities: {
        connection_id: connection.id,
      },
      links: [{ label: "View integration", href: "/integrations/lightspeed" }],
      error_message: errorMessage,
    });
  } catch (error) {
    console.error("[LS-REFRESH] Failed to log activity event:", error);
  }
}

/**
 * Refresh Square OAuth token using refresh_token
 * Square tokens last 30 days, refresh tokens last until used
 */
async function refreshSquareToken(connection: any) {
  console.log(
    `[SQUARE-REFRESH] Starting token refresh for connection ${connection.id}`,
  );

  // Decrypt the refresh token
  if (!connection.encrypted_refresh_token) {
    throw new Error("No refresh token available - user must reconnect");
  }

  let refreshToken: string;
  try {
    refreshToken = await decryptToken(connection.encrypted_refresh_token);
  } catch (e: any) {
    throw new Error(`Failed to decrypt refresh token: ${e.message}`);
  }

  // Use production credentials for token refresh
  const { clientId, clientSecret } = getSquareCredentials("production");

  if (!clientId || !clientSecret) {
    throw new Error("Square credentials not configured");
  }

  // Determine the token URL based on environment
  const tokenUrl =
    connection.environment === "sandbox"
      ? "https://connect.squareupsandbox.com/oauth2/token"
      : "https://connect.squareup.com/oauth2/token";

  console.log(`[SQUARE-REFRESH] Calling Square token endpoint...`);

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": "2024-01-18",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("[SQUARE-REFRESH] Token refresh failed:", data);
    throw new Error(
      data.message ||
        data.error_description ||
        "Failed to refresh Square token",
    );
  }

  console.log(`[SQUARE-REFRESH] New tokens received`);

  // Encrypt the new tokens
  const encryptedAccessToken = await encryptToken(data.access_token);
  const encryptedRefreshToken = data.refresh_token
    ? await encryptToken(data.refresh_token)
    : connection.encrypted_refresh_token; // Keep old if not returned

  // Square tokens expire in 30 days
  const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Update the connection
  await supabaseAdmin
    .from("square_connections")
    .update({
      encrypted_access_token: encryptedAccessToken,
      encrypted_refresh_token: encryptedRefreshToken,
      expires_at: newExpiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id);

  console.log(
    `[SQUARE-REFRESH] Successfully refreshed token for connection ${connection.id}, expires: ${newExpiresAt.toISOString()}`,
  );

  return { success: true, newExpiresAt };
}

serve(async (req) => {
  try {
    console.log("Token refresh worker starting...");

    let totalSuccess = 0;
    let totalErrors = 0;

    // ============================================
    // 1. REFRESH SQUARE TOKENS
    // FIX: [P9] - Add Square token refresh (tokens expire after 30 days)
    // Refresh tokens expiring within 7 days
    // ============================================
    const sevenDaysFromNow = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data: squareConnections, error: squareFetchError } =
      await supabaseAdmin
        .from("square_connections")
        .select(
          "id, tenant_id, encrypted_access_token, encrypted_refresh_token, expires_at, environment, status",
        )
        .eq("status", "connected")
        .not("expires_at", "is", null)
        .not("encrypted_refresh_token", "is", null)
        .lt("expires_at", sevenDaysFromNow);

    if (squareFetchError) {
      console.error("Error fetching Square connections:", squareFetchError);
    } else {
      console.log(
        `Found ${squareConnections?.length || 0} Square connections to refresh`,
      );

      for (const connection of squareConnections || []) {
        try {
          console.log(
            `Refreshing token for Square connection ${connection.id}`,
          );
          await refreshSquareToken(connection);
          totalSuccess++;
        } catch (error: any) {
          console.error(
            `Error refreshing Square token for connection ${connection.id}:`,
            error.message,
          );
          totalErrors++;

          // If refresh failed due to invalid token, mark connection for re-auth
          if (
            error.message?.includes("invalid") ||
            error.message?.includes("expired")
          ) {
            console.log(
              `[SQUARE-REFRESH] Marking connection ${connection.id} as needing reconnection`,
            );
            await supabaseAdmin
              .from("square_connections")
              .update({
                status: "token_expired",
                updated_at: new Date().toISOString(),
              })
              .eq("id", connection.id);
          }
        }
      }
    }

    // ============================================
    // 2. REFRESH LIGHTSPEED TOKENS
    // FIX: [P4] - Add Lightspeed token refresh support
    // TODO: Confirm Lightspeed X-Series token refresh endpoint URL
    // Refresh tokens expiring within 30 minutes
    // ============================================
    const thirtyMinutesFromNow = new Date(
      Date.now() + 30 * 60 * 1000,
    ).toISOString();

    const { data: lightspeedConnections, error: lsFetchError } =
      await supabaseAdmin
        .from("lightspeed_connections")
        .select(
          "id, tenant_id, domain_prefix, encrypted_access_token, encrypted_refresh_token, expires_at, status",
        )
        .eq("status", "connected")
        .not("expires_at", "is", null)
        .not("encrypted_refresh_token", "is", null)
        .lt("expires_at", thirtyMinutesFromNow);

    if (lsFetchError) {
      console.error("Error fetching Lightspeed connections:", lsFetchError);
    } else {
      console.log(
        `Found ${lightspeedConnections?.length || 0} Lightspeed connections to refresh`,
      );

      for (const connection of lightspeedConnections || []) {
        try {
          console.log(
            `[LS-REFRESH] Refreshing token for connection ${connection.id}`,
          );

          if (!connection.encrypted_refresh_token) {
            throw new Error("No refresh token available - user must reconnect");
          }

          const refreshToken = await decryptToken(
            connection.encrypted_refresh_token,
          );

          const { clientId, clientSecret } =
            getLightspeedCredentials("production");
          if (!clientId || !clientSecret) {
            throw new Error("Lightspeed credentials not configured");
          }

          const tokenUrl = `https://${connection.domain_prefix}.retail.lightspeed.app/api/1.0/token`;
          const tokenParams = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret,
          });

          const response = await fetch(tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenParams.toString(),
          });

          const data = await response.json();

          if (!response.ok || !data.access_token) {
            throw new Error(
              data.error_description ||
                data.error ||
                "Failed to refresh Lightspeed token",
            );
          }

          const encryptedAccessToken = await encryptToken(data.access_token);
          const encryptedRefreshToken = data.refresh_token
            ? await encryptToken(data.refresh_token)
            : connection.encrypted_refresh_token;

          const newExpiresAt = new Date(
            Date.now() + (data.expires_in || 3600) * 1000,
          );

          await supabaseAdmin
            .from("lightspeed_connections")
            .update({
              encrypted_access_token: encryptedAccessToken,
              encrypted_refresh_token: encryptedRefreshToken,
              expires_at: newExpiresAt.toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", connection.id);

          console.log(
            `[LS-REFRESH] Successfully refreshed token for connection ${connection.id}, expires: ${newExpiresAt.toISOString()}`,
          );
          await logLightspeedTokenRefreshActivity(connection, {
            activityType: "lightspeed.token.refreshed",
            status: "success",
            title: "Lightspeed token refreshed",
            descriptionText: `Refreshed the Lightspeed access token for ${connection.domain_prefix || "Lightspeed store"}`,
            metadata: {
              expires_at: newExpiresAt.toISOString(),
            },
          });
          totalSuccess++;
        } catch (error: any) {
          console.error(
            `[LS-REFRESH] Error refreshing Lightspeed token for connection ${connection.id}:`,
            error.message,
          );
          totalErrors++;

          await logLightspeedTokenRefreshActivity(connection, {
            activityType: "lightspeed.token.refresh.failed",
            status: "failed",
            title: "Lightspeed token refresh failed",
            descriptionText: `Failed to refresh the Lightspeed access token for ${connection.domain_prefix || "Lightspeed store"}: ${error.message}`,
            metadata: {
              previous_status: connection.status,
            },
            errorMessage: error.message,
          });

          if (
            error.message?.includes("invalid") ||
            error.message?.includes("expired")
          ) {
            console.log(
              `[LS-REFRESH] Marking connection ${connection.id} as needing reconnection`,
            );
            await supabaseAdmin
              .from("lightspeed_connections")
              .update({
                status: "token_expired",
                updated_at: new Date().toISOString(),
              })
              .eq("id", connection.id);
          }
        }
      }
    }

    const summary = `Token refresh complete: ${totalSuccess} success, ${totalErrors} errors`;
    console.log(summary);

    return new Response(summary, { status: 200 });
  } catch (error) {
    console.error("Token refresh worker error:", error);
    return new Response("Worker error", { status: 500 });
  }
});
