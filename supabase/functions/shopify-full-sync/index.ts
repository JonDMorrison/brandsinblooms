import { createClient } from "npm:@supabase/supabase-js@2";

const SHOPIFY_PAGE_SIZE = 100;

const SYNC_JOB_CONFIG = [
  { queueSyncType: "customers", label: "customers", estimatedRows: 10000 },
  { queueSyncType: "orders", label: "orders", estimatedRows: 50000 },
  { queueSyncType: "products", label: "products", estimatedRows: 5000 },
] as const;

type SyncJobLabel = (typeof SYNC_JOB_CONFIG)[number]["label"];

type EnqueueOutcome = {
  jobId: string | null;
  status: string | null;
  message: string | null;
  success: boolean | null;
};

function parseEnqueueOutcome(payload: unknown): EnqueueOutcome {
  if (typeof payload === "string") {
    return {
      jobId: payload,
      status: "allow",
      message: null,
      success: true,
    };
  }

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const candidate = record.id ?? record.jobId ?? record.job_id;
    return {
      jobId: typeof candidate === "string" ? candidate : null,
      status: typeof record.status === "string" ? record.status : null,
      message: typeof record.message === "string" ? record.message : null,
      success: typeof record.success === "boolean" ? record.success : null,
    };
  }

  return {
    jobId: null,
    status: null,
    message: null,
    success: null,
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    console.log("[SHOPIFY-FULL-SYNC] Starting full sync via job queue...");

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Not authenticated");
    }

    const { data: userData, error: tenantError } = await supabaseClient
      .from("users")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (tenantError || !userData?.tenant_id) {
      throw new Error("Tenant not found");
    }

    const tenantId = userData.tenant_id;
    const queuedJobs: Array<{
      id: string;
      sync_type: string;
      label: string;
      estimated_rows: number;
      total_pages_est: number;
    }> = [];
    const jobResults: Record<SyncJobLabel, Record<string, unknown>> = {
      customers: {},
      orders: {},
      products: {},
    };
    const enqueueErrors: string[] = [];

    for (const syncJob of SYNC_JOB_CONFIG) {
      const { data: enqueueResult, error: enqueueError } =
        await supabaseClient.rpc("enqueue_pos_sync_job", {
          p_tenant_id: tenantId,
          p_provider: "shopify",
          p_sync_type: syncJob.queueSyncType,
          p_estimated_rows: syncJob.estimatedRows,
          p_triggered_by: "full_sync",
        });

      if (enqueueError) {
        jobResults[syncJob.label] = { error: enqueueError.message };
        enqueueErrors.push(`${syncJob.label}: ${enqueueError.message}`);
        continue;
      }

      const enqueueOutcome = parseEnqueueOutcome(enqueueResult);
      const jobId = enqueueOutcome.jobId;

      if (
        enqueueOutcome.success === false ||
        enqueueOutcome.status === "denied"
      ) {
        const denialMessage =
          enqueueOutcome.message ?? "Sync could not be queued.";
        jobResults[syncJob.label] = {
          status: enqueueOutcome.status ?? "denied",
          message: denialMessage,
          success: false,
        };
        enqueueErrors.push(`${syncJob.label}: ${denialMessage}`);
        continue;
      }

      if (!jobId) {
        jobResults[syncJob.label] = { error: "missing job id" };
        enqueueErrors.push(`${syncJob.label}: missing job id`);
        continue;
      }

      const totalPagesEstimate = Math.max(
        1,
        Math.ceil(syncJob.estimatedRows / SHOPIFY_PAGE_SIZE),
      );
      const now = new Date().toISOString();

      await supabaseClient
        .from("pos_sync_jobs_v2")
        .update({
          current_page: 0,
          total_pages_est: totalPagesEstimate,
          total_batches: totalPagesEstimate,
          fetched_rows: 0,
          inserted_rows: 0,
          skipped_rows: 0,
          failed_rows: 0,
          progress_message: "Queued - waiting to start",
          last_progress_at: now,
          provider_job_id: null,
          updated_at: now,
        })
        .eq("id", jobId);

      queuedJobs.push({
        id: jobId,
        sync_type: syncJob.queueSyncType,
        label: syncJob.label,
        estimated_rows: syncJob.estimatedRows,
        total_pages_est: totalPagesEstimate,
      });
      jobResults[syncJob.label] = {
        jobId,
        status: enqueueOutcome.status ?? "allow",
        message: enqueueOutcome.message ?? "Job queued successfully.",
        success: true,
      };
    }

    if (queuedJobs.length === 0) {
      throw new Error(
        enqueueErrors[0] ?? "No Shopify sync jobs could be enqueued.",
      );
    }

    const { error: workerError } = await supabaseClient.functions.invoke(
      "pos-sync-worker",
      {
        body: { provider: "shopify" },
      },
    );

    if (workerError) {
      console.error(
        "[SHOPIFY-FULL-SYNC] Worker invoke error:",
        workerError.message,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message:
          enqueueErrors.length > 0
            ? "Sync jobs queued with warnings"
            : "Sync jobs enqueued successfully",
        jobs: queuedJobs,
        jobResults,
        errors: enqueueErrors,
        workerStarted: !workerError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[SHOPIFY-FULL-SYNC] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
