import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveEligibleEmailCustomerIds } from "../_shared/eligibleEmailAudience.ts";
import {
  collectReferencedSegmentIds,
  evaluateSegmentRule,
  normalizeSegmentRuleGroup,
} from "../_shared/segmentEvaluator.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Segment {
  id: string;
  name: string;
  conditions: unknown;
  include_all_customers: boolean;
}

function sortSegmentsByDependencies(segments: Segment[]) {
  const ids = new Set(segments.map((segment) => segment.id));
  const dependencies = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  for (const segment of segments) {
    const referenced = collectReferencedSegmentIds(
      normalizeSegmentRuleGroup(segment.conditions),
    ).filter((segmentId) => ids.has(segmentId));
    dependencies.set(segment.id, referenced);
    incoming.set(segment.id, referenced.length);
  }

  const queue = segments
    .filter((segment) => (incoming.get(segment.id) ?? 0) === 0)
    .map((segment) => segment.id);
  const orderedIds: string[] = [];

  while (queue.length) {
    const segmentId = queue.shift()!;
    orderedIds.push(segmentId);

    for (const segment of segments) {
      if (!(dependencies.get(segment.id) ?? []).includes(segmentId)) continue;
      const next = (incoming.get(segment.id) ?? 0) - 1;
      incoming.set(segment.id, next);
      if (next === 0) queue.push(segment.id);
    }
  }

  // Preserve source order for a cycle; never omit cyclic segments.
  if (orderedIds.length !== segments.length) return segments;

  const byId = new Map(segments.map((segment) => [segment.id, segment]));
  return orderedIds.map((segmentId) => byId.get(segmentId)!).filter(Boolean);
}

