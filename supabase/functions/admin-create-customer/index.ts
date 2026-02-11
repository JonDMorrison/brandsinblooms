import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { email, first_name, last_name, tenant_id, segment_ids } = await req.json();

    // Create customer
    const { data: customer, error: custErr } = await supabaseAdmin
      .from("crm_customers")
      .insert({ email, first_name, last_name, tenant_id })
      .select("id")
      .single();

    if (custErr) throw custErr;

    // Add to segments
    if (segment_ids?.length) {
      const rows = segment_ids.map((sid: string) => ({
        customer_id: customer.id,
        segment_id: sid,
      }));
      const { error: segErr } = await supabaseAdmin
        .from("customer_segments")
        .insert(rows);
      if (segErr) throw segErr;
    }

    return new Response(JSON.stringify({ customer_id: customer.id, segments_added: segment_ids?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
