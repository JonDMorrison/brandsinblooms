import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decryptToken,
  assertEncryptionKeyConfigured,
} from "../_shared/crypto/tokens.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fail fast if encryption key is not configured
try {
  assertEncryptionKeyConfigured();
} catch (error: any) {
  console.error("[constant-contact-fetch-lists] FATAL:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      console.error(
        "[constant-contact-fetch-lists] No Authorization header found",
      );
      throw new Error("Missing Authorization header");
    }

    console.log("[constant-contact-fetch-lists] Auth header present");

    // Create client for auth verification
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Get JWT token from header
    const token = authHeader.replace("Bearer ", "");

    // Use service role to verify and get user
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Verify token and get user
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);

    if (authError) {
      console.error("[constant-contact-fetch-lists] Auth error:", authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!user) {
      console.error(
        "[constant-contact-fetch-lists] No user found after auth check",
      );
      throw new Error("User not authenticated");
    }

    console.log("[constant-contact-fetch-lists] User authenticated:", user.id);

    const { data: userRecord } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    const tenantId = userRecord?.tenant_id;
    if (!tenantId) {
      throw new Error("Tenant not found");
    }

    // Get connection using service role
    const { data: connection, error: connectionError } = await supabase
      .from("provider_connections")
      .select("encrypted_access_token, metadata")
      .eq("user_id", user.id)
      .eq("provider", "constant_contact")
      .eq("status", "connected")
      .single();

    if (connectionError) {
      console.error(
        "[constant-contact-fetch-lists] Connection query error:",
        connectionError,
      );
      throw new Error(`Failed to fetch connection: ${connectionError.message}`);
    }

    if (!connection?.encrypted_access_token) {
      throw new Error("Constant Contact not connected or token missing");
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch (error: any) {
      console.error(
        "[constant-contact-fetch-lists] Decryption failed:",
        error.message,
      );
      throw new Error(
        "Failed to decrypt access token. Please reconnect Constant Contact.",
      );
    }

    // Fetch contact lists from Constant Contact API
    const listsRes = await fetch(
      "https://api.cc.email/v3/contact_lists?include_count=true&limit=500",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      },
    );

    if (!listsRes.ok) {
      const errorText = await listsRes.text();
      console.error(
        "[constant-contact-fetch-lists] API error:",
        listsRes.status,
        errorText,
      );
      throw new Error(`Constant Contact API error: ${listsRes.status}`);
    }

    const listsData = await listsRes.json();

    // Transform to common format
    const lists = (listsData.lists || []).map((list: any) => ({
      id: list.list_id,
      name: list.name,
      member_count: list.membership_count || 0,
      description: list.description || "",
      created_at: list.created_at,
      updated_at: list.updated_at,
    }));

    const { data: existingCacheJob } = await supabase
      .from("import_jobs")
      .select("id, config")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .eq("provider", "constant_contact")
      .order("created_at", { ascending: false })
      .limit(20);

    const cacheJobId = existingCacheJob?.find(
      (job: any) => job?.config?.artifact_cache === true,
    )?.id;
    let importJobId = cacheJobId;

    if (!importJobId) {
      const hiddenTimestamp = new Date(0).toISOString();
      const { data: insertedCacheJob } = await supabase
        .from("import_jobs")
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          provider: "constant_contact",
          status: "completed",
          config: {
            artifact_cache: true,
            hidden: true,
            generated_by: "constant-contact-fetch-lists",
          },
          report: null,
          completed_at: hiddenTimestamp,
          created_at: hiddenTimestamp,
          updated_at: hiddenTimestamp,
        })
        .select("id")
        .single();

      importJobId = insertedCacheJob?.id;
    }

    if (importJobId && lists.length > 0) {
      await supabase.from("provider_artifacts").upsert(
        lists.map((list: any) => ({
          import_job_id: importJobId,
          tenant_id: tenantId,
          provider: "constant_contact",
          artifact_type: "list",
          external_id: list.id,
          name: list.name,
          member_count: list.member_count || 0,
          data: list,
        })),
        {
          onConflict: "tenant_id,provider,artifact_type,external_id",
        },
      );
    }

    console.log(`[constant-contact-fetch-lists] Fetched ${lists.length} lists`);

    return new Response(
      JSON.stringify({ lists, totalLists: lists.length, totalSegments: 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[constant-contact-fetch-lists] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
