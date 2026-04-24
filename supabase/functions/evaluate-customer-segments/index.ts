import { createClient } from "npm:@supabase/supabase-js@2";
import { logActivityEvent } from "../_shared/activityLogger.ts";
import {
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
  tenant_id: string;
  auto_update: boolean;
  conditions: unknown;
  customer_count: number;
  status?: string | null;
  deleted_at?: string | null;
}

interface Customer {
  id: string;
  tenant_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

function sortSegmentsByDependencies(segments: Segment[]) {
  const ids = new Set(segments.map((segment) => segment.id));
  const dependencyMap = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const segment of segments) {
    const dependencies = normalizeSegmentRuleGroup(segment.conditions)
      .children.flatMap(function collect(node): string[] {
        const maybeGroup = node as { children?: unknown[] };
        if (Array.isArray(maybeGroup.children)) {
          return maybeGroup.children.flatMap(collect);
        }

        const condition = node as {
          fieldId?: string;
          field?: string;
          value?: unknown;
        };
        const fieldId = condition.fieldId ?? condition.field ?? null;
        if (fieldId !== "segment_membership") {
          return [];
        }

        return Array.isArray(condition.value)
          ? condition.value.map((value) => String(value))
          : condition.value
            ? [String(condition.value)]
            : [];
      })
      .filter((dependencyId) => ids.has(dependencyId));

    dependencyMap.set(segment.id, dependencies);
    incomingCount.set(segment.id, dependencies.length);
  }

  const queue = segments
    .filter((segment) => (incomingCount.get(segment.id) ?? 0) === 0)
    .map((segment) => segment.id);
  const sortedIds: string[] = [];

  while (queue.length) {
    const nextId = queue.shift()!;
    sortedIds.push(nextId);

    for (const segment of segments) {
      const dependencies = dependencyMap.get(segment.id) ?? [];
      if (!dependencies.includes(nextId)) {
        continue;
      }

      const nextCount = (incomingCount.get(segment.id) ?? 0) - 1;
      incomingCount.set(segment.id, nextCount);
      if (nextCount === 0) {
        queue.push(segment.id);
      }
    }
  }

  if (sortedIds.length !== segments.length) {
    return segments;
  }

