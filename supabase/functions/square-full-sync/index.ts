import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, traceparent, tracestate",
};

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

    console.log("[SQUARE-FULL-SYNC] Starting full sync via job queue...");

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
    console.log(`[SQUARE-FULL-SYNC] Tenant: ${tenantId}`);

    // Enqueue sync jobs for customers, sales, products, and loyalty
    const syncTypes = ["customers", "sales", "products", "loyalty"] as const;
    const jobResults: Record<string, any> = {};

    for (const syncType of syncTypes) {
      console.log(`[SQUARE-FULL-SYNC] Enqueuing ${syncType} sync job...`);

      const estimatedRows =
        syncType === "customers"
          ? 10000
          : syncType === "sales"
            ? 50000
            : syncType === "loyalty"
              ? 5000
              : 5000;

      const { data: enqueueResult, error: enqueueError } =
        await supabaseClient.rpc("enqueue_pos_sync_job", {
          p_tenant_id: tenantId,
          p_provider: "square",
          p_sync_type: syncType,
          p_estimated_rows: estimatedRows,
          p_triggered_by: "full_sync",
        });

      if (enqueueError) {
        console.error(
          `[SQUARE-FULL-SYNC] Failed to enqueue ${syncType}:`,
          enqueueError.message,
        );
        jobResults[syncType] = { error: enqueueError.message };
      } else {
        const enqueueOutcome = parseEnqueueOutcome(enqueueResult);

        if (
          enqueueOutcome.success === false ||
          enqueueOutcome.status === "denied"
        ) {
          console.warn(
            `[SQUARE-FULL-SYNC] ${syncType} denied:`,
            enqueueOutcome.message,
          );
          jobResults[syncType] = {
            status: enqueueOutcome.status ?? "denied",
            message: enqueueOutcome.message ?? "Sync could not be queued.",
            success: false,
          };
          continue;
        }

        if (!enqueueOutcome.jobId) {
          console.error(
            `[SQUARE-FULL-SYNC] ${syncType} missing job id:`,
            enqueueResult,
          );
          jobResults[syncType] = { error: "missing job id" };
          continue;
        }

        console.log(
          `[SQUARE-FULL-SYNC] ${syncType} job enqueued: ${enqueueOutcome.jobId}`,
        );
        jobResults[syncType] = { jobId: enqueueOutcome.jobId };
      }
    }

    // Kick off the worker to start processing
    console.log("[SQUARE-FULL-SYNC] Starting pos-sync-worker...");
    const { error: workerError } = await supabaseClient.functions.invoke(
      "pos-sync-worker",
      {
        body: { provider: "square" },
      },
    );

    if (workerError) {
      console.error(
        "[SQUARE-FULL-SYNC] Worker invoke error:",
        workerError.message,
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sync jobs enqueued successfully",
        jobs: jobResults,
        workerStarted: !workerError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[SQUARE-FULL-SYNC] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
