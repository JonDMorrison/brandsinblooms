import { createClient } from "npm:@supabase/supabase-js@2";
import { logActivityEvent } from "../_shared/activityLogger.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { encryptToken } from "../_shared/crypto/tokens.ts";
import {
  detectEnvironmentFromOrigin,
  getLightspeedCredentials,
} from "../_shared/environment.ts";
import { ensureLightspeedWebhooks } from "../_shared/webhooks/ensureLightspeedWebhooks.ts";

console.log("[LS-CALLBACK] Edge function starting");

type CallbackPayload = {
  code?: string | null;
  state?: string | null;
  redirectUri?: string | null;
};

type WebhookResult = {
  success?: boolean;
  verified: boolean;
  error?: string | null;
  subscription_id?: string | null;
  action?: "created" | "updated" | "verified" | "failed" | "skipped";
};

type OAuthStateRow = {
  user_id: string;
  tenant_id: string;
  domain_prefix: string;
  expires_at: string;
  redirect_uri?: string | null;
};

async function logLightspeedLifecycleActivity(
  supabase: any,
  {
    tenantId,
    actorId,
    activityType,
    source,
    status,
    title,
    descriptionText,
    connectionId,
    domainPrefix,
    retailerName,
    metadata = {},
    errorMessage = null,
  }: {
    tenantId: string;
    actorId: string;
    activityType: string;
    source: "ui" | "webhook";
    status: "success" | "failed" | "warning";
    title: string;
    descriptionText: string;
    connectionId: string | null;
    domainPrefix: string;
    retailerName: string | null;
    metadata?: Record<string, unknown>;
    errorMessage?: string | null;
  },
) {
  try {
    await logActivityEvent(supabase, {
      tenant_id: tenantId,
      actor_type: "user",
      actor_id: actorId,
      source,
      integration_name: "lightspeed",
      activity_type: activityType,
      status,
      title,
      description: {
        parts: [{ type: "text", text: descriptionText }],
      },
      metadata: {
        connection_id: connectionId,
        domain_prefix: domainPrefix,
        retailer_name: retailerName,
        ...metadata,
      },
      related_entities: {
        connection_id: connectionId,
      },
      links: [{ label: "View integration", href: "/integrations/lightspeed" }],
      error_message: errorMessage,
    });
  } catch (error: any) {
    console.error(
      "[LS-CALLBACK] Failed to log activity event:",
      error?.message ?? error,
    );
  }
}

