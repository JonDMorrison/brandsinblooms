import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * recompute-all-tenants-segments
 *
 * Nightly cron (3am UTC). Full recompute of dynamic segment memberships
 * for every tenant that has at least one active auto_update segment —
 * system or user-created. Previously this only enumerated tenants that
 * had system segments, leaving tenants whose only dynamic segments were
 * user-created out of the nightly refresh entirely.
 */

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: tenants, error } = await supabase
      .from("crm_segments")
      .select("tenant_id")
      .eq("auto_update", true)
      .eq("status", "active")
      .is("deleted_at", null);

    if (error) throw error;

    const uniqueTenants = [...new Set((tenants || []).map((t) => t.tenant_id))];

    if (uniqueTenants.length === 0) {
      return new Response(
        JSON.stringify({ message: "No tenants with dynamic segments", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ tenant_id: string; result: any }> = [];

    for (const tid of uniqueTenants) {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          "recompute-segment-memberships",
          { body: { tenant_id: tid } },
        );
        results.push({ tenant_id: tid, result: invokeErr ? { error: invokeErr.message } : data });
      } catch (err) {
        results.push({ tenant_id: tid, result: { error: (err as Error).message } });
      }
    }

    console.log(`recompute-all-tenants: ${results.length} tenants processed`);

    return new Response(
      JSON.stringify({ count: results.length, results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("recompute-all-tenants error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
