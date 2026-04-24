import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto/tokens.ts";
import { createVmxClient, parseVmxDate } from "../_shared/vmx/client.ts";

/**
 * vmx-backfill-receipts
 *
 * State-machine worker: pulls ONE page of receipts per invocation,
 * stores progress in pos_connections.backfill_* columns, returns fast.
 * Called by vmx-backfill-runner cron every minute until done.
 */

serve(async (req) => {
  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { connection_id } = await req.json();
    if (!connection_id) throw new Error("connection_id is required");

    // Load connection with backfill state
    const { data: conn, error: connErr } = await supabase
      .from("pos_connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connErr || !conn) throw new Error("Connection not found");

    if (!conn.backfill_mode) {
      return new Response(
        JSON.stringify({ done: true, reason: "not in backfill mode" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Decrypt API key
    const creds = JSON.parse(conn.credentials_encrypted);
    const apiKey = await decryptToken(creds.api_key);

    const startDate = conn.backfill_start_date || "1990-01-01";
    const currentPage = conn.backfill_current_page || 1;
    const totalProcessed = conn.backfill_receipts_processed || 0;

    // Pull ONE page
    const client = createVmxClient(apiKey);
    const result = await client.listReceipts({ start: startDate, page: currentPage });

    // Batch upsert
    let pageProcessed = 0;
    if (result.data.length > 0) {
      const rows = result.data.map((r) => ({
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
      }));

      const { error: upsertErr } = await supabase
        .from("pos_receipts")
        .upsert(rows, { onConflict: "tenant_id,pos_connection_id,external_receipt_id" });

      if (upsertErr) {
        console.error(`vmx-backfill: upsert error page ${currentPage}:`, upsertErr.message);
        // Don't throw — save progress and retry next invocation
        await supabase.from("pos_connections").update({
          sync_status: "error",
          sync_error: `Page ${currentPage}: ${upsertErr.message}`,
          updated_at: new Date().toISOString(),
        }).eq("id", connection_id);

        return new Response(
          JSON.stringify({ done: false, error: upsertErr.message, page: currentPage }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      pageProcessed = rows.length;
    }

    const newTotal = totalProcessed + pageProcessed;
    const duration = Date.now() - startTime;
    const isComplete = !result.hasMore || result.data.length === 0;

    if (isComplete) {
      // Final step: bulk rollup via SQL RPC
      console.log(`vmx-backfill: complete — ${newTotal} receipts total, running rollup...`);
      const { data: rollupCount, error: rollupErr } = await supabase.rpc(
        "recompute_customer_rollups",
        { p_tenant_id: conn.tenant_id, p_pos_source: "vmx" },
      );

      if (rollupErr) {
        console.error("vmx-backfill: rollup error:", rollupErr.message);
      } else {
        console.log(`vmx-backfill: rollup updated ${rollupCount} customers`);
      }

      await supabase.from("pos_connections").update({
        backfill_mode: false,
        backfill_completed_at: new Date().toISOString(),
        backfill_receipts_processed: newTotal,
        sync_status: "success",
        sync_error: null,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection_id);

      return new Response(
        JSON.stringify({
          done: true,
          total_processed: newTotal,
          pages: currentPage,
          rollup_customers: rollupCount ?? 0,
          duration_ms: duration,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // More pages to go — save progress
    await supabase.from("pos_connections").update({
      backfill_current_page: currentPage + 1,
      backfill_receipts_processed: newTotal,
      sync_status: "syncing",
      sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", connection_id);

    console.log(`vmx-backfill: page ${currentPage} — ${pageProcessed} receipts, ${newTotal} total, ${duration}ms`);

    return new Response(
      JSON.stringify({
        done: false,
        page: currentPage,
        page_processed: pageProcessed,
        total_processed: newTotal,
        next_page: currentPage + 1,
        duration_ms: duration,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vmx-backfill-receipts error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
