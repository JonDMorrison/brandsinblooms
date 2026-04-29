import { createClient } from "npm:@supabase/supabase-js@2";

const LIGHTSPEED_PAGE_SIZE = 100;

const SYNC_JOB_CONFIG = [
  { queueSyncType: "products", label: "products", estimatedRows: 5000 },
  { queueSyncType: "customers", label: "customers", estimatedRows: 10000 },
  { queueSyncType: "orders", label: "sales", estimatedRows: 50000 },
] as const;

type SyncJobLabel = (typeof SYNC_JOB_CONFIG)[number]["label"];

type EnqueueOutcome = {
  jobId: string | null;
  status: string | null;
  message: string | null;
  success: boolean | null;
  raw: unknown;
};

function parseEnqueueOutcome(payload: unknown): EnqueueOutcome {
  if (typeof payload === "string") {
    return {
      jobId: payload,
      status: "allow",
      message: null,
      success: true,
      raw: payload,
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
      raw: payload,
    };
  }

  return {
    jobId: null,
    status: null,
    message: null,
    success: null,
    raw: payload,
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

    console.log("[LIGHTSPEED-FULL-SYNC] Starting full sync via job queue...");

    // Get user and tenant info
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
    console.log(`[LIGHTSPEED-FULL-SYNC] Tenant: ${tenantId}`);

    const [squareConnections, cloverConnections, shopifyConnections] =
      await Promise.all([
        supabaseClient
          .from("square_connections")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("status", "connected")
          .limit(1),
        supabaseClient
          .from("clover_connections")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("status", "connected")
          .limit(1),
        supabaseClient
          .from("shopify_connections")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("status", "connected")
          .limit(1),
      ]);

    const hasOtherConnectedPosProvider =
      (squareConnections.data?.length ?? 0) > 0 ||
      (cloverConnections.data?.length ?? 0) > 0 ||
      (shopifyConnections.data?.length ?? 0) > 0;

    if (!hasOtherConnectedPosProvider) {
      const { data: repairedJobs, error: repairJobsError } =
        await supabaseClient
          .from("pos_sync_jobs_v2")
          .update({
            provider: "lightspeed",
            is_delta: false,
            current_cursor: null,
            last_sync_cursor: null,
            next_retry_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenantId)
          .is("provider", null)
          .in("status", ["pending", "delayed", "failed"])
          .select("id");

      if (repairJobsError) {
        console.warn(
          "[LIGHTSPEED-FULL-SYNC] Failed to repair null-provider jobs:",
          repairJobsError.message,
        );
      } else if ((repairedJobs?.length ?? 0) > 0) {
        console.log(
          `[LIGHTSPEED-FULL-SYNC] Repaired ${repairedJobs?.length ?? 0} null-provider queue job(s) for this tenant`,
        );
      }
    } else {
      console.warn(
        "[LIGHTSPEED-FULL-SYNC] Skipping bulk null-provider repair because other POS connections are active for this tenant",
      );
    }

    const queuedJobs: Array<{
      id: string;
      sync_type: string;
      label: string;
      estimated_rows: number;
      total_pages_est: number;
    }> = [];
    const jobResults: Record<SyncJobLabel, Record<string, unknown>> = {
      customers: {},
      sales: {},
      products: {},
    };
    const enqueueErrors: string[] = [];

    for (const syncJob of SYNC_JOB_CONFIG) {
      console.log(
        `[LIGHTSPEED-FULL-SYNC] Enqueuing ${syncJob.label} sync job...`,
      );

      const { data: enqueueResult, error: enqueueError } =
        await supabaseClient.rpc("enqueue_pos_sync_job", {
          p_tenant_id: tenantId,
          p_provider: "lightspeed",
          p_sync_type: syncJob.queueSyncType,
          p_estimated_rows: syncJob.estimatedRows,
          p_triggered_by: "full_sync",
        });

      if (enqueueError) {
        console.error(
          `[LIGHTSPEED-FULL-SYNC] Failed to enqueue ${syncJob.label}:`,
          enqueueError.message,
        );
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
        console.warn(
          `[LIGHTSPEED-FULL-SYNC] ${syncJob.label} denied:`,
          denialMessage,
        );
        jobResults[syncJob.label] = {
          status: enqueueOutcome.status ?? "denied",
          message: denialMessage,
          success: false,
        };
        enqueueErrors.push(`${syncJob.label}: ${denialMessage}`);
        continue;
      }

      if (!jobId) {
        console.error(
          `[LIGHTSPEED-FULL-SYNC] Missing job id for ${syncJob.label}:`,
          enqueueResult,
        );
        jobResults[syncJob.label] = { error: "missing job id" };
        enqueueErrors.push(`${syncJob.label}: missing job id`);
        continue;
      }

      const totalPagesEstimate = Math.max(
        1,
        Math.ceil(syncJob.estimatedRows / LIGHTSPEED_PAGE_SIZE),
      );
      const now = new Date().toISOString();

      const { data: queuedJobState, error: queuedJobStateError } =
        await supabaseClient
          .from("pos_sync_jobs_v2")
          .select("status")
          .eq("id", jobId)
          .single();

      if (queuedJobStateError) {
        console.error(
          `[LIGHTSPEED-FULL-SYNC] Failed to load current job state for ${syncJob.label}:`,
          queuedJobStateError.message,
        );
      }

      const shouldResetQueuedJob = queuedJobState?.status !== "in_progress";
      const { error: progressInitError } = shouldResetQueuedJob
        ? await supabaseClient
            .from("pos_sync_jobs_v2")
            .update({
              provider: "lightspeed",
              is_delta: false,
              status: "pending",
              scheduled_at: now,
              current_batch: 0,
              current_page: 0,
              current_cursor: null,
              last_sync_cursor: null,
              total_pages_est: totalPagesEstimate,
              total_batches: totalPagesEstimate,
              customers_synced: 0,
              orders_synced: 0,
              products_synced: 0,
              processed_rows: 0,
              fetched_rows: 0,
              inserted_rows: 0,
              skipped_rows: 0,
              failed_rows: 0,
              last_error: null,
              next_retry_at: null,
              completed_at: null,
              started_at: null,
              progress_message: `Queued ${syncJob.label} sync`,
              last_progress_at: now,
              provider_job_id: null,
              updated_at: now,
            })
            .eq("id", jobId)
        : { error: null };

      if (progressInitError) {
        console.error(
          `[LIGHTSPEED-FULL-SYNC] Failed to initialize progress for ${syncJob.label}:`,
          progressInitError.message,
        );
      } else if (!shouldResetQueuedJob) {
        console.log(
          `[LIGHTSPEED-FULL-SYNC] ${syncJob.label} job ${jobId} is already in progress; leaving existing cursor and progress intact`,
        );
      }

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
      console.log(
        `[LIGHTSPEED-FULL-SYNC] ${syncJob.label} job enqueued: ${jobId}`,
      );
    }

    if (queuedJobs.length === 0) {
      throw new Error(
        enqueueErrors[0] ?? "No Lightspeed sync jobs could be enqueued.",
      );
    }

    // Kick off the worker to start processing
    console.log("[LIGHTSPEED-FULL-SYNC] Starting pos-sync-worker...");
    const { error: workerError } = await supabaseClient.functions.invoke(
      "pos-sync-worker",
      {
        body: { provider: "lightspeed" },
      },
    );

    if (workerError) {
      console.error(
        "[LIGHTSPEED-FULL-SYNC] Worker invoke error:",
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
    console.error("[LIGHTSPEED-FULL-SYNC] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
