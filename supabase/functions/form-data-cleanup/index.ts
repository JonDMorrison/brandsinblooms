import { createClient } from "npm:@supabase/supabase-js@2";
import { FORM_UPLOAD_BUCKET } from "../_shared/formFileUploads.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Form Data Cleanup Job
 *
 * Scheduled to run daily via pg_cron. Cleans up:
 * 1. form_rate_limits: Records older than 24 hours (configurable)
 * 2. form_submissions: Records older than retention period (optional, disabled by default)
 * 3. Temporary form uploads: Objects in storage older than retention period
 *
 * Environment variables:
 * - RATE_LIMIT_RETENTION_HOURS: Hours to keep rate limit records (default: 24)
 * - SUBMISSION_RETENTION_MONTHS: Months to keep submissions (default: 0 = disabled)
 * - TEMP_UPLOAD_RETENTION_HOURS: Hours to keep temporary form uploads (default: 24)
 */

interface StorageEntry {
  name: string;
  id?: string;
  created_at?: string;
}

async function listStorageEntries(
  supabase: ReturnType<typeof createClient>,
  path: string,
): Promise<StorageEntry[]> {
  const entries: StorageEntry[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(FORM_UPLOAD_BUCKET)
      .list(path, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      break;
    }

    entries.push(...data);

    if (data.length < 100) {
      break;
    }

    offset += data.length;
  }

  return entries;
}

