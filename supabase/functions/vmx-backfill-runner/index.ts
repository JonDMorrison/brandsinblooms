import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * vmx-backfill-runner
 *
 * Cron-triggered (every minute). Finds all VMX connections in backfill mode
 * and invokes vmx-backfill-receipts for each, sequentially.
 */

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: connections, error } = await supabase
      .from("pos_connections")
      .select("id, tenant_id, backfill_current_page, backfill_receipts_processed")
      .eq("platform", "vmx")
      .eq("is_active", true)
      .eq("backfill_mode", true);

    if (error) throw error;
    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active backfills", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ tenant_id: string; result: any }> = [];

    for (const conn of connections) {
      try {
        const { data, error: invokeErr } = await supabase.functions.invoke(
          "vmx-backfill-receipts",
          { body: { connection_id: conn.id } },
        );

        results.push({
          tenant_id: conn.tenant_id,
          result: invokeErr ? { error: invokeErr.message } : data,
        });
      } catch (err) {
        results.push({
          tenant_id: conn.tenant_id,
          result: { error: (err as Error).message },
        });
      }
    }

    console.log(`vmx-backfill-runner: processed ${results.length} connections`);

    return new Response(
      JSON.stringify({ count: results.length, results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vmx-backfill-runner error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
