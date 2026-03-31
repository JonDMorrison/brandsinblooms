import { createClient } from "npm:@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v2.8/mod.ts";
import {
  encryptToken,
  assertEncryptionKeyConfigured,
} from "../_shared/crypto/tokens.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fail fast if encryption key is not configured
if (import.meta.main) {
  try {
    assertEncryptionKeyConfigured();
  } catch (error: any) {
    console.error("[migrations-oauth-callback] FATAL:", error.message);
  }
}

function decodeJwtPayload(
  value: string | null,
): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  const segments = value.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const normalized = segments[1]
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(segments[1].length / 4) * 4, "=");
    const decoded = atob(normalized);
    const parsed = JSON.parse(decoded);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getStringValue(
  source: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = source?.[key];

  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
}

function resolveProvider(...candidates: Array<string | undefined>) {
  return (
    candidates.find(
      (candidate) =>
        typeof candidate === "string" && candidate.trim().length > 0,
    ) ?? "unknown"
  );
}

function buildCallbackRedirectUrl({
  appOrigin,
  provider,
  status,
  message,
}: {
  appOrigin: string;
  provider: string;
  status: "success" | "error";
  message?: string;
}) {
  const redirectUrl = new URL("/oauth/callback", appOrigin);
  redirectUrl.searchParams.set("provider", provider);
  redirectUrl.searchParams.set("status", status);

  if (message) {
    redirectUrl.searchParams.set("message", message);
  }

  return redirectUrl.toString();
}

export interface MigrationsOAuthCallbackDependencies {
  createClient: typeof createClient;
  verifyJwt: typeof verify;
  encryptToken: typeof encryptToken;
  envGet: (key: string) => string | undefined;
  importKey: typeof crypto.subtle.importKey;
  fetch: typeof globalThis.fetch;
  waitUntil: (promise: Promise<unknown>) => void;
}

const defaultDependencies: MigrationsOAuthCallbackDependencies = {
  createClient,
  verifyJwt: verify,
  encryptToken,
  envGet: (key) => Deno.env.get(key),
  importKey: crypto.subtle.importKey.bind(crypto.subtle),
  fetch: globalThis.fetch.bind(globalThis),
  waitUntil: (promise) => EdgeRuntime.waitUntil(promise),
};