/**
 * recompute-segment-memberships
 *
 * Targeted segment membership refresh. Accepts optional segment_ids
 * and customer_ids for scoped recompute. Falls back to full tenant
 * recompute if neither is specified.
 */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        db: { schema: "public" },
        global: { headers: { "x-supabase-max-rows": "50000" } },
      },
    );

    const { tenant_id, segment_ids, customer_ids } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.slice("Bearer ".length);
    if (token !== serviceRoleKey) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: membership } = await supabase
        .from("users")
        .select("tenant_id")
        .eq("id", user.id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      if (!membership) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Load target segments
    let segQuery = supabase
      .from("crm_segments")
      .select("id, name, conditions, include_all_customers")
      .eq("tenant_id", tenant_id)
      .eq("auto_update", true)
      .eq("status", "active")
      .is("deleted_at", null);

    if (segment_ids?.length > 0) {
      segQuery = segQuery.in("id", segment_ids);
    } else {
      // Tenant-wide recompute: include every dynamic segment so user-created
      // ones aren't silently skipped by the nightly cron. Previously this only
      // matched is_system_segment OR include_all_customers, which left
      // user-created auto_update segments stuck at customer_count=0.
      segQuery = segQuery.or(
        "is_system_segment.eq.true,include_all_customers.eq.true,auto_update.eq.true",
      );
    }

    const { data: segments, error: segErr } = await segQuery;
    if (segErr) throw new Error(`Failed to load segments: ${segErr.message}`);
    if (!segments || segments.length === 0) {
      return new Response(
        JSON.stringify({
          segments_evaluated: 0,
          customers_evaluated: 0,
          memberships_added: 0,
          memberships_removed: 0,
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Load target customers (paginate to get all)
    const allCustomers: any[] = [];
    const selectFields =
      "id, email, email_opt_in, sms_opt_in, first_name, last_name, phone, total_spent, lifetime_value, pos_order_count, first_purchase_date, last_purchase_date, last_visit_date, loyalty_member, loyalty_rewards_balance, email_consent, sms_consent, tags, product_tags, persona, persona_id, preferred_channel, last_open_at, last_email_clicked_at, total_emails_opened, total_emails_clicked, total_emails_sent, email_click_rate, email_engagement_score, suppressed, opt_out, is_vip, pos_source, custom_fields, created_at, updated_at";

    if (customer_ids?.length > 0) {
      // Targeted: load specific customers in chunks
      for (let i = 0; i < customer_ids.length; i += 200) {
        const chunk = customer_ids.slice(i, i + 200);
        const { data } = await supabase
          .from("crm_customers")
          .select(selectFields)
          .eq("tenant_id", tenant_id)
          .is("deleted_at", null)
          .in("id", chunk);
        if (data) allCustomers.push(...data);
      }
    } else {
      // Full: paginate through all customers using limit+offset
      let offset = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error: pgErr } = await supabase
          .from("crm_customers")
          .select(selectFields)
          .eq("tenant_id", tenant_id)
          .is("deleted_at", null)
          .order("id")
          .limit(pageSize)
          .range(offset, offset + pageSize - 1);
        if (pgErr)
          throw new Error(
            `Failed to load customers page ${offset}: ${pgErr.message}`,
          );
        if (!data || data.length === 0) break;
        allCustomers.push(...data);
        if (data.length < pageSize) break;
        offset += pageSize;
      }
    }

    const customers = allCustomers;
    if (customers.length === 0) {
      return new Response(
        JSON.stringify({
          segments_evaluated: segments.length,
          customers_evaluated: 0,
          memberships_added: 0,
          memberships_removed: 0,
          duration_ms: Date.now() - startTime,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const eligibleAllCustomerIds = await resolveEligibleEmailCustomerIds(
      supabase,
      {
        tenantId: tenant_id,
        customers,
      },
    );

    // 3. Load existing memberships for the target scope
    const segmentIdList = segments.map((s) => s.id);
    const relevantSegmentIds = Array.from(
      new Set([
        ...segmentIdList,
        ...segments.flatMap((segment) =>
          collectReferencedSegmentIds(
            normalizeSegmentRuleGroup(segment.conditions),
          ),
        ),
      ]),
    );
    const customerIdList = customers.map((c) => c.id);

    // Chunk the query to avoid URL limits
    const existingSet = new Set<string>(); // "customerId:segmentId"
    for (let i = 0; i < customerIdList.length; i += 200) {
      const chunk = customerIdList.slice(i, i + 200);
      const { data: existing } = await supabase
        .from("customer_segments")
        .select("customer_id, segment_id")
        .in("customer_id", chunk)
        .in("segment_id", relevantSegmentIds);

      for (const row of existing || []) {
        existingSet.add(`${row.customer_id}:${row.segment_id}`);
      }
    }

    const membershipsByCustomerId = new Map<string, Set<string>>();
    for (const key of existingSet) {
      const separator = key.indexOf(":");
      const customerId = key.slice(0, separator);
      const segmentId = key.slice(separator + 1);
      const memberships = membershipsByCustomerId.get(customerId) ?? new Set();
      memberships.add(segmentId);
      membershipsByCustomerId.set(customerId, memberships);
    }

    const sortedSegments = sortSegmentsByDependencies(segments as Segment[]);

    // 4. Evaluate and diff
    const toInsert: Array<{
      customer_id: string;
      segment_id: string;
      assigned_at: string;
    }> = [];
    const toDelete: Array<{ customer_id: string; segment_id: string }> = [];

    for (const customer of customers) {
      for (const segment of sortedSegments) {
        const key = `${customer.id}:${segment.id}`;
        const matches = segment.include_all_customers
          ? eligibleAllCustomerIds.has(customer.id)
          : evaluateSegmentRule(
              normalizeSegmentRuleGroup(segment.conditions),
              customer,
              { customerSegmentsByCustomerId: membershipsByCustomerId },
            );
        const exists = existingSet.has(key);

        if (matches && !exists) {
          toInsert.push({
            customer_id: customer.id,
            segment_id: segment.id,
            assigned_at: new Date().toISOString(),
          });
          const memberships =
            membershipsByCustomerId.get(customer.id) ?? new Set<string>();
          memberships.add(segment.id);
          membershipsByCustomerId.set(customer.id, memberships);
        } else if (!matches && exists) {
          toDelete.push({ customer_id: customer.id, segment_id: segment.id });
          membershipsByCustomerId.get(customer.id)?.delete(segment.id);
        }
      }
    }

    // 5. Apply changes
    // Batch inserts (chunks of 500)
    for (let i = 0; i < toInsert.length; i += 500) {
      const batch = toInsert.slice(i, i + 500);
      const { error: insertErr } = await supabase
        .from("customer_segments")
        .upsert(batch, {
          onConflict: "customer_id,segment_id",
          ignoreDuplicates: true,
        });
      if (insertErr) console.error("Insert error:", insertErr.message);
    }

    // Batch deletes
    for (const del of toDelete) {
      await supabase
        .from("customer_segments")
        .delete()
        .eq("customer_id", del.customer_id)
        .eq("segment_id", del.segment_id);
    }

    // 6. Update segment counts
    for (const segment of segments) {
      const { count } = await supabase
        .from("customer_segments")
        .select("*", { count: "exact", head: true })
        .eq("segment_id", segment.id);

      await supabase
        .from("crm_segments")
        .update({
          customer_count: count || 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", segment.id);
    }

    const duration = Date.now() - startTime;
    console.log(
      `recompute-segment-memberships: ${segments.length} segments, ${customers.length} customers, +${toInsert.length}/-${toDelete.length}, ${duration}ms`,
    );

    return new Response(
      JSON.stringify({
        segments_evaluated: segments.length,
        customers_evaluated: customers.length,
        memberships_added: toInsert.length,
        memberships_removed: toDelete.length,
        duration_ms: duration,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("recompute-segment-memberships error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
