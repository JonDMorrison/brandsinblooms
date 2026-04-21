import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * vmx-sync-all
 *
 * Service-role only. Called by pg_cron every 15 minutes.
 * Iterates all active VMX connections and triggers sync for each.
 */

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: connections, error } = await supabase
      .from("pos_connections")
      .select("id, tenant_id, last_sync_at")
      .eq("platform", "vmx")
      .eq("is_active", true)
      .eq("status", "active");

    if (error) throw error;
    if (!connections || connections.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active VMX connections", synced: 0 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ tenant_id: string; status: string; customers?: any; receipts?: any; error?: string }> = [];
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    for (const conn of connections) {
      // Skip if synced within last 10 minutes (cron double-fire protection)
      if (conn.last_sync_at && conn.last_sync_at > tenMinutesAgo) {
        results.push({ tenant_id: conn.tenant_id, status: "skipped_recent" });
        continue;
      }

      try {
        // Sync customers first
        const custRes = await supabase.functions.invoke("vmx-sync-customers", {
          body: { connection_id: conn.id },
        });
        const custData = custRes.data;

        // Then sync receipts
        const rcptRes = await supabase.functions.invoke("vmx-sync-receipts", {
          body: { connection_id: conn.id },
        });
        const rcptData = rcptRes.data;

        results.push({
          tenant_id: conn.tenant_id,
          status: "success",
          customers: custData,
          receipts: rcptData,
        });
      } catch (syncErr) {
        console.error(`vmx-sync-all: error for tenant ${conn.tenant_id}:`, syncErr);
        results.push({
          tenant_id: conn.tenant_id,
          status: "error",
          error: (syncErr as Error).message,
        });
      }
    }

    const successful = results.filter((r) => r.status === "success").length;
    console.log(`vmx-sync-all: ${successful}/${results.length} connections synced`);

    return new Response(
      JSON.stringify({ synced: successful, total: results.length, results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vmx-sync-all error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
