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
  tenant_id: string;
  auto_update: boolean;
  conditions: unknown;
  customer_count: number;
  include_all_customers: boolean;
  status?: string | null;
  deleted_at?: string | null;
}

interface Customer {
  id: string;
  tenant_id: string;
  email?: string | null;
  email_opt_in?: boolean | null;
  [key: string]: unknown;
}

function sortSegmentsByDependencies(segments: Segment[]) {
  const ids = new Set(segments.map((segment) => segment.id));
  const dependencyMap = new Map<string, string[]>();
  const incomingCount = new Map<string, number>();

  for (const segment of segments) {
    const dependencies = collectReferencedSegmentIds(
      normalizeSegmentRuleGroup(segment.conditions),
    ).filter((dependencyId) => ids.has(dependencyId));

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

function buildMembershipMap(
  rows: Array<{ customer_id: string; segment_id: string }>,
) {
  const membershipsByCustomerId = new Map<string, Set<string>>();

  for (const row of rows) {
    const next =
      membershipsByCustomerId.get(row.customer_id) ?? new Set<string>();
    next.add(row.segment_id);
    membershipsByCustomerId.set(row.customer_id, next);
  }

  return membershipsByCustomerId;
}

function applyMembershipDiff(
  membershipsByCustomerId: Map<string, Set<string>>,
  segmentId: string,
  enteringCustomerIds: string[],
  exitingCustomerIds: string[],
) {
  for (const customerId of enteringCustomerIds) {
    const next = membershipsByCustomerId.get(customerId) ?? new Set<string>();
    next.add(segmentId);
    membershipsByCustomerId.set(customerId, next);
  }

  for (const customerId of exitingCustomerIds) {
    const next = membershipsByCustomerId.get(customerId);
    if (!next) {
      continue;
    }
    next.delete(segmentId);
    membershipsByCustomerId.set(customerId, next);
  }
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
    const { tenant_id, segment_id } = await req.json().catch(() => ({}));

    if (tenant_id && authHeader !== `Bearer ${supabaseServiceKey}`) {
      const token = authHeader!.replace("Bearer ", "");
      const {
        data: { user },
      } = await supabase.auth.getUser(token);
      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (userData?.tenant_id !== tenant_id) {
          return new Response(
            JSON.stringify({ error: "Tenant access denied" }),
            {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    let segmentsQuery = supabase
      .from("crm_segments")
      .select(
        "id, name, tenant_id, auto_update, conditions, customer_count, include_all_customers, status, deleted_at",
      )
      .eq("auto_update", true)
      .eq("status", "active")
      .is("deleted_at", null);

    if (tenant_id) {
      segmentsQuery = segmentsQuery.eq("tenant_id", tenant_id);
    }
    if (segment_id) {
      segmentsQuery = segmentsQuery.eq("id", segment_id);
    }

    const { data: segments, error: segmentsError } = await segmentsQuery;

    if (segmentsError) {
      throw segmentsError;
    }

    if (!segments?.length) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No segments to evaluate",
          evaluated: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantIds = Array.from(
      new Set(segments.map((segment) => segment.tenant_id)),
    );
    const { data: tenantSegments, error: tenantSegmentsError } = await supabase
      .from("crm_segments")
      .select(
        "id, name, tenant_id, auto_update, conditions, customer_count, include_all_customers, status, deleted_at",
      )
      .in("tenant_id", tenantIds)
      .is("deleted_at", null);

    if (tenantSegmentsError) {
      throw tenantSegmentsError;
    }

    const segmentIdsForMemberships = (tenantSegments ?? []).map(
      (segment) => segment.id,
    );
    const { data: membershipRows, error: membershipError } =
      segmentIdsForMemberships.length
        ? await supabase
            .from("customer_segments")
            .select("customer_id, segment_id")
            .in("segment_id", segmentIdsForMemberships)
        : { data: [], error: null };

    if (membershipError) {
      throw membershipError;
    }

    const membershipsByCustomerId = buildMembershipMap(membershipRows ?? []);
    const customersByTenant = new Map<string, Customer[]>();

    for (const currentTenantId of tenantIds) {
      const { data: customers, error: customersError } = await supabase
        .from("crm_customers")
        .select("*")
        .eq("tenant_id", currentTenantId)
        .is("deleted_at", null)
        .limit(10000);

      if (customersError) {
        throw customersError;
      }

      customersByTenant.set(currentTenantId, (customers ?? []) as Customer[]);
    }

    const results: Array<Record<string, unknown>> = [];

    for (const currentTenantId of tenantIds) {
      const tenantCustomers = customersByTenant.get(currentTenantId) ?? [];
      const eligibleAllCustomerIds = await resolveEligibleEmailCustomerIds(
        supabase,
        {
          tenantId: currentTenantId,
          customers: tenantCustomers,
        },
      );
      const tenantSegmentsToEvaluate = sortSegmentsByDependencies(
        (segments as Segment[]).filter(
          (segment) => segment.tenant_id === currentTenantId,
        ),
      );

      for (const segment of tenantSegmentsToEvaluate) {
        const segmentStartTime = Date.now();
        const matchingCustomerIds = new Set<string>();

        if (segment.include_all_customers) {
          // Materialize implied all-customer memberships via the normal diff path
          // so downstream campaign and segment resolution can keep relying on
          // customer_segments without a parallel audience source.
          for (const customerId of eligibleAllCustomerIds) {
            matchingCustomerIds.add(customerId);
          }
        } else {
          const normalizedRules = normalizeSegmentRuleGroup(segment.conditions);

          for (const customer of tenantCustomers) {
            const matches = evaluateSegmentRule(normalizedRules, customer, {
              customerSegmentsByCustomerId: membershipsByCustomerId,
            });

            if (matches) {
              matchingCustomerIds.add(customer.id);
            }
          }
        }

        const currentMemberIds = new Set<string>();
        for (const customer of tenantCustomers) {
          const currentMemberships = membershipsByCustomerId.get(customer.id);
          if (currentMemberships?.has(segment.id)) {
            currentMemberIds.add(customer.id);
          }
        }

        const customersEntering = Array.from(matchingCustomerIds).filter(
          (customerId) => !currentMemberIds.has(customerId),
        );
        const customersExiting = Array.from(currentMemberIds).filter(
          (customerId) => !matchingCustomerIds.has(customerId),
        );

        if (customersEntering.length) {
          const entryRecords = customersEntering.map((customerId) => ({
            customer_id: customerId,
            segment_id: segment.id,
            assigned_at: new Date().toISOString(),
          }));

          const { error: insertError } = await supabase
            .from("customer_segments")
            .upsert(entryRecords, {
              onConflict: "customer_id,segment_id",
              ignoreDuplicates: true,
            });

          if (insertError) {
            throw insertError;
          }
        }

        if (customersExiting.length) {
          const { error: exitError } = await supabase
            .from("customer_segments")
            .delete()
            .eq("segment_id", segment.id)
            .in("customer_id", customersExiting);

          if (exitError) {
            throw exitError;
          }
        }

        applyMembershipDiff(
          membershipsByCustomerId,
          segment.id,
          customersEntering,
          customersExiting,
        );

        const { error: updateError } = await supabase
          .from("crm_segments")
          .update({
            customer_count: matchingCustomerIds.size,
            updated_at: new Date().toISOString(),
          })
          .eq("id", segment.id);

        if (updateError) {
          throw updateError;
        }

        results.push({
          segment_id: segment.id,
          segment_name: segment.name,
          previous_count: currentMemberIds.size,
          new_count: matchingCustomerIds.size,
          entered: customersEntering.length,
          exited: customersExiting.length,
          duration_ms: Date.now() - segmentStartTime,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        evaluated: results.length,
        duration_ms: Date.now() - startTime,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[evaluate-segments] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
