import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MOBILE_TEXT_ALERTS_BASE_URL = Deno.env.get("MOBILE_TEXT_ALERTS_BASE_URL") || "https://api.mobile-text-alerts.com";
const MOBILE_TEXT_ALERTS_API_KEY = Deno.env.get("MOBILE_TEXT_ALERTS_API_KEY");

/**
 * Debug endpoint to fetch dedicated numbers from Mobile Text Alerts.
 * Use this to find the correct longcodeId for 866-587-8406.
 * 
 * GET /mta-debug-numbers - returns list of dedicated numbers with their IDs
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Check API key
    if (!MOBILE_TEXT_ALERTS_API_KEY) {
      throw new Error("MOBILE_TEXT_ALERTS_API_KEY is not configured");
    }

    // Verify user is authenticated (admin check)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    console.log(`[mta-debug-numbers] User ${user.id} requesting dedicated numbers list`);

    // Fetch dedicated numbers
    const response = await fetch(`${MOBILE_TEXT_ALERTS_BASE_URL}/v3/dedicated-numbers`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${MOBILE_TEXT_ALERTS_API_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const contentType = response.headers.get("content-type");
    const text = await response.text();
    let json: any = null;

    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    console.log(`[mta-debug-numbers] Response (HTTP ${response.status}):`, JSON.stringify(json ?? { raw: text.substring(0, 500) }));

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          status: response.status,
          error: json?.message || json?.error || text.substring(0, 200),
        }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the dedicated numbers data
    return new Response(
      JSON.stringify({
        success: true,
        data: json,
        hint: "Look for the number 866-587-8406 and note its 'id' field - that's the longcodeId",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[mta-debug-numbers] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