const getStateLookupErrorText = (
  error:
    | {
        message?: string | null;
        details?: string | null;
        hint?: string | null;
        code?: string | null;
      }
    | null
    | undefined,
): string => {
  return [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");
};

const isMissingRedirectUriColumnError = (
  error:
    | {
        message?: string | null;
        details?: string | null;
        hint?: string | null;
        code?: string | null;
      }
    | null
    | undefined,
): boolean => {
  const errorText = getStateLookupErrorText(error);
  return error?.code === "PGRST204" || errorText.includes("redirect_uri");
};

const normalizeCallbackRedirectUri = (
  value: string | null | undefined,
): string | null => {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.startsWith("http")) return null;

  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}/integrations/lightspeed/callback`;
  } catch {
    return null;
  }
};

const inferRedirectUri = (req: Request): string => {
  const appOrigin = normalizeCallbackRedirectUri(Deno.env.get("APP_ORIGIN"));
  if (appOrigin) {
    return appOrigin;
  }

  const appBaseUrl = normalizeCallbackRedirectUri(Deno.env.get("APP_BASE_URL"));
  if (appBaseUrl) {
    return appBaseUrl;
  }

  const referer = req.headers.get("referer");
  const refererRedirectUri = normalizeCallbackRedirectUri(referer);
  if (refererRedirectUri) {
    return refererRedirectUri;
  }

  const origin = req.headers.get("origin");
  const originRedirectUri = normalizeCallbackRedirectUri(origin);
  if (originRedirectUri) {
    return originRedirectUri;
  }

  return "https://bloomsuite.app/integrations/lightspeed/callback";
};

const parseCallbackPayload = async (req: Request): Promise<CallbackPayload> => {
  // Some environments/tools may send this as a GET with query params.
  // Our frontend sends it as a POST JSON body.
  if (req.method === "GET") {
    const url = new URL(req.url);
    return {
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      redirectUri:
        url.searchParams.get("redirectUri") ??
        url.searchParams.get("redirect_uri"),
    };
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  // Best-effort parsing for common payload formats.
  if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      return {
        code: body?.code ?? null,
        state: body?.state ?? null,
        redirectUri: body?.redirectUri ?? body?.redirect_uri ?? null,
      };
    } catch {
      return {};
    }
  }

  const raw = await req.text();
  if (!raw) return {};

  // Try JSON first
  try {
    const body = JSON.parse(raw);
    return {
      code: body?.code ?? null,
      state: body?.state ?? null,
      redirectUri: body?.redirectUri ?? body?.redirect_uri ?? null,
    };
  } catch {
    // Fall through to form parsing
  }

  // application/x-www-form-urlencoded
  const params = new URLSearchParams(raw);
  return {
    code: params.get("code"),
    state: params.get("state"),
    redirectUri: params.get("redirectUri") ?? params.get("redirect_uri"),
  };
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log(
      "[LS-CALLBACK] Processing OAuth callback request (no auth required)",
    );

    // Create Supabase client with service role (no user auth required)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Parse request payload (supports JSON POST from frontend and GET query params)
    const payload = await parseCallbackPayload(req);
    const code = payload.code ?? undefined;
    const state = payload.state ?? undefined;
    const inferredRedirectUri = inferRedirectUri(req);

    if (!code || !state) {
      console.error("[LS-CALLBACK] Missing required parameters");
      return new Response(
        JSON.stringify({
          error: "Missing code, state, or redirect URI",
          missing: {
            code: !code,
            state: !state,
            redirectUri: false,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Look up state in database
    console.log("[LS-CALLBACK] Looking up state token...");
    let stateData: OAuthStateRow | null = null;
    let stateError: {
      message?: string | null;
      details?: string | null;
      hint?: string | null;
      code?: string | null;
    } | null = null;
    let redirectUriStorageSource: "oauth_states" | "legacy_oauth_states" =
      "oauth_states";

    const stateLookupWithRedirect = await supabaseClient
      .from("oauth_states")
      .select("user_id, tenant_id, domain_prefix, expires_at, redirect_uri")
      .eq("state_token", state)
      .single();

    if (isMissingRedirectUriColumnError(stateLookupWithRedirect.error)) {
      redirectUriStorageSource = "legacy_oauth_states";
      const legacyStateLookup = await supabaseClient
        .from("oauth_states")
        .select("user_id, tenant_id, domain_prefix, expires_at")
        .eq("state_token", state)
        .single();

      stateData = legacyStateLookup.data
        ? {
            ...legacyStateLookup.data,
            redirect_uri: null,
          }
        : null;
      stateError = legacyStateLookup.error;
    } else {
      stateData = stateLookupWithRedirect.data as OAuthStateRow | null;
      stateError = stateLookupWithRedirect.error;
    }

    if (stateError || !stateData) {
      console.error("[LS-CALLBACK] State lookup failed:", stateError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid or expired state token" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const storedRedirectUri =
      typeof stateData.redirect_uri === "string" && stateData.redirect_uri
        ? stateData.redirect_uri
        : null;
    const payloadRedirectUri = normalizeCallbackRedirectUri(
      payload.redirectUri,
    );
    const redirectUri =
      storedRedirectUri || payloadRedirectUri || inferredRedirectUri;
    const redirectUriSource = storedRedirectUri
      ? "stored"
      : payloadRedirectUri
        ? "payload"
        : "inferred";
    const environment = detectEnvironmentFromOrigin(redirectUri);

    console.log("[LS-CALLBACK] Request data:", {
      hasCode: !!code,
      hasState: !!state,
      redirectUri,
      redirectUriSource,
      payloadRedirectUri: payload.redirectUri ?? "not provided",
      normalizedPayloadRedirectUri: payloadRedirectUri ?? "not normalized",
      inferredRedirectUri,
      storedRedirectUri: storedRedirectUri ?? "not stored",
      redirectUriStorageSource,
      referer: req.headers.get("referer"),
      origin: req.headers.get("origin"),
      environment,
    });

    if (!redirectUri) {
      console.error("[LS-CALLBACK] Redirect URI could not be resolved");
      return new Response(
        JSON.stringify({
          error: "Missing code, state, or redirect URI",
          missing: {
            code: false,
            state: false,
            redirectUri: true,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if state has expired
    if (new Date(stateData.expires_at) < new Date()) {
      console.error("[LS-CALLBACK] State token expired");
      await supabaseClient
        .from("oauth_states")
        .delete()
        .eq("state_token", state);
      return new Response(JSON.stringify({ error: "State token expired" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      user_id: userId,
      tenant_id: tenantId,
      domain_prefix: domainPrefix,
    } = stateData;
    console.log("[LS-CALLBACK] State verified for user");

    // Delete used state token
    await supabaseClient.from("oauth_states").delete().eq("state_token", state);

    // Derive environment from the callback redirect URI so the token exchange
    // uses the same Lightspeed app context as the original authorize request.
    const { clientId, clientSecret } = getLightspeedCredentials(environment);
    if (!clientId || !clientSecret) {
      console.error(
        `[LS-CALLBACK] Missing Lightspeed credentials for ${environment}`,
      );
      return new Response(
        JSON.stringify({
          error: "Lightspeed credentials not configured for this environment",
          environment,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    console.log("[LS-CALLBACK] Using credentials for:", environment);

    console.log("[LS-CALLBACK] Exchanging code for tokens...");

    // Exchange code for access token (X-Series)
    const tokenUrl = `https://${domainPrefix}.retail.lightspeed.app/api/1.0/token`;
    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(
        "[LS-CALLBACK] Token exchange failed:",
        tokenResponse.status,
        errorText,
      );
      console.error("[LS-CALLBACK] Token exchange context:", {
        redirectUri,
        redirectUriSource,
        environment,
        domainPrefix,
        clientIdPrefix: clientId.substring(0, 8),
      });
      return new Response(
        JSON.stringify({
          error: "Failed to exchange authorization code",
          details: errorText,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("[LS-CALLBACK] Token exchange successful");

    // Get account info
    const accountUrl = `https://${domainPrefix}.retail.lightspeed.app/api/2.0/Account.json`;
    const accountResponse = await fetch(accountUrl, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    let retailerName = domainPrefix;
    if (accountResponse.ok) {
      const accountData = await accountResponse.json();
      retailerName = accountData.Account?.name || domainPrefix;
      console.log("[LS-CALLBACK] Got retailer name:", retailerName);
    }

    // Calculate expiry
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    const encryptedAccessToken = await encryptToken(tokenData.access_token);
    const encryptedRefreshToken = tokenData.refresh_token
      ? await encryptToken(tokenData.refresh_token)
      : null;

    console.log("[LS-CALLBACK] Updating connection in database...");

    // Update connection with real tokens
    const { error: updateError } = await supabaseClient
      .from("lightspeed_connections")
      .update({
        encrypted_access_token: encryptedAccessToken,
        encrypted_refresh_token: encryptedRefreshToken,
        expires_at: expiresAt.toISOString(),
        retailer_name: retailerName,
        status: "connected",
        connected_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("domain_prefix", domainPrefix);

    if (updateError) {
      console.error("[LS-CALLBACK] Failed to update connection:", updateError);
      return new Response(
        JSON.stringify({
          error: "Failed to save connection",
          details: updateError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      "[LS-CALLBACK] Connection saved, setting up webhooks automatically...",
    );

    // ============================================
    // AUTO-SUBSCRIBE WEBHOOKS - No user action needed
    // ============================================
    // Get connection ID first
    const { data: savedConnection } = await supabaseClient
      .from("lightspeed_connections")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("domain_prefix", domainPrefix)
      .single();

    let webhookResult: WebhookResult = {
      verified: false,
      error: "Connection ID not found",
    };
    if (savedConnection?.id) {
      try {
        webhookResult = await ensureLightspeedWebhooks(
          supabaseClient,
          savedConnection.id,
        );
        console.log(
          "[LS-CALLBACK] Webhook setup result:",
          JSON.stringify(webhookResult),
        );

        if (webhookResult.verified) {
          console.log(
            "[LS-CALLBACK] ✓ Webhooks configured:",
            webhookResult.subscription_id,
          );
        } else {
          console.warn(
            "[LS-CALLBACK] ⚠ Webhook setup pending:",
            webhookResult.error,
          );
        }
      } catch (webhookError: unknown) {
        const message =
          webhookError instanceof Error
            ? webhookError.message
            : String(webhookError);
        console.error("[LS-CALLBACK] Webhook setup error:", message);
        webhookResult = { verified: false, error: message };
      }
    }

    await logLightspeedLifecycleActivity(supabaseClient, {
      tenantId,
      actorId: stateData.user_id,
      activityType: "lightspeed.connection.established",
      source: "ui",
      status: "success",
      title: "Lightspeed connection established",
      descriptionText: `Connected ${retailerName || domainPrefix} and enabled Lightspeed syncing`,
      connectionId: savedConnection?.id ?? null,
      domainPrefix,
      retailerName,
      metadata: {
        webhook_verified: webhookResult.verified,
        webhook_subscription_id: webhookResult.subscription_id ?? null,
      },
    });

    if (savedConnection?.id && webhookResult.verified) {
      await logLightspeedLifecycleActivity(supabaseClient, {
        tenantId,
        actorId: stateData.user_id,
        activityType: "lightspeed.webhook.registered",
        source: "webhook",
        status: "success",
        title: "Lightspeed webhooks registered",
        descriptionText: `Registered Lightspeed webhooks for ${retailerName || domainPrefix}`,
        connectionId: savedConnection.id,
        domainPrefix,
        retailerName,
        metadata: {
          subscription_id: webhookResult.subscription_id ?? null,
          action: webhookResult.action ?? null,
          verified: webhookResult.verified,
        },
      });
    } else {
      await logLightspeedLifecycleActivity(supabaseClient, {
        tenantId,
        actorId: stateData.user_id,
        activityType: "lightspeed.webhook.registration.failed",
        source: "webhook",
        status: "failed",
        title: "Lightspeed webhook registration failed",
        descriptionText: `Webhook registration failed for ${retailerName || domainPrefix}: ${webhookResult.error || "Connection ID not found"}`,
        connectionId: savedConnection?.id ?? null,
        domainPrefix,
        retailerName,
        metadata: {
          subscription_id: webhookResult.subscription_id ?? null,
          action: webhookResult.action ?? null,
          verified: webhookResult.verified,
        },
        errorMessage: webhookResult.error || "Connection ID not found",
      });
    }

    console.log("[LS-CALLBACK] Connection successful");

    return new Response(
      JSON.stringify({
        success: true,
        retailerName,
        message: "Lightspeed connected successfully",
        webhooks: {
          configured: webhookResult?.verified || false,
          subscription_id: webhookResult?.subscription_id ?? null,
          error: webhookResult?.error || null,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[LS-CALLBACK] Unexpected error:", message);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
