import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * generate-system-segments
 *
 * Creates/updates nine system segments for a POS-synced tenant.
 * Idempotent — safe to call repeatedly. Uses upsert on (tenant_id, name)
 * for system segments.
 */

interface SegmentDef {
  name: string;
  description: string;
  conditions: Record<string, unknown>;
}

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    // Calculate VIP threshold (P90 of buyers for this tenant)
    const { data: p90Row } = await supabase.rpc("exec_p90_spend", { p_tenant_id: tenant_id }).maybeSingle();
    let vipThreshold = 1000; // default

    // Fallback: compute P90 directly if RPC doesn't exist
    const { data: spendData } = await supabase
      .from("crm_customers")
      .select("total_spent")
      .eq("tenant_id", tenant_id)
      .gt("total_spent", 0)
      .order("total_spent", { ascending: true });

    if (spendData && spendData.length > 10) {
      const idx = Math.floor(spendData.length * 0.9);
      vipThreshold = Math.round(spendData[idx]?.total_spent || 1000);
    }

    const segments: SegmentDef[] = [
      {
        name: "Active Customers",
        description: "Customers who visited in the last 30 days",
        conditions: { logic: "AND", rules: [{ field: "last_visit_date", operator: "within_days", value: 30 }] },
      },
      {
        name: "Lapsed Customers",
        description: "Haven't visited in 6-12 months — prime for win-back",
        conditions: { logic: "AND", rules: [
          { field: "last_visit_date", operator: "older_than_days", value: 180 },
          { field: "last_visit_date", operator: "within_days", value: 365 },
        ]},
      },
      {
        name: "Dormant Customers",
        description: "Haven't visited in over a year",
        conditions: { logic: "AND", rules: [{ field: "last_visit_date", operator: "older_than_days", value: 365 }] },
      },
      {
        name: "VIP Customers",
        description: `Your top spenders — lifetime spend over $${vipThreshold.toLocaleString()}`,
        conditions: { logic: "AND", rules: [{ field: "total_spent", operator: ">", value: vipThreshold }] },
      },
      {
        name: "Loyalty Members",
        description: "Customers enrolled in your POS loyalty program",
        conditions: { logic: "AND", rules: [{ field: "loyalty_member", operator: "=", value: true }] },
      },
      {
        name: "Loyalty Members with Unused Rewards",
        description: "Loyalty members sitting on unused reward dollars — your highest-conversion audience",
        conditions: { logic: "AND", rules: [
          { field: "loyalty_member", operator: "=", value: true },
          { field: "loyalty_rewards_balance", operator: ">", value: 0 },
        ]},
      },
      {
        name: "Lapsed with Rewards to Spend",
        description: "Customers who haven't visited in 6-12 months but still have rewards waiting — your best win-back list",
        conditions: { logic: "AND", rules: [
          { field: "last_visit_date", operator: "older_than_days", value: 180 },
          { field: "last_visit_date", operator: "within_days", value: 365 },
          { field: "loyalty_rewards_balance", operator: ">", value: 0 },
        ]},
      },
      {
        name: "Dormant with Rewards to Spend",
        description: "Dormant customers sitting on unused rewards — longer shot but potentially high-value",
        conditions: { logic: "AND", rules: [
          { field: "last_visit_date", operator: "older_than_days", value: 365 },
          { field: "loyalty_rewards_balance", operator: ">", value: 0 },
        ]},
      },
      {
        name: "Email Subscribers",
        description: "All customers who have opted in to receive email",
        conditions: { logic: "AND", rules: [
          { field: "email_consent", operator: "=", value: true },
        ]},
      },
    ];

    let created = 0;
    let updated = 0;
    const results: Array<{ name: string; id: string; action: string }> = [];

    for (const seg of segments) {
      // Check if segment already exists
      const { data: existing } = await supabase
        .from("crm_segments")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("name", seg.name)
        .eq("is_system_segment", true)
        .is("deleted_at", null)
        .maybeSingle();

      if (existing) {
        // Update conditions and description
        await supabase
          .from("crm_segments")
          .update({
            conditions: seg.conditions,
            description: seg.description,
            auto_update: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        updated++;
        results.push({ name: seg.name, id: existing.id, action: "updated" });
      } else {
        // Create new segment
        const { data: newSeg, error: insertErr } = await supabase
          .from("crm_segments")
          .insert({
            tenant_id,
            name: seg.name,
            description: seg.description,
            conditions: seg.conditions,
            is_system_segment: true,
            auto_update: true,
            status: "active",
            customer_count: 0,
          })
          .select("id")
          .single();

        if (insertErr) {
          console.error(`Failed to create segment ${seg.name}:`, insertErr.message);
          continue;
        }
        created++;
        results.push({ name: seg.name, id: newSeg!.id, action: "created" });
      }
    }

    // Now compute membership counts for each segment using direct SQL
    for (const result of results) {
      const seg = segments.find((s) => s.name === result.name)!;
      let countQuery = supabase
        .from("crm_customers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant_id);

      // Apply rules as filters
      for (const rule of (seg.conditions as any).rules || []) {
        switch (rule.operator) {
          case "within_days":
            countQuery = countQuery.gte(
              rule.field,
              new Date(Date.now() - rule.value * 86400000).toISOString(),
            );
            break;
          case "older_than_days":
            countQuery = countQuery.lt(
              rule.field,
              new Date(Date.now() - rule.value * 86400000).toISOString(),
            );
            break;
          case ">":
            countQuery = countQuery.gt(rule.field, rule.value);
            break;
          case "=":
            countQuery = countQuery.eq(rule.field, rule.value);
            break;
        }
      }

      const { count } = await countQuery;

      await supabase
        .from("crm_segments")
        .update({ customer_count: count || 0, updated_at: new Date().toISOString() })
        .eq("id", result.id);

      console.log(`Segment "${result.name}": ${count} members`);
    }

    console.log(`generate-system-segments: ${created} created, ${updated} updated for tenant ${tenant_id}`);

    return new Response(
      JSON.stringify({ created, updated, vip_threshold: vipThreshold, segments: results }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-system-segments error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
