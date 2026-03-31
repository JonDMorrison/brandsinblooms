import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import {
  decryptToken,
  assertEncryptionKeyConfigured,
} from "../_shared/crypto/tokens.ts";
import type { MailchimpConnectionCredentials } from "../_shared/mailchimp/types.ts";

// Fail fast if encryption key is not configured
if (import.meta.main) {
  try {
    assertEncryptionKeyConfigured();
  } catch (error: any) {
    console.error("[mailchimp-revoke-token] FATAL:", error.message);
  }
}

export interface MailchimpRevokeDependencies {
  createClient: typeof createClient;
  envGet: (key: string) => string | undefined;
  decryptToken: typeof decryptToken;
  fetch: typeof globalThis.fetch;
  now: () => string;
}

const defaultDependencies: MailchimpRevokeDependencies = {
  createClient,
  envGet: (key) => Deno.env.get(key),
  decryptToken,
  fetch: globalThis.fetch.bind(globalThis),
  now: () => new Date().toISOString(),
};

export async function handleMailchimpRevokeToken(
  req: Request,
  deps: MailchimpRevokeDependencies = defaultDependencies,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { provider } = await req.json();

    if (!provider || !["mailchimp", "klaviyo"].includes(provider)) {
      throw new Error("Invalid provider");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
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

    const adminSupabase = deps.createClient(
      deps.envGet("SUPABASE_URL") ?? "",
      deps.envGet("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    // Get provider connection with encrypted token
    const { data: userRecord, error: userError } = await adminSupabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (userError || !userRecord?.tenant_id) {
      throw new Error("Tenant not found");
    }

    const tenantId = userRecord.tenant_id;

    const { data: connection, error: connError } = await adminSupabase
      .from("provider_connections")
      .select("id, encrypted_access_token, metadata")
      .eq("provider", provider)
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .single();

    if (connError || !connection) {
      throw new Error("Provider connection not found");
    }

    let tokenRevoked = false;
    let revokeError = null;

    // Attempt to revoke token at provider's API
    if (connection.encrypted_access_token) {
      try {
        let accessToken: string;
        try {
          accessToken = await deps.decryptToken(
            connection.encrypted_access_token,
          );
        } catch (decryptError: any) {
          console.error(
            "[mailchimp-revoke-token] Decryption failed:",
            decryptError.message,
          );
          throw new Error("Failed to decrypt token");
        }

        if (provider === "mailchimp") {
          // Mailchimp OAuth2 token revocation
          // https://mailchimp.com/developer/marketing/guides/access-user-data-oauth-2/#revoke-access
          const revokeResponse = await deps.fetch(
            "https://login.mailchimp.com/oauth2/revoke",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                token: accessToken,
                token_type_hint: "access_token",
              }),
            },
          );

          if (!revokeResponse.ok) {
            throw new Error(
              `Mailchimp revocation failed: ${revokeResponse.statusText}`,
            );
          }
          tokenRevoked = true;
        } else if (provider === "klaviyo") {
          // Klaviyo doesn't have a revocation endpoint - token is simply deleted
          // The token becomes invalid once removed from storage
          tokenRevoked = true;
        }
      } catch (error: any) {
        console.error("Token revocation error:", error);
        revokeError = error.message;
        // Continue to update database even if revocation fails
        // (token might already be invalid)
      }
    }

    // Update provider connection in database
    const { error: updateError } = await adminSupabase
      .from("provider_connections")
      .update({
        status: "revoked",
        revoked_at: deps.now(),
        encrypted_access_token: null, // Clear the token
      })
      .eq("id", connection.id)
      .eq("tenant_id", tenantId);

    if (updateError) {
      throw new Error(`Failed to update connection: ${updateError.message}`);
    }

    const { error: artifactDeleteError } = await adminSupabase
      .from("provider_artifacts")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("provider", provider);

    if (artifactDeleteError) {
      throw new Error(
        `Failed to clear provider artifacts: ${artifactDeleteError.message}`,
      );
    }

    const { error: pendingJobsError } = await adminSupabase
      .from("import_jobs")
      .update({
        status: "failed",
        error_details: "Provider disconnected",
        current_stage: "Error: Provider disconnected",
      })
      .eq("tenant_id", tenantId)
      .eq("provider", provider)
      .eq("status", "pending");

    if (pendingJobsError) {
      throw new Error(
        `Failed to fail pending import jobs: ${pendingJobsError.message}`,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenRevoked,
        message: revokeError
          ? `Connection removed (token revocation warning: ${revokeError})`
          : "Provider disconnected successfully",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: any) {
    console.error("Revoke token error:", error);
    return new Response(
      JSON.stringify({
        error: true,
        message: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleMailchimpRevokeToken(req));
}
