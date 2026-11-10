import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BATCH_SIZE = 1000;

/**
 * recompute-all-tenants-segments
 *
 * Resumable dynamic-segment fallback worker.
 *
 * A one-minute cron invocation claims one tenant cursor and evaluates at most
 * BATCH_SIZE customers. Leases make overlapping cron requests safe; cursors
 * let large tenants resume after timeouts without restarting from customer 1.
 */

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let activeJob:
    { tenant_id: string; cursor_customer_id: string | null } | undefined;
  let activeWorkerToken: string | undefined;

  try {
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const workerToken = crypto.randomUUID();
    const { data: claimedRows, error: claimError } = await supabase.rpc(
      "claim_segment_recompute_job",
      {
        p_worker_token: workerToken,
        p_lease_seconds: 300,
      },
    );
    if (claimError) throw claimError;

    const job = claimedRows?.[0];
    if (!job) {
      return new Response(JSON.stringify({ status: "idle" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    activeJob = job;
    activeWorkerToken = workerToken;

    let customerQuery = supabase
      .from("crm_customers")
      .select("id")
      .eq("tenant_id", job.tenant_id)
      .is("deleted_at", null)
      .order("id")
      .limit(BATCH_SIZE);
    if (job.cursor_customer_id) {
      customerQuery = customerQuery.gt("id", job.cursor_customer_id);
    }

    const { data: customers, error: customerError } = await customerQuery;
    if (customerError) throw customerError;

    const customerIds = (customers ?? []).map((customer) => customer.id);
    let recomputeResult: Record<string, unknown> | null = null;

    if (customerIds.length > 0) {
      const { data, error: recomputeError } = await supabase.functions.invoke(
        "recompute-segment-memberships",
        {
          body: {
            tenant_id: job.tenant_id,
            customer_ids: customerIds,
          },
        },
      );
      if (recomputeError) throw recomputeError;
      recomputeResult = data;
    }

    const finished = customerIds.length < BATCH_SIZE;
    const lastCustomerId = customerIds.at(-1) ?? job.cursor_customer_id ?? null;
    const { data: acknowledged, error: finishError } = await supabase.rpc(
      "finish_segment_recompute_batch",
      {
        p_tenant_id: job.tenant_id,
        p_worker_token: workerToken,
        p_last_customer_id: lastCustomerId,
        p_customers_evaluated: customerIds.length,
        p_finished: finished,
        p_error: null,
      },
    );
    if (finishError) throw finishError;
    if (!acknowledged) throw new Error("Segment refresh lease was lost");

    console.log(
      `segment-refresh: tenant=${job.tenant_id} customers=${customerIds.length} finished=${finished}`,
    );

    return new Response(
      JSON.stringify({
        status: finished ? "completed" : "running",
        customers_evaluated: customerIds.length,
        result: recomputeResult,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("segment-refresh error:", err);
    if (activeJob && activeWorkerToken) {
      const message = err instanceof Error ? err.message : String(err);
      const { error: releaseError } = await supabase.rpc(
        "finish_segment_recompute_batch",
        {
          p_tenant_id: activeJob.tenant_id,
          p_worker_token: activeWorkerToken,
          p_last_customer_id: activeJob.cursor_customer_id,
          p_customers_evaluated: 0,
          p_finished: false,
          p_error: message,
        },
      );
      if (releaseError) {
        console.error("segment-refresh lease release failed:", releaseError);
      }
    }
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