  const registry = new Map(segments.map((segment) => [segment.id, segment]));
  return sortedIds.map((segmentId) => registry.get(segmentId)!).filter(Boolean);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("Authorization");
  if (
    !authHeader ||
    (authHeader !== `Bearer ${supabaseServiceKey}` &&
      !authHeader.startsWith("Bearer "))
  ) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (authHeader !== `Bearer ${supabaseServiceKey}`) {
    const token = authHeader.replace("Bearer ", "");
    const { error: authErr } = await supabase.auth.getUser(token);
    if (authErr) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const startTime = Date.now();

  try {
    const { customer_id, tenant_id } = await req.json();

    if (!customer_id || !tenant_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "customer_id and tenant_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: customer, error: customerError } = await supabase
      .from("crm_customers")
      .select("*")
      .eq("id", customer_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (customerError || !customer) {
      return new Response(
        JSON.stringify({ success: false, error: "Customer not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: segments, error: segmentsError } = await supabase
      .from("crm_segments")
      .select(
        "id, name, tenant_id, auto_update, conditions, customer_count, status, deleted_at",
      )
      .eq("tenant_id", tenant_id)
      .eq("auto_update", true)
      .eq("status", "active")
      .is("deleted_at", null);

    if (segmentsError) {
      throw segmentsError;
    }

    if (!segments?.length) {
      return new Response(
        JSON.stringify({
          success: true,
          customer_id,
          segments_joined: [],
          segments_left: [],
          total_memberships: 0,
          duration_ms: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: currentMemberships, error: membershipsError } = await supabase
      .from("customer_segments")
      .select("segment_id")
      .eq("customer_id", customer_id);

    if (membershipsError) {
      throw membershipsError;
    }

    const currentSegmentIds = new Set(
      (currentMemberships ?? []).map((membership) => membership.segment_id),
    );
    const membershipMap = new Map<string, Set<string>>([
      [customer_id, new Set(currentSegmentIds)],
    ]);

    const segmentsJoined: string[] = [];
    const segmentsLeft: string[] = [];
    const segmentsJoinedNames: string[] = [];
    const segmentsLeftNames: string[] = [];

    for (const segment of sortSegmentsByDependencies(segments as Segment[])) {
      const matches = evaluateSegmentRule(
        normalizeSegmentRuleGroup(segment.conditions),
        customer as Customer,
        {
          customerSegmentsByCustomerId: membershipMap,
        },
      );
      const isMember = currentSegmentIds.has(segment.id);

      if (matches && !isMember) {
        const { error: insertError } = await supabase
          .from("customer_segments")
          .upsert(
            {
              customer_id,
              segment_id: segment.id,
              assigned_at: new Date().toISOString(),
            },
            {
              onConflict: "customer_id,segment_id",
              ignoreDuplicates: true,
            },
          );

        if (insertError) {
          throw insertError;
        }

        currentSegmentIds.add(segment.id);
        membershipMap.set(customer_id, new Set(currentSegmentIds));
        segmentsJoined.push(segment.id);
        segmentsJoinedNames.push(segment.name);

        await logActivityEvent(supabase, {
          tenant_id,
          customer_id,
          actor_type: "system",
          source: "automation",
          activity_type: "segment.joined",
          status: "success",
          title: `Joined segment: ${segment.name}`,
          description: {
            parts: [
              { type: "text", text: "Added to segment " },
              { type: "mention", label: segment.name },
            ],
          },
          metadata: {
            segment_id: segment.id,
            segment_name: segment.name,
            customer_name:
              `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
              customer.email ||
              "Customer",
            customer_first_name: customer.first_name ?? null,
            customer_last_name: customer.last_name ?? null,
          },
          related_entities: {
            segment_id: segment.id,
            customer_id,
          },
        });
      } else if (!matches && isMember) {
        const { error: deleteError } = await supabase
          .from("customer_segments")
          .delete()
          .eq("customer_id", customer_id)
          .eq("segment_id", segment.id);

        if (deleteError) {
          throw deleteError;
        }

        currentSegmentIds.delete(segment.id);
        membershipMap.set(customer_id, new Set(currentSegmentIds));
        segmentsLeft.push(segment.id);
        segmentsLeftNames.push(segment.name);

        await logActivityEvent(supabase, {
          tenant_id,
          customer_id,
          actor_type: "system",
          source: "automation",
          activity_type: "segment.left",
          status: "success",
          title: `Left segment: ${segment.name}`,
          description: {
            parts: [
              { type: "text", text: "Removed from segment " },
              { type: "mention", label: segment.name },
            ],
          },
          metadata: {
            segment_id: segment.id,
            segment_name: segment.name,
            customer_name:
              `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() ||
              customer.email ||
              "Customer",
            customer_first_name: customer.first_name ?? null,
            customer_last_name: customer.last_name ?? null,
          },
          related_entities: {
            segment_id: segment.id,
            customer_id,
          },
        });
      }
    }

    for (const segmentId of [...segmentsJoined, ...segmentsLeft]) {
      const { count, error: countError } = await supabase
        .from("customer_segments")
        .select("*", { count: "exact", head: true })
        .eq("segment_id", segmentId);

      if (!countError && count !== null) {
        await supabase
          .from("crm_segments")
          .update({
            customer_count: count,
            updated_at: new Date().toISOString(),
          })
          .eq("id", segmentId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        customer_id,
        segments_joined: segmentsJoinedNames,
        segments_left: segmentsLeftNames,
        segments_joined_ids: segmentsJoined,
        segments_left_ids: segmentsLeft,
        total_memberships: currentSegmentIds.size,
        duration_ms: Date.now() - startTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[evaluate-customer-segments] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