async function collectExpiredTempUploadPaths(
  supabase: ReturnType<typeof createClient>,
  cutoffIso: string,
): Promise<string[]> {
  const expiredPaths: string[] = [];
  const embedKeyDirectories = await listStorageEntries(supabase, "temp");

  for (const embedDirectory of embedKeyDirectories) {
    const sessionDirectories = await listStorageEntries(
      supabase,
      `temp/${embedDirectory.name}`,
    );

    for (const sessionDirectory of sessionDirectories) {
      const fieldDirectories = await listStorageEntries(
        supabase,
        `temp/${embedDirectory.name}/${sessionDirectory.name}`,
      );

      for (const fieldDirectory of fieldDirectories) {
        const files = await listStorageEntries(
          supabase,
          `temp/${embedDirectory.name}/${sessionDirectory.name}/${fieldDirectory.name}`,
        );

        for (const file of files) {
          if (!file.created_at || file.created_at >= cutoffIso) {
            continue;
          }

          expiredPaths.push(
            `temp/${embedDirectory.name}/${sessionDirectory.name}/${fieldDirectory.name}/${file.name}`,
          );
        }
      }
    }
  }

  return expiredPaths;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: [E33] - Add service-role-or-JWT authentication
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: corsHeaders });
  }
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey!);
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
  }

  const startTime = Date.now();
  console.log("[form-data-cleanup] Starting scheduled cleanup job");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Configuration (with defaults)
    const rateLimitRetentionHours = parseInt(
      Deno.env.get("RATE_LIMIT_RETENTION_HOURS") || "24",
      10,
    );
    const submissionRetentionMonths = parseInt(
      Deno.env.get("SUBMISSION_RETENTION_MONTHS") || "0",
      10,
    );
    const tempUploadRetentionHours = parseInt(
      Deno.env.get("TEMP_UPLOAD_RETENTION_HOURS") || "24",
      10,
    );

    const results = {
      rate_limits_deleted: 0,
      submissions_deleted: 0,
      submissions_skipped: submissionRetentionMonths === 0,
      temp_uploads_deleted: 0,
      errors: [] as string[],
    };

    // ─── 1. Clean up form_rate_limits ─────────────────────────────────────────
    const rateLimitCutoff = new Date();
    rateLimitCutoff.setHours(
      rateLimitCutoff.getHours() - rateLimitRetentionHours,
    );

    console.log(
      `[form-data-cleanup] Deleting rate limits older than ${rateLimitCutoff.toISOString()}`,
    );

    const { error: rateLimitError, count: rateLimitCount } = await supabase
      .from("form_rate_limits")
      .delete()
      .lt("window_start", rateLimitCutoff.toISOString())
      .select("*", { count: "exact", head: true });

    if (rateLimitError) {
      console.error(
        "[form-data-cleanup] Error cleaning rate limits:",
        rateLimitError,
      );
      results.errors.push(`rate_limits: ${rateLimitError.message}`);
    } else {
      // Since delete doesn't return count directly, we need to do it differently
      const { data: oldLimits, error: countError } = await supabase
        .from("form_rate_limits")
        .select("id", { count: "exact" })
        .lt("window_start", rateLimitCutoff.toISOString());

      if (!countError && oldLimits) {
        const deleteCount = oldLimits.length;
        if (deleteCount > 0) {
          const { error: delError } = await supabase
            .from("form_rate_limits")
            .delete()
            .lt("window_start", rateLimitCutoff.toISOString());

          if (!delError) {
            results.rate_limits_deleted = deleteCount;
            console.log(
              `[form-data-cleanup] Deleted ${deleteCount} expired rate limit records`,
            );
          }
        }
      }
    }

    // ─── 2. Clean up form_submissions (if retention enabled) ──────────────────
    if (submissionRetentionMonths > 0) {
      const submissionCutoff = new Date();
      submissionCutoff.setMonth(
        submissionCutoff.getMonth() - submissionRetentionMonths,
      );

      console.log(
        `[form-data-cleanup] Deleting submissions older than ${submissionCutoff.toISOString()} (${submissionRetentionMonths} months)`,
      );

      // Count first
      const { data: oldSubmissions, error: subCountError } = await supabase
        .from("form_submissions")
        .select("id", { count: "exact" })
        .lt("submitted_at", submissionCutoff.toISOString());

      if (subCountError) {
        console.error(
          "[form-data-cleanup] Error counting old submissions:",
          subCountError,
        );
        results.errors.push(`submissions_count: ${subCountError.message}`);
      } else if (oldSubmissions && oldSubmissions.length > 0) {
        // Delete in batches to avoid timeouts
        const BATCH_SIZE = 1000;
        let totalDeleted = 0;

        while (true) {
          const { data: batch } = await supabase
            .from("form_submissions")
            .select("id")
            .lt("submitted_at", submissionCutoff.toISOString())
            .limit(BATCH_SIZE);

          if (!batch || batch.length === 0) break;

          const { error: delError } = await supabase
            .from("form_submissions")
            .delete()
            .in(
              "id",
              batch.map((s) => s.id),
            );

          if (delError) {
            results.errors.push(`submissions_delete: ${delError.message}`);
            break;
          }

          totalDeleted += batch.length;

          if (batch.length < BATCH_SIZE) break;
        }

        results.submissions_deleted = totalDeleted;
        console.log(
          `[form-data-cleanup] Deleted ${totalDeleted} old submission records`,
        );
      }
    } else {
      console.log(
        "[form-data-cleanup] Submission retention disabled (SUBMISSION_RETENTION_MONTHS=0)",
      );
    }

    // ─── 3. Clean up temporary form uploads ──────────────────────────────────
    const tempUploadCutoff = new Date();
    tempUploadCutoff.setHours(
      tempUploadCutoff.getHours() - tempUploadRetentionHours,
    );

    console.log(
      `[form-data-cleanup] Deleting temporary uploads older than ${tempUploadCutoff.toISOString()}`,
    );

    try {
      const expiredUploadPaths = await collectExpiredTempUploadPaths(
        supabase,
        tempUploadCutoff.toISOString(),
      );

      if (expiredUploadPaths.length > 0) {
        const BATCH_SIZE = 100;

        for (
          let index = 0;
          index < expiredUploadPaths.length;
          index += BATCH_SIZE
        ) {
          const batch = expiredUploadPaths.slice(index, index + BATCH_SIZE);
          const { error: removeError } = await supabase.storage
            .from(FORM_UPLOAD_BUCKET)
            .remove(batch);

          if (removeError) {
            results.errors.push(`temp_uploads_delete: ${removeError.message}`);
            break;
          }

          results.temp_uploads_deleted += batch.length;
        }

        if (results.temp_uploads_deleted > 0) {
          console.log(
            `[form-data-cleanup] Deleted ${results.temp_uploads_deleted} expired temporary upload objects`,
          );
        }
      }
    } catch (tempUploadError) {
      console.error(
        "[form-data-cleanup] Error cleaning temporary uploads:",
        tempUploadError,
      );
      results.errors.push(
        `temp_uploads: ${tempUploadError instanceof Error ? tempUploadError.message : "Unknown error"}`,
      );
    }

    const duration = Date.now() - startTime;
    console.log(`[form-data-cleanup] Completed in ${duration}ms`, results);

    return new Response(
      JSON.stringify({
        success: results.errors.length === 0,
        ...results,
        duration_ms: duration,
        timestamp: new Date().toISOString(),
      }),
      {
        status: results.errors.length === 0 ? 200 : 207,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[form-data-cleanup] Fatal error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message || "Internal server error",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
