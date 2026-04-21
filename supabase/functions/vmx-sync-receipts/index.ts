import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto/tokens.ts";
import { createVmxClient, parseVmxDate } from "../_shared/vmx/client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();
  let connectionId = "";

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { connection_id, full_sync } = await req.json();
    connectionId = connection_id;
    if (!connection_id) throw new Error("connection_id is required");

    const { data: conn, error: connErr } = await supabase
      .from("pos_connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connErr || !conn) throw new Error("Connection not found");
    if (conn.platform !== "vmx") throw new Error("Connection is not VMX");

    // Decrypt API key
    const creds = JSON.parse(conn.credentials_encrypted);
    const apiKey = await decryptToken(creds.api_key);

    let start = "1990-01-01";
    if (!full_sync && conn.last_sync_at) {
      const lastSync = new Date(conn.last_sync_at);
      lastSync.setHours(lastSync.getHours() - 1);
      start = lastSync.toISOString().replace("T", " ").substring(0, 19);
    }

    await supabase
      .from("pos_connections")
      .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
      .eq("id", connection_id);

    const client = createVmxClient(apiKey);
    let page = 1;
    let totalProcessed = 0;
    let hasMore = true;
    const affectedCustomerIds = new Set<string>();

    while (hasMore) {
      const result = await client.listReceipts({ start, page });
      hasMore = result.hasMore;

      // Batch upsert entire page at once
      const rows = result.data.map((r) => {
        if (r.customerNum) affectedCustomerIds.add(r.customerNum);
        return {
          tenant_id: conn.tenant_id,
          pos_connection_id: conn.id,
          external_receipt_id: r.id,
          external_customer_id: r.customerNum || null,
          post_date: parseVmxDate(r.postDate),
          subtotal: parseFloat(r.subtotal) || 0,
          tax: parseFloat(r.tax) || 0,
          division_id: r.divisionId || null,
          line_items: r.items || [],
          raw_payload: r,
        };
      });

      if (rows.length > 0) {
        const { error: upsertErr } = await supabase
          .from("pos_receipts")
          .upsert(rows, { onConflict: "tenant_id,pos_connection_id,external_receipt_id" });
        if (upsertErr) {
          console.error(`vmx-sync-receipts: batch upsert error page ${page}:`, upsertErr.message);
        } else {
          totalProcessed += rows.length;
        }
      }

      console.log(`vmx-sync-receipts: page ${page} — ${rows.length} rows`);
      page = result.nextPage;
    }

    // Recompute total_spent and last_visit_date for affected customers
    if (affectedCustomerIds.size > 0) {
      // Per-customer rollup — works without RPC
      const custIds = [...affectedCustomerIds];
      // Process in chunks of 50
      for (let i = 0; i < custIds.length; i += 50) {
        const chunk = custIds.slice(i, i + 50);
        for (const custId of chunk) {
          const { data: totals } = await supabase
            .from("pos_receipts")
            .select("subtotal, tax, post_date")
            .eq("tenant_id", conn.tenant_id)
            .eq("external_customer_id", custId);

          if (totals && totals.length > 0) {
            const totalSpent = totals.reduce(
              (sum, r) => sum + (parseFloat(r.subtotal) || 0) + (parseFloat(r.tax) || 0),
              0,
            );
            const lastVisit = totals.reduce((latest: Date | null, r) => {
              const d = r.post_date ? new Date(r.post_date) : null;
              return d && (!latest || d > latest) ? d : latest;
            }, null as Date | null);

            await supabase
              .from("crm_customers")
              .update({
                total_spent: Math.round(totalSpent * 100) / 100,
                last_visit_date: lastVisit?.toISOString() || null,
              })
              .eq("tenant_id", conn.tenant_id)
              .eq("pos_source", "vmx")
              .eq("external_id", custId);
          }
        }
      }
    }

    await supabase
      .from("pos_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: "success",
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection_id);

    // Generate/refresh system segments for this tenant
    supabase.functions.invoke("generate-system-segments", {
      body: { tenant_id: conn.tenant_id, pos_source: "vmx" },
    }).catch((err) => console.error("system segments generation failed:", err));

    const duration = Date.now() - startTime;
    console.log(`vmx-sync-receipts: ${totalProcessed} receipts, ${page - 1} pages, ${affectedCustomerIds.size} customers, ${duration}ms`);

    return new Response(
      JSON.stringify({
        processed: totalProcessed,
        pages: page - 1,
        customers_updated: affectedCustomerIds.size,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vmx-sync-receipts error:", err);
    if (connectionId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase.from("pos_connections").update({
        sync_status: "error",
        sync_error: (err as Error).message,
        updated_at: new Date().toISOString(),
      }).eq("id", connectionId);
    }
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
