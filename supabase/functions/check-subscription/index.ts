
/*
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import Stripe from "npm:stripe@15"
import { createClient } from "npm:@supabase/supabase-js@2"
*/

// Temporarily disabled due to package resolution issues
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  return new Response(JSON.stringify({ 
    subscribed: false, 
    error: "Function temporarily disabled",
    source: 'disabled'
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
