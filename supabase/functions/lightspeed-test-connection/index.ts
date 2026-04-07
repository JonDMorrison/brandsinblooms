import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
// FIX: [P14] - Replace insecure atob() with proper decryptToken
import { decryptToken } from "../_shared/crypto/tokens.ts";

function parseXSeriesPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return { isValid: false, count: 0, versionMax: null as number | null };
  }

  const record = payload as Record<string, unknown>;
  const count = Array.isArray(record.data) ? record.data.length : -1;
  const version =
    record.version && typeof record.version === "object"
      ? (record.version as Record<string, unknown>)
      : null;
  const versionMax =
    typeof version?.max === "number"
      ? version.max
      : typeof version?.max === "string"
        ? Number.parseInt(version.max, 10)
        : null;

  return {
    isValid: count >= 0,
    count: Math.max(count, 0),
    versionMax: Number.isFinite(versionMax as number) ? versionMax : null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: userData } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!userData?.tenant_id) {
      throw new Error("No tenant found");
    }

    // Get connection
    const { data: connection } = await supabaseClient
      .from("lightspeed_connections")
      .select("*")
      .eq("tenant_id", userData.tenant_id)
      .single();

    if (!connection) {
      throw new Error("No Lightspeed connection found");
    }

    // FIX: [P14] - Use proper decryptToken instead of atob()
    let usedLegacyPlaintextFallback = false;
    let accessToken: string;
    try {
      accessToken = await decryptToken(connection.encrypted_access_token);
    } catch {
      usedLegacyPlaintextFallback = true;
      console.warn(
        `[LS] Token for connection ${connection.id} appears unencrypted. Re-encryption required.`,
      );
      accessToken = connection.encrypted_access_token;
    }

    // Test the same customer endpoint contract used by the real sync worker.
    const response = await fetch(
      `https://${connection.domain_prefix}.retail.lightspeed.app/api/2.0/customers`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!response.ok) {
      throw new Error(`Connection probe failed with HTTP ${response.status}`);
    }

    const payload = await response.json();
    const parsed = parseXSeriesPayload(payload);
    if (!parsed.isValid) {
      throw new Error("Connection probe returned a non X-Series payload shape");
    }

    console.log("Connection probe successful for Lightspeed customer endpoint");

    return new Response(
      JSON.stringify({
        success: true,
        probeType: "customer-api-lite",
        isFullHealthCheck: false,
        message:
          "Customer endpoint is reachable. Use Lightspeed Diagnostics for full sync-path health.",
        tokenMode: usedLegacyPlaintextFallback
          ? "legacy_plaintext"
          : "encrypted",
        xSeriesPayload: true,
        connection: {
          retailerName: connection.retailer_name || "Unknown",
          domainPrefix: connection.domain_prefix,
          expiresAt: connection.expires_at,
          lastCustomerVersionCursor:
            connection.last_customer_version_cursor ?? null,
        },
        sampleCount: parsed.count,
        versionMax: parsed.versionMax,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Test connection error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
