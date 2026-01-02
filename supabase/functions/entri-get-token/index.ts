import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Entri Application ID (publishable key, safe in response)
    // Can be set via ENTRI_APPLICATION_ID env var or defaults to 'bloomsuite'
    const ENTRI_APPLICATION_ID = Deno.env.get("ENTRI_APPLICATION_ID") || "bloomsuite";
    const ENTRI_SECRET_KEY = Deno.env.get("ENTRI_API_KEY");

    if (!ENTRI_APPLICATION_ID || ENTRI_APPLICATION_ID === "bloomsuite") {
      console.warn("[entri-get-token] ENTRI_APPLICATION_ID not set, using default 'bloomsuite'");
    }

    if (!ENTRI_SECRET_KEY) {
      console.error("[entri-get-token] ENTRI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Missing ENTRI_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[entri-get-token] Fetching JWT token with applicationId:", ENTRI_APPLICATION_ID);

    // Fetch JWT from Entri API
    const response = await fetch("https://api.goentri.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        applicationId: ENTRI_APPLICATION_ID,
        secret: ENTRI_SECRET_KEY,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[entri-get-token] Token fetch failed:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Entri token", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("[entri-get-token] Token fetched successfully");

    return new Response(
      JSON.stringify({ 
        token: data.auth_token,
        applicationId: ENTRI_APPLICATION_ID 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error: any) {
    console.error("[entri-get-token] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
