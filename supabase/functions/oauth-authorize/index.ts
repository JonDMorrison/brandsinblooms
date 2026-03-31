import { createClient } from "npm:@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PROVIDER_REQUIRED_SECRETS: Record<string, string[]> = {
  mailchimp: ["MAILCHIMP_CLIENT_ID", "MAILCHIMP_CLIENT_SECRET"],
  klaviyo: ["KLAVIYO_CLIENT_ID", "KLAVIYO_CLIENT_SECRET"],
  constant_contact: [
    "CONSTANT_CONTACT_CLIENT_ID",
    "CONSTANT_CONTACT_CLIENT_SECRET",
  ],
};

export interface OAuthAuthorizeDependencies {
  createClient: typeof createClient;
  envGet: (key: string) => string | undefined;
  createJwt: typeof create;
  getNumericDate: typeof getNumericDate;
  randomUUID: () => string;
  importKey: typeof crypto.subtle.importKey;
}

const defaultDependencies: OAuthAuthorizeDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  createJwt: create,
  getNumericDate,
  randomUUID: () => crypto.randomUUID(),
  importKey: crypto.subtle.importKey.bind(crypto.subtle),
};

export async function handleOAuthAuthorize(
  req: Request,
  deps: OAuthAuthorizeDependencies = defaultDependencies,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();

    if (!["mailchimp", "klaviyo", "constant_contact"].includes(provider)) {
      throw new Error("Invalid provider");
    }

    const requiredSecrets = [
      "OAUTH_STATE_SECRET",
      ...(PROVIDER_REQUIRED_SECRETS[provider] ?? []),
    ];
    for (const key of requiredSecrets) {
      if (!deps.envGet(key)) {
        return new Response(
          JSON.stringify({ error: `Missing required secret: ${key}` }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
          },
        );
      }
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Authentication required. Please log in and try again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const supabase = deps.createClient(
      deps.envGet("SUPABASE_URL") ?? "",
      deps.envGet("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (!user || authError) {
      return new Response(
        JSON.stringify({
          error: true,
          message: "Invalid or expired session. Please log in again.",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    // Get tenant_id
    const { data: userData } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error("No tenant found for user");
    }

    // Get OAuth credentials from environment
    const clientId = deps.envGet(`${provider.toUpperCase()}_CLIENT_ID`);

    if (!clientId) {
      return new Response(
        JSON.stringify({
          error: `Missing required secret: ${provider.toUpperCase()}_CLIENT_ID`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // Build callback redirect URI
    const redirectUri = `${deps.envGet("SUPABASE_URL")}/functions/v1/migrations-oauth-callback?provider=${provider}`;

    // Determine app origin (for popup redirect back to SPA)
    const requestOrigin =
      req.headers.get("origin") || req.headers.get("referer") || "";
    const appOrigin = requestOrigin
      ? new URL(requestOrigin).origin
      : deps.envGet("APP_ORIGIN") ||
        deps.envGet("APP_BASE_URL") ||
        "https://bloomsuite.app";

    // Create signed JWT state (no DB writes)
    const secret = deps.envGet("OAUTH_STATE_SECRET");
    if (!secret) {
      return new Response(
        JSON.stringify({
          error: "Missing required secret: OAUTH_STATE_SECRET",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    const encoder = new TextEncoder();
    const key = await deps.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );

    const statePayload = {
      uid: user.id,
      provider,
      nonce: deps.randomUUID(),
      ts: Date.now(),
      redirectUri,
      appOrigin,
      exp: deps.getNumericDate(60 * 10), // 10 minutes
    };

    const state = await deps.createJwt(
      { alg: "HS256", typ: "JWT" },
      statePayload as Record<string, unknown>,
      key,
    );

    // Build OAuth URL
    let authUrl = "";
    if (provider === "mailchimp") {
      authUrl =
        `https://login.mailchimp.com/oauth2/authorize?` +
        `response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    } else if (provider === "klaviyo") {
      authUrl =
        `https://www.klaviyo.com/oauth/authorize?` +
        `response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=lists:read accounts:read`;
    } else if (provider === "constant_contact") {
      authUrl =
        `https://authz.constantcontact.com/oauth2/default/v1/authorize?` +
        `response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=contact_data+offline_access+account_read`;
    }

    console.log(`[oauth-authorize] Generated auth URL for ${provider}`);

    return new Response(JSON.stringify({ authUrl, state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[oauth-authorize] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleOAuthAuthorize(req));
}
