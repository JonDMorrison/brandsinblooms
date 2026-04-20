import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import {
  detectEnvironment,
  resolveFacebookCredentials,
} from "../_shared/environment.ts";

type ProviderIntent = "facebook" | "instagram";

interface ProviderResults {
  facebook: {
    connected: boolean;
    pages: Array<{ id: string; name: string }>;
    error: string | null;
  };
  instagram: {
    connected: boolean;
    accounts: Array<{ id: string; username: string }>;
    error: string | null;
    errorCode: string | null;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function parseProviderIntent(state: string | null | undefined): ProviderIntent {
  if (!state) return "facebook";

  const parts = state.split("::");
  if (parts.length >= 3) {
    const providerIntent = parts[1];
    if (providerIntent === "facebook" || providerIntent === "instagram") {
      return providerIntent;
    }
  }

  return "facebook";
}

function buildProviderResults(): ProviderResults {
  return {
    facebook: {
      connected: false,
      pages: [],
      error: null,
    },
    instagram: {
      connected: false,
      accounts: [],
      error: null,
      errorCode: null,
    },
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    console.log("📋 Handling CORS preflight request");
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("🚀 OAuth exchange function started:", {
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString(),
    headers: Object.fromEntries(req.headers.entries()),
  });

  let requestBody: {
    code?: string;
    state?: string;
    redirect_uri?: string;
  } | null = null;
  let authenticatedUserId: string | null = null;
  let lastCodeHash: string | null = null;

  try {
    requestBody = await req.json();
    const { code, state, redirect_uri } = requestBody;
    const providerIntent = parseProviderIntent(state);
    const providerResults = buildProviderResults();

    console.log("🔄 OAuth exchange request received:", {
      code: code ? `present (${code.substring(0, 10)}...)` : "missing",
      state: state ? `present (${state.substring(0, 8)}...)` : "missing",
      providerIntent,
      redirect_uri,
      requestBody,
      contentLength: req.headers.get("content-length"),
      contentType: req.headers.get("content-type"),
    });

    if (!code) {
      console.error("❌ Missing authorization code");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authorization code is required",
          providerIntent,
          providerResults,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!state) {
      console.error("❌ Missing state parameter");
      return new Response(
        JSON.stringify({
          success: false,
          error: "State parameter is required",
          providerIntent,
          providerResults,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!redirect_uri) {
      console.error("❌ Missing redirect URI");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Redirect URI is required",
          providerIntent,
          providerResults,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("❌ No authorization header provided");
      throw new Error("Authorization header required");
    }

    const jwt = authHeader.replace("Bearer ", "");

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);

    if (userError || !user) {
      console.error("❌ User authentication failed:", userError);
      throw new Error("Invalid or expired token");
    }

    authenticatedUserId = user.id;

    console.log("✅ User authenticated:", {
      email: user.email,
      id: user.id.substring(0, 8) + "...",
    });

    const environment = detectEnvironment(req);
    const origin = req.headers.get("origin") || "";
    const referer = req.headers.get("referer") || "";

    console.log("🌍 Environment Detection (Backend):", {
      environment,
      origin,
      referer,
      redirectUriReceived: redirect_uri,
      expectedPattern:
        environment === "development"
          ? "https://*.lovableproject.com/auth/callback"
          : "https://bloomsuite.app/auth/callback",
      matches:
        environment === "development"
          ? redirect_uri.includes("lovableproject.com/auth/callback")
          : redirect_uri === "https://bloomsuite.app/auth/callback",
    });

    const credentialResolution = resolveFacebookCredentials(environment);

    for (const warning of credentialResolution.warnings) {
      console.warn(warning);
    }

    const expectedDevSecrets = {
      clientId: Deno.env.get("FB_CLIENT_ID_DEV"),
      clientSecret: Deno.env.get("FB_CLIENT_SECRET_DEV"),
    };
    const expectedProdSecrets = {
      clientId: Deno.env.get("FB_CLIENT_ID_PROD"),
      clientSecret: Deno.env.get("FB_CLIENT_SECRET_PROD"),
    };
    const legacySecrets = {
      clientId: Deno.env.get("FB_CLIENT_ID"),
      clientSecret: Deno.env.get("FB_CLIENT_SECRET"),
    };

    console.log("🔑 Secret Availability Check:", {
      detectedEnvironment: environment,
      devSecretsAvailable: {
        clientId: !!expectedDevSecrets.clientId,
        clientSecret: !!expectedDevSecrets.clientSecret,
      },
      prodSecretsAvailable: {
        clientId: !!expectedProdSecrets.clientId,
        clientSecret: !!expectedProdSecrets.clientSecret,
      },
      legacySecretsAvailable: {
        clientId: !!legacySecrets.clientId,
        clientSecret: !!legacySecrets.clientSecret,
      },
      credentialsReturnedByResolver: {
        clientId: !!credentialResolution.clientId,
        clientSecret: !!credentialResolution.clientSecret,
        clientIdPreview: credentialResolution.clientId
          ? `${credentialResolution.clientId.substring(0, 10)}...`
          : null,
      },
      expectedSuffix: environment === "development" ? "_DEV" : "_PROD",
    });

    const finalClientId = credentialResolution.clientId;
    const finalClientSecret = credentialResolution.clientSecret;
    const allEnvKeys = Object.keys(Deno.env.toObject()).filter((key) =>
      key.includes("FB"),
    );

    console.log("🔑 All Facebook-related environment variables:", allEnvKeys);
    console.log("🔑 Final Credentials Selection:", {
      environment,
      clientIdSource: credentialResolution.clientIdSource || "NONE",
      clientSecretSource: credentialResolution.clientSecretSource || "NONE",
      finalClientIdPresent: !!finalClientId,
      finalClientSecretPresent: !!finalClientSecret,
      finalClientIdPreview: finalClientId?.substring(0, 10) + "...",
      supabaseUrl: Deno.env.get("SUPABASE_URL") ? "present" : "missing",
      serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
        ? "present"
        : "missing",
      allEnvVarCount: Object.keys(Deno.env.toObject()).length,
    });

    console.log(
      `📋 OAuth exchange credentials: env=${environment}, clientId=${finalClientId?.substring(0, 6) || "missing"}..., clientIdSource=${credentialResolution.clientIdSource || "missing"}, clientSecretSource=${credentialResolution.clientSecretSource || "missing"}`,
    );

    if (!finalClientId || !finalClientSecret) {
      const isProduction = environment === "production";
      const errorMessage = isProduction
        ? "Facebook OAuth credentials are not configured for the production environment. Please contact support."
        : `Facebook/Instagram app credentials not configured for ${environment}. Missing: ${!finalClientId ? "FB_CLIENT_ID " : ""}${!finalClientSecret ? "FB_CLIENT_SECRET" : ""}. Please add these to your Supabase Edge Function secrets.`;
      console.error(`❌ Missing Facebook credentials for ${environment}:`, {
        clientId: finalClientId ? "present" : "MISSING",
        clientSecret: finalClientSecret ? "present" : "MISSING",
        availableEnvKeys: allEnvKeys,
        errorMessage,
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          stage: "credentials",
          providerIntent,
          providerResults,
          debug: {
            environment,
            availableEnvKeys: allEnvKeys,
            clientIdPresent: !!finalClientId,
            clientSecretPresent: !!finalClientSecret,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log(
      "🔗 Starting OAuth token exchange for user:",
      user.id.substring(0, 8) + "...",
    );
    console.log("🔄 Token Exchange Request Details:", {
      tokenEndpoint: "https://graph.facebook.com/v19.0/oauth/access_token",
      clientId: finalClientId.substring(0, 10) + "...",
      redirectUriUsed: redirect_uri,
      redirectUriSource: "from frontend request body",
      codePresent: !!code,
      codeLength: code.length,
      environment,
      providerIntent,
      timestamp: new Date().toISOString(),
    });

    const { data: existingConnections } = await supabase
      .from("social_connections")
      .select(
        "id, platform, platform_account_id, platform_account_name, username, is_active",
      )
      .eq("user_id", user.id)
      .in("platform", ["facebook", "instagram"])
      .eq("is_active", true)
      .is("deleted_at", null);

    const existingFacebookConnections = (existingConnections || []).filter(
      (connection) => connection.platform === "facebook",
    );
    const existingInstagramConnections = (existingConnections || []).filter(
      (connection) => connection.platform === "instagram",
    );

    providerResults.facebook.pages = existingFacebookConnections.map(
      (connection) => ({
        id: connection.platform_account_id,
        name:
          connection.platform_account_name || connection.platform_account_id,
      }),
    );
    providerResults.facebook.connected =
      providerResults.facebook.pages.length > 0;
    providerResults.instagram.accounts = existingInstagramConnections.map(
      (connection) => ({
        id: connection.platform_account_id,
        username:
          connection.username ||
          connection.platform_account_name ||
          connection.platform_account_id,
      }),
    );
    providerResults.instagram.connected =
      providerResults.instagram.accounts.length > 0;

    if (
      (providerIntent === "facebook" &&
        existingFacebookConnections.length > 0) ||
      (providerIntent === "instagram" &&
        existingInstagramConnections.length > 0)
    ) {
      console.log("✅ Active connections already exist for this user:", {
        count: existingConnections?.length || 0,
        platforms: (existingConnections || []).map(
          (connection) => connection.platform,
        ),
        providerIntent,
      });

      return new Response(
        JSON.stringify({
          success: true,
          connections: existingConnections,
          providerIntent,
          providerResults,
          message:
            providerIntent === "instagram"
              ? `Instagram already connected (${existingInstagramConnections.length} active connection${existingInstagramConnections.length !== 1 ? "s" : ""})`
              : `Facebook already connected (${existingFacebookConnections.length} active connection${existingFacebookConnections.length !== 1 ? "s" : ""})`,
          idempotent: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const codeHash = btoa(code);
    lastCodeHash = codeHash;

    const { data: existingCodeCheck } = await supabase
      .from("oauth_code_usage")
      .select("id, used_at, user_id")
      .eq("code_hash", codeHash)
      .single();

    if (existingCodeCheck) {
      const usedAgo =
        Date.now() - new Date(existingCodeCheck.used_at).getTime();
      const minutesAgo = Math.floor(usedAgo / 60000);

      console.warn("⚠️ Authorization code already used:", {
        codeHash: codeHash.substring(0, 10) + "...",
        usedAt: existingCodeCheck.used_at,
        minutesAgo,
        sameUser: existingCodeCheck.user_id === user.id,
      });

      if (minutesAgo > 5) {
        console.log(
          "🧹 Cleaning up stale OAuth attempt (>5 min old, no connections created)",
        );
        await supabase
          .from("oauth_code_usage")
          .delete()
          .eq("id", existingCodeCheck.id);

        console.log("✅ Stale code cleaned up, allowing retry...");
      } else {
        throw new Error(
          "This authorization code has already been used. Please try connecting again.",
        );
      }
    }

    const { data: codeUsageData, error: markUsedError } = await supabase
      .from("oauth_code_usage")
      .insert({
        user_id: user.id,
        code_hash: codeHash,
        used_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (markUsedError) {
      console.error("❌ Failed to mark code as used:", markUsedError);
      if (markUsedError.code === "23505") {
        console.warn(
          "⚠️ Duplicate code usage detected via constraint violation",
        );
        throw new Error(
          "This authorization code has already been used. Please try connecting again.",
        );
      }

      throw new Error(
        "Failed to track authorization code usage. Please try again.",
      );
    }

    console.log("✅ Code marked as used:", {
      codeUsageId: codeUsageData?.id || null,
    });

    const tokenParams = new URLSearchParams({
      client_id: finalClientId,
      client_secret: finalClientSecret,
      redirect_uri,
      code,
    });

    console.log(
      `📡 Sending token exchange request to Facebook (${environment})...`,
      {
        url: "https://graph.facebook.com/v19.0/oauth/access_token",
        method: "POST",
        hasParams: true,
      },
    );

    const tokenResponse = await fetch(
      "https://graph.facebook.com/v19.0/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: tokenParams,
      },
    );

    const tokenData = await tokenResponse.json();
    console.log("📬 Token response received:", {
      status: tokenResponse.status,
      ok: tokenResponse.ok,
      hasAccessToken: !!tokenData.access_token,
      hasError: !!tokenData.error,
      errorType: tokenData.error?.type,
      errorMessage: tokenData.error?.message,
    });

    if (!tokenResponse.ok) {
      console.error("❌ Token exchange failed:", {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: tokenData,
      });

      let errorMessage = `Token exchange failed (${tokenResponse.status})`;
      if (
        tokenData.error?.message?.includes(
          "This authorization code has been used",
        )
      ) {
        errorMessage =
          "This authorization code has already been used. Please try connecting again.";
      } else if (tokenData.error?.message?.includes("authorization code")) {
        errorMessage =
          "Invalid or expired authorization code. Please try connecting again.";
      } else if (tokenData.error?.message) {
        errorMessage = tokenData.error.message;
      }

      throw new Error(errorMessage);
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      throw new Error("No access token received from Facebook");
    }

    console.log("✅ Successfully obtained access token");

    console.log("👤 Fetching Facebook user data...");
    const userResponse = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`,
    );
    const userData = await userResponse.json();

    if (!userResponse.ok) {
      console.error("❌ Failed to get user data:", userData);
      throw new Error(
        `Failed to get user data (${userResponse.status}): ${JSON.stringify(userData)}`,
      );
    }

    console.log("✅ Retrieved Facebook user data:", {
      name: userData.name,
      id: userData.id,
    });

    console.log("📄 Fetching Facebook pages and Instagram accounts...");
    console.log(
      "📡 Access token preview:",
      accessToken.substring(0, 15) +
        "..." +
        accessToken.substring(accessToken.length - 5),
    );

    const pagesResponse = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}`,
    );
    const pagesData = await pagesResponse.json();

    console.log("📬 Pages API Response:", {
      status: pagesResponse.status,
      ok: pagesResponse.ok,
      hasData: !!pagesData.data,
      dataLength: pagesData.data?.length || 0,
      hasError: !!pagesData.error,
      errorType: pagesData.error?.type,
      errorCode: pagesData.error?.code,
      errorMessage: pagesData.error?.message,
      errorSubcode: pagesData.error?.error_subcode,
      fullError: pagesData.error,
      rawResponse: JSON.stringify(pagesData).substring(0, 500),
    });

    if (!pagesResponse.ok) {
      console.error("❌ Failed to fetch pages from Meta:", {
        status: pagesResponse.status,
        statusText: pagesResponse.statusText,
        error: pagesData.error,
        fullResponse: pagesData,
      });

      providerResults.facebook.error =
        "Failed to fetch Facebook Pages from Meta.";

      return new Response(
        JSON.stringify({
          success: false,
          stage: "fetch_pages",
          error: "Failed to fetch Facebook Pages from Meta.",
          providerIntent,
          providerResults,
          meta_error:
            pagesData.error?.message || "Unknown error from Facebook API",
          meta_error_code: pagesData.error?.code,
          meta_error_type: pagesData.error?.type,
          debug: {
            status: pagesResponse.status,
            errorDetails: pagesData.error,
          },
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const pageCount = pagesData.data?.length || 0;
    console.log(`📊 Found ${pageCount} pages to process`);

    if (pageCount === 0) {
      console.warn("⚠️ Meta returned 0 pages for this account");
      providerResults.facebook.error =
        "No Facebook Pages found for this account.";

      return new Response(
        JSON.stringify({
          success: false,
          stage: "no_pages",
          error: "No Facebook Pages found for this account.",
          message:
            "Meta did not return any Pages. Please ensure you are an admin on at least one Facebook Page and selected it during the connection process.",
          providerIntent,
          providerResults,
          retry: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const connections: any[] = [];
    let anyPageHadInstagramBusinessAccount = false;
    const instagramDetailErrors: string[] = [];
    const instagramSaveErrors: string[] = [];

    for (const page of pagesData.data || []) {
      console.log("🔄 Processing page:", page.name);
      console.log(
        `📷 Page "${page.name}" (${page.id}) — instagram_business_account: ${page.instagram_business_account ? `present (${page.instagram_business_account.id})` : "NOT LINKED"}`,
      );

      const { data: fbConnection, error: fbError } = await supabase
        .from("social_connections")
        .upsert(
          {
            user_id: user.id,
            platform: "facebook",
            platform_account_id: page.id,
            platform_account_name: page.name,
            page_id: page.id,
            access_token: page.access_token,
            expires_at: new Date(
              Date.now() + 60 * 24 * 60 * 60 * 1000,
            ).toISOString(),
            is_active: true,
          },
          {
            onConflict: "platform,platform_account_id,user_id",
          },
        )
        .select();

      if (fbError) {
        console.error("❌ Error saving Facebook connection:", fbError);
        providerResults.facebook.error = fbError.message;
      } else {
        console.log(
          "✅ Successfully saved Facebook connection for:",
          page.name,
        );
        providerResults.facebook.pages.push({ id: page.id, name: page.name });
        connections.push(fbConnection[0]);
      }

      if (page.instagram_business_account) {
        anyPageHadInstagramBusinessAccount = true;
        const igAccount = page.instagram_business_account;
        console.log("📷 Processing Instagram account:", igAccount.id);

        const igResponse = await fetch(
          `https://graph.facebook.com/v19.0/${igAccount.id}?fields=id,username&access_token=${page.access_token}`,
        );
        const igData = await igResponse.json();

        console.log("📷 Instagram detail response:", {
          pageId: page.id,
          instagramAccountId: igAccount.id,
          ok: igResponse.ok,
          status: igResponse.status,
          body: igData,
        });

        if (igResponse.ok) {
          const { data: igConnection, error: igError } = await supabase
            .from("social_connections")
            .upsert(
              {
                user_id: user.id,
                platform: "instagram",
                platform_account_id: igAccount.id,
                platform_account_name: igData.username || igAccount.id,
                username: igData.username,
                page_id: page.id,
                access_token: page.access_token,
                expires_at: new Date(
                  Date.now() + 60 * 24 * 60 * 60 * 1000,
                ).toISOString(),
                is_active: true,
              },
              {
                onConflict: "platform,platform_account_id,user_id",
              },
            )
            .select();

          console.log("📷 Instagram upsert result:", {
            pageId: page.id,
            instagramAccountId: igAccount.id,
            success: !igError,
            error: igError?.message || null,
          });

          if (igError) {
            console.error("❌ Error saving Instagram connection:", igError);
            instagramSaveErrors.push(igError.message);
          } else {
            console.log(
              "✅ Successfully saved Instagram connection for:",
              igData.username,
            );
            providerResults.instagram.accounts.push({
              id: igAccount.id,
              username: igData.username || igAccount.id,
            });
            connections.push(igConnection[0]);
          }
        } else {
          console.error("❌ Failed to get Instagram account details:", igData);
          instagramDetailErrors.push(
            igData?.error?.message || JSON.stringify(igData),
          );
        }
      }
    }

    providerResults.facebook.pages = dedupeById(providerResults.facebook.pages);
    providerResults.instagram.accounts = dedupeById(
      providerResults.instagram.accounts,
    );
    providerResults.facebook.connected =
      providerResults.facebook.pages.length > 0;
    providerResults.instagram.connected =
      providerResults.instagram.accounts.length > 0;

    if (
      !providerResults.facebook.connected &&
      !providerResults.facebook.error
    ) {
      providerResults.facebook.error =
        "Facebook connection could not be saved.";
    }

    if (
      providerIntent === "instagram" &&
      !providerResults.instagram.connected
    ) {
      if (!anyPageHadInstagramBusinessAccount) {
        providerResults.instagram.errorCode = "NO_IG_BUSINESS_ACCOUNT";
        providerResults.instagram.error =
          "No linked Instagram Business Account was found. Convert your Instagram account to a Business or Creator account, link it to a Facebook Page you manage, then return to BloomSuite and try connecting again.";
      } else if (instagramSaveErrors.length > 0) {
        providerResults.instagram.errorCode = "IG_SAVE_FAILED";
        providerResults.instagram.error = `Instagram account was discovered, but BloomSuite could not save it. ${instagramSaveErrors.join(" | ")}`;
      } else if (instagramDetailErrors.length > 0) {
        providerResults.instagram.errorCode = "IG_DETAIL_FETCH_FAILED";
        providerResults.instagram.error = `Instagram account was linked to the Facebook Page, but Meta did not return account details. ${instagramDetailErrors.join(" | ")}`;
      }

      console.log("📷 Instagram provider result failure:", {
        providerIntent,
        errorCode: providerResults.instagram.errorCode,
        error: providerResults.instagram.error,
        anyPageHadInstagramBusinessAccount,
        instagramDetailErrors,
        instagramSaveErrors,
      });
    }

    console.log(`🎉 Successfully processed ${connections.length} connections`);

    const success =
      providerIntent === "instagram"
        ? providerResults.instagram.connected
        : providerResults.facebook.connected;

    const message = success
      ? providerIntent === "instagram"
        ? `Successfully connected ${providerResults.instagram.accounts.length} Instagram account${providerResults.instagram.accounts.length !== 1 ? "s" : ""}`
        : `Successfully connected ${providerResults.facebook.pages.length} Facebook page${providerResults.facebook.pages.length !== 1 ? "s" : ""}`
      : providerIntent === "instagram"
        ? providerResults.instagram.error || "Instagram connection failed."
        : providerResults.facebook.error || "Facebook connection failed.";

    const responseBody = {
      success,
      connections,
      providerResults,
      providerIntent,
      user: userData,
      message,
      error: success ? null : message,
    };

    console.log("✅ Sending provider-aware response:", {
      success,
      providerIntent,
      facebookConnected: providerResults.facebook.connected,
      instagramConnected: providerResults.instagram.connected,
      instagramErrorCode: providerResults.instagram.errorCode,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("❌ Error in OAuth exchange:", {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    try {
      if (lastCodeHash && authenticatedUserId) {
        const { createClient } = await import("npm:@supabase/supabase-js@2");
        const cleanupSupabase = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        const { data: staleCode } = await cleanupSupabase
          .from("oauth_code_usage")
          .select("id")
          .eq("code_hash", lastCodeHash)
          .eq("user_id", authenticatedUserId)
          .single();

        if (staleCode) {
          console.log("🧹 Auto-cleaning stale OAuth code after error...");
          const { error: cleanupError } = await cleanupSupabase
            .from("oauth_code_usage")
            .delete()
            .eq("id", staleCode.id);

          if (cleanupError) {
            console.error("⚠️ Failed to clean up stale code:", cleanupError);
          } else {
            console.log("✅ Stale code cleaned up successfully");
          }
        }
      }
    } catch (cleanupErr) {
      console.error("⚠️ Cleanup attempt failed:", cleanupErr);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        retry: true,
        action:
          "Please try connecting again. The authorization has been reset.",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