export async function handleMigrationsOAuthCallback(
  req: Request,
  deps: MigrationsOAuthCallbackDependencies = defaultDependencies,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Declare outside try block so redirect context is available in catch.
  let appOriginFromState: string | undefined;
  let providerFromClaims: string | undefined;
  let providerFromQuery: string | undefined;
  let providerFromRawState: string | undefined;

  try {
    // Parse query parameters from the URL (OAuth callback is a GET request)
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    providerFromQuery = url.searchParams.get("provider") ?? undefined;
    providerFromRawState = getStringValue(decodeJwtPayload(state), "provider");
    let provider = resolveProvider(providerFromRawState, providerFromQuery);

    if (!code || !state) {
      throw new Error("Missing required parameters: code and state");
    }

    // OAuth callback doesn't have Authorization header - use service role
    const supabase = deps.createClient(
      deps.envGet("SUPABASE_URL") ?? "",
      deps.envGet("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    // Validate encryption key is configured before proceeding
    try {
      assertEncryptionKeyConfigured();
    } catch (error: any) {
      console.error(
        "[migrations-oauth-callback] Missing encryption key:",
        error.message,
      );
      throw new Error(
        "TOKEN_ENCRYPTION_KEY not configured. Please contact support.",
      );
    }

    // Verify signed JWT state
    let claims: any;
    const secret = deps.envGet("OAUTH_STATE_SECRET");
    if (!secret) {
      throw new Error("OAUTH_STATE_SECRET not configured");
    }

    try {
      const encoder = new TextEncoder();
      const key = await deps.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );

      claims = await deps.verifyJwt(state, key);
    } catch (e) {
      console.error("[migrations-oauth-callback] JWT verification failed:", e);
      throw new Error("Invalid or expired state token");
    }

    // Override provider from claims and derive redirectUri/user/tenant
    providerFromClaims =
      typeof claims?.provider === "string" ? claims.provider : undefined;
    provider = resolveProvider(
      providerFromClaims,
      providerFromRawState,
      providerFromQuery,
    );
    const redirectUri = claims?.redirectUri as string;
    appOriginFromState = claims?.appOrigin as string | undefined;
    const uid = claims?.uid as string;

    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", uid)
      .maybeSingle();

    if (userErr || !userRow?.tenant_id) {
      throw new Error("User or tenant not found for state");
    }

    const user_id = uid;
    const tenant_id = userRow.tenant_id;

    // Get OAuth credentials
    const clientId = deps.envGet(`${provider.toUpperCase()}_CLIENT_ID`);
    const clientSecret = deps.envGet(`${provider.toUpperCase()}_CLIENT_SECRET`);
    if (!clientId || !clientSecret) {
      throw new Error("OAuth credentials not configured");
    }
    // redirectUri is derived from verified state claims

    // Exchange code for tokens
    let tokenUrl = "";
    let tokenData: any = null;

    if (provider === "mailchimp") {
      tokenUrl = "https://login.mailchimp.com/oauth2/token";
      const response = await deps.fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      });
      tokenData = await response.json();
    } else if (provider === "klaviyo") {
      tokenUrl = "https://a.klaviyo.com/oauth/token";
      const response = await deps.fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      });
      tokenData = await response.json();
    } else if (provider === "constant_contact") {
      tokenUrl = "https://authz.constantcontact.com/oauth2/default/v1/token";
      const basicAuth = btoa(`${clientId}:${clientSecret}`);
      const response = await deps.fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
          code,
        }),
      });
      tokenData = await response.json();
      console.log(
        "[migrations-oauth-callback] Constant Contact token response:",
        JSON.stringify(tokenData),
      );
    }

    if (!tokenData.access_token) {
      console.error("[migrations-oauth-callback] Token exchange failed:", {
        provider,
        error: tokenData.error,
        error_description: tokenData.error_description,
        response: JSON.stringify(tokenData),
      });
      throw new Error(
        `Failed to obtain access token: ${tokenData.error_description || tokenData.error || "Unknown error"}`,
      );
    }

    // Encrypt access token before storing
    let encryptedToken: string;
    try {
      encryptedToken = await deps.encryptToken(tokenData.access_token);
      console.log(`[migrations-oauth-callback] Token encrypted successfully`);
    } catch (error: any) {
      console.error(
        "[migrations-oauth-callback] Encryption failed:",
        error.message,
      );
      throw new Error("Failed to encrypt token");
    }

    // Fetch account info
    let accountInfo: any = {};
    if (provider === "mailchimp") {
      const metadataRes = await deps.fetch(
        "https://login.mailchimp.com/oauth2/metadata",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );
      accountInfo = await metadataRes.json();
    } else if (provider === "klaviyo") {
      const accountRes = await deps.fetch(
        "https://a.klaviyo.com/api/accounts/",
        {
          headers: {
            Authorization: `Klaviyo-OAuth ${tokenData.access_token}`,
            revision: "2024-10-15",
            Accept: "application/json",
          },
        },
      );
      const accData = await accountRes.json();
      accountInfo = accData.data?.[0]?.attributes || {};
    } else if (provider === "constant_contact") {
      const accountRes = await deps.fetch(
        "https://api.cc.email/v3/account/summary",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            Accept: "application/json",
          },
        },
      );
      const accData = await accountRes.json();
      accountInfo = {
        account_id: accData.encoded_account_id,
        name:
          accData.organization_name ||
          accData.first_name + " " + accData.last_name,
        email: accData.contact_email,
        ...accData,
      };
      console.log(
        "[migrations-oauth-callback] Constant Contact account info:",
        JSON.stringify(accountInfo),
      );
    }

    // Also store refresh token for Constant Contact (it uses offline_access)
    let encryptedRefreshToken: string | null = null;
    if (tokenData.refresh_token) {
      try {
        encryptedRefreshToken = await deps.encryptToken(
          tokenData.refresh_token,
        );
        console.log(
          `[migrations-oauth-callback] Refresh token encrypted successfully`,
        );
      } catch (error: any) {
        console.error(
          "[migrations-oauth-callback] Refresh token encryption failed:",
          error.message,
        );
      }
    }

    // Update connection with encrypted tokens (update existing tenant+provider row if present)
    const { data: existingConn, error: findConnErr } = await supabase
      .from("provider_connections")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("provider", provider)
      .maybeSingle();

    if (findConnErr) {
      console.error(
        "[migrations-oauth-callback] Find connection error:",
        findConnErr,
      );
    }

    if (existingConn) {
      const updatePayload: any = {
        status: "connected",
        encrypted_access_token: encryptedToken,
        provider_account_id: accountInfo.id || accountInfo.account_id || "",
        provider_account_name:
          accountInfo.accountname || accountInfo.name || "",
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        metadata: accountInfo,
        connected_at: new Date().toISOString(),
      };
      if (encryptedRefreshToken) {
        updatePayload.encrypted_refresh_token = encryptedRefreshToken;
      }
      const { error: updateConnErr } = await supabase
        .from("provider_connections")
        .update(updatePayload)
        .eq("id", existingConn.id);
      if (updateConnErr) {
        console.error(
          "[migrations-oauth-callback] Update connection error:",
          updateConnErr,
        );
      }
    } else {
      const insertPayload: any = {
        tenant_id,
        user_id,
        provider,
        status: "connected",
        encrypted_access_token: encryptedToken,
        provider_account_id: accountInfo.id || accountInfo.account_id || "",
        provider_account_name:
          accountInfo.accountname || accountInfo.name || "",
        token_expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        metadata: accountInfo,
        connected_at: new Date().toISOString(),
      };
      if (encryptedRefreshToken) {
        insertPayload.encrypted_refresh_token = encryptedRefreshToken;
      }
      const { error: insertConnErr } = await supabase
        .from("provider_connections")
        .insert(insertPayload);
      if (insertConnErr) {
        console.error(
          "[migrations-oauth-callback] Insert connection error:",
          insertConnErr,
        );
      }
    }

    console.log(
      `[migrations-oauth-callback] Successfully connected ${provider} for user ${user_id}`,
    );

    if (provider === "mailchimp") {
      deps.waitUntil(
        (async () => {
          try {
            const { data, error } = await supabase.functions.invoke(
              "mailchimp-fetch-lists",
              {
                body: {
                  tenant_id,
                  user_id,
                  preCache: true,
                },
              },
            );

            if (error) {
              console.warn(
                "[migrations-oauth-callback] Mailchimp list pre-cache failed:",
                error.message,
              );
              return;
            }

            if (data?.error) {
              console.warn(
                "[migrations-oauth-callback] Mailchimp list pre-cache failed:",
                data.error,
              );
            }
          } catch (preCacheError: any) {
            console.warn(
              "[migrations-oauth-callback] Mailchimp list pre-cache failed:",
              preCacheError?.message || preCacheError,
            );
          }
        })(),
      );
    }

    // Redirect to app route so the SPA handles closing and messaging
    const appOrigin =
      appOriginFromState ||
      deps.envGet("APP_ORIGIN") ||
      deps.envGet("APP_BASE_URL") ||
      "https://bloomsuite.app";
    const redirectUrl = buildCallbackRedirectUrl({
      appOrigin,
      provider,
      status: "success",
    });
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl },
    });
  } catch (error: any) {
    console.error("[migrations-oauth-callback] Error:", error);
    const provider = resolveProvider(
      providerFromClaims,
      providerFromRawState,
      providerFromQuery,
    );
    const appOrigin =
      appOriginFromState ||
      deps.envGet("APP_ORIGIN") ||
      deps.envGet("APP_BASE_URL") ||
      "https://bloomsuite.app";
    const redirectUrl = buildCallbackRedirectUrl({
      appOrigin,
      provider,
      status: "error",
      message:
        typeof error?.message === "string" && error.message.trim().length > 0
          ? error.message
          : "Connection failed",
    });
    return new Response(null, {
      status: 302,
      headers: { ...corsHeaders, Location: redirectUrl },
    });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMigrationsOAuthCallback(req));
}
