import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { decryptToken } from "../_shared/crypto/tokens.ts";
import { createVmxClient, VmxCustomer } from "../_shared/vmx/client.ts";

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

    // Load connection
    const { data: conn, error: connErr } = await supabase
      .from("pos_connections")
      .select("*")
      .eq("id", connection_id)
      .single();

    if (connErr || !conn) throw new Error("Connection not found");
    if (conn.platform !== "vmx") throw new Error("Connection is not VMX");
    if (!conn.is_active) throw new Error("Connection is inactive");

    // Decrypt API key
    const creds = JSON.parse(conn.credentials_encrypted);
    const apiKey = await decryptToken(creds.api_key);

    // Determine start param for incremental sync
    let start = "1990-01-01";
    if (!full_sync && conn.last_sync_at) {
      const lastSync = new Date(conn.last_sync_at);
      lastSync.setHours(lastSync.getHours() - 1); // 1hr overlap for safety
      start = lastSync.toISOString().replace("T", " ").substring(0, 19);
    }

    // Update sync status
    await supabase
      .from("pos_connections")
      .update({ sync_status: "syncing", updated_at: new Date().toISOString() })
      .eq("id", connection_id);

    const client = createVmxClient(apiKey);
    let page = 1;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      const result = await client.listCustomers({ start, page });
      hasMore = result.hasMore;

      for (const c of result.data) {
        if (!c.email && !c.number) continue;

        const { error: upsertErr } = await supabase
          .from("crm_customers")
          .upsert(
            {
              tenant_id: conn.tenant_id,
              user_id: conn.user_id,
              external_id: c.number,
              pos_source: "vmx",
              email: c.email?.trim() || null,
              first_name: c.firstName || null,
              last_name: c.lastName || null,
              phone: c.cellPhone?.trim() || c.phone?.trim() || null,
              email_consent: c.wantsEMail === "1",
              sms_consent: c.wantsTexts === "1",
              custom_fields: {
                is_loyalty: c.isLoyalty === "1",
                reward_dollars: parseFloat(c.rewardDollars) || 0,
                cust_class: c.custClass || null,
                is_inactive: c.isInactive === "1",
                vmx_date_added: c.dateAdded,
                birthday: c.birthday,
                wants_pmail: c.wantsPMail === "1",
              },
            },
            { onConflict: "tenant_id,pos_source,external_id" },
          );

        if (upsertErr) {
          console.error(`vmx-sync-customers: upsert error for ${c.number}:`, upsertErr.message);
        } else {
          totalProcessed++;
        }
      }

      // Save cursor in case of failure on next page
      await supabase
        .from("pos_connections")
        .update({ cursor: String(page) })
        .eq("id", connection_id);

      page = result.nextPage;
    }

    // Success
    await supabase
      .from("pos_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        sync_status: "success",
        cursor: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connection_id);

    const duration = Date.now() - startTime;
    console.log(`vmx-sync-customers: ${totalProcessed} customers, ${page - 1} pages, ${duration}ms`);

    return new Response(
      JSON.stringify({ processed: totalProcessed, pages: page - 1, duration_ms: duration }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("vmx-sync-customers error:", err);

    // Update connection with error status
    if (connectionId) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await supabase
        .from("pos_connections")
        .update({
          sync_status: "error",
          settings: { ...(await supabase.from("pos_connections").select("settings").eq("id", connectionId).single()).data?.settings, last_error: (err as Error).message },
          updated_at: new Date().toISOString(),
        })
        .eq("id", connectionId);
    }

    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
