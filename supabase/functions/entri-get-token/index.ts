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
    const ENTRI_APPLICATION_ID = "bloomsuite";
    const ENTRI_SECRET_KEY = Deno.env.get("ENTRI_API_KEY");

    if (!ENTRI_SECRET_KEY) {
      console.error("ENTRI_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Entri not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Fetching Entri JWT token...");

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
      console.error("Entri token fetch failed:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch Entri token", details: errorText }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    console.log("Entri token fetched successfully");

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
    console.error("Error in entri-get-token:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
