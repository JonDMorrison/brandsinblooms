import { createClient } from "npm:@supabase/supabase-js@2";
import { assertEncryptionKeyConfigured } from "../_shared/crypto/tokens.ts";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";
import {
  MailchimpClient,
  MailchimpRequestError,
} from "../_shared/mailchimp/MailchimpClient.ts";
import type {
  ImportReport,
  MailchimpConnectionCredentials,
  MailchimpMember,
} from "../_shared/mailchimp/types.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const BATCH_SIZE = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIGRATION_JOB_UPDATE_TIMEOUT_MS = 2500;
const IMPORT_JOB_UPDATE_TIMEOUT_MS = 5000;
const CRM_SEGMENT_QUERY_TIMEOUT_MS = 5000;

type SupabaseClient = any;

interface WorkItem {
  key: string;
  mode: "full_list" | "segment";
  listId: string;
  segmentId?: string;
  segmentCompositeId?: string;
  label: string;
  estimatedTotalRows: number;
}

interface ResumeState {
  activeScopeIndex: number;
  completedBatches: number;
  failedBatches: number;
  estimatedTotalRows: number;
  errors: string[];
  consentsRecorded: number;
  tagsCreated: number;
  segmentsCreated: number;
}

interface BatchOutcome {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  consentsRecorded: number;
  tagsCreated: number;
  customerIds: string[];
  errorMessages: string[];
}

interface ArtifactMaps {
  listCounts: Map<string, number>;
  listNames: Map<string, string>;
  segmentCounts: Map<string, number>;
  segmentNames: Map<string, string>;
}

interface RuntimeState {
  knownTagNames: Set<string>;
  seenEmails: Set<string>;
}

interface ImportStartDecision {
  allowed: boolean;
  statusCode?: number;
  error?: string;
  resetProgress: boolean;
  initialStage: string;
}

type ImportExecutionDirective = "continue" | "paused" | "cancelled";
type MailchimpImportAction = "start" | "pause" | "cancel";

interface ImportProgressSnapshot {
  currentRows: number;
  totalRows: number;
  progressPercentage: number;
}

interface SerializedImportFailure {
  message: string;
  name: string | null;
  stack: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeImportFailure(error: unknown): SerializedImportFailure {
  if (error instanceof Error) {
    return {
      message: error.message || "Unknown Mailchimp import failure",
      name: error.name || "Error",
      stack: error.stack ?? null,
    };
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return {
      message: error,
      name: "Error",
      stack: null,
    };
  }

  if (isRecord(error)) {
    const message =
      typeof error.message === "string" && error.message.trim().length > 0
        ? error.message
        : "Unknown Mailchimp import failure";

    return {
      message,
      name: typeof error.name === "string" ? error.name : null,
      stack: typeof error.stack === "string" ? error.stack : null,
    };
  }

  return {
    message: "Unknown Mailchimp import failure",
    name: null,
    stack: null,
  };
}

function createMailchimpImportTimeoutError(context: string, timeoutMs: number) {
  const error = new Error(`Timed out during ${context} after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

function isUniqueViolation(error: unknown) {
  return (
    isRecord(error) &&
    (error.code === "23505" ||
      (typeof error.message === "string" &&
        error.message.toLowerCase().includes("duplicate key")))
  );
}

async function runTimedSupabaseQuery<T>(params: {
  query: any;
  timeoutMs: number;
  timeoutContext: string;
}) {
  const { query: sourceQuery, timeoutMs, timeoutContext } = params;
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    let query = sourceQuery;
    if (typeof query.abortSignal === "function") {
      query = query.abortSignal(controller.signal);
    }

    return (await query) as T;
  } catch (error) {
    if (timedOut || controller.signal.aborted) {
      throw createMailchimpImportTimeoutError(timeoutContext, timeoutMs);
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

async function updateImportJobStrict(params: {
  supabase: SupabaseClient;
  jobId: string;
  tenantId: string;
  updates: Record<string, unknown>;
  context: string;
  metadata?: Record<string, unknown>;
}) {
  const { supabase, jobId, tenantId, updates, context, metadata } = params;

  try {
    const { error } = await runTimedSupabaseQuery<{ error: unknown }>({
      query: supabase
        .from("import_jobs")
        .update(updates)
        .eq("id", jobId)
        .eq("tenant_id", tenantId),
      timeoutMs: IMPORT_JOB_UPDATE_TIMEOUT_MS,
      timeoutContext: `import_jobs update during ${context}`,
    });

    if (error) {
      throw error;
    }
  } catch (error) {
    const failure = serializeImportFailure(error);
    console.error(
      `[mailchimp-import] import_jobs update failed during ${context}:`,
      {
        jobId,
        tenantId,
        ...(metadata ?? {}),
        message: failure.message,
        name: failure.name,
      },
    );
    throw error;
  }
}

function buildWorkItemLogContext(params: {
  jobId: string;
  migrationJobId: string;
  tenantId: string;
  scopeIndex: number;
  workItem: WorkItem;
  currentStage?: string | null;
  offset?: number | null;
}) {
  const { jobId, migrationJobId, tenantId, scopeIndex, workItem } = params;

  return {
    jobId,
    migrationJobId,
    tenantId,
    scopeIndex,
    workItemKey: workItem.key,
    workItemMode: workItem.mode,
    listId: workItem.listId,
    segmentId: workItem.segmentId ?? null,
    segmentCompositeId: workItem.segmentCompositeId ?? null,
    currentStage: params.currentStage ?? null,
    offset: typeof params.offset === "number" ? params.offset : null,
  };
}

async function persistMailchimpImportFailure(params: {
  jobId: string;
  migrationJobId: string;
  tenantId: string;
  error: unknown;
  context: string;
}) {
  const { jobId, migrationJobId, tenantId, error, context } = params;
  const failure = serializeImportFailure(error);

  console.error(`[mailchimp-import] ${context}:`, {
    jobId,
    migrationJobId,
    tenantId,
    message: failure.message,
    name: failure.name,
    stack: failure.stack,
  });

  try {
    await markJobFailed(
      createServiceClient(),
      jobId,
      migrationJobId,
      tenantId,
      failure.message,
      failure.stack,
    );
  } catch (persistError) {
    const persistenceFailure = serializeImportFailure(persistError);
    console.error("[mailchimp-import] Failed to persist import failure:", {
      jobId,
      migrationJobId,
      tenantId,
      message: persistenceFailure.message,
      name: persistenceFailure.name,
      stack: persistenceFailure.stack,
    });
  }
}

async function runMailchimpImportInBackground(params: {
  supabase: SupabaseClient;
  job: any;
  connection: any;
  tenantId: string;
  userId: string;
  migrationJobId: string;
  client?: MailchimpClient;
}) {
  try {
    await runMailchimpImport(params);
  } catch (error) {
    await persistMailchimpImportFailure({
      jobId: params.job.id,
      migrationJobId: params.migrationJobId,
      tenantId: params.tenantId,
      error,
      context: "Unhandled Mailchimp import background failure",
    });
  }
}

async function writeImportLifecycleStage(params: {
  supabase: SupabaseClient;
  jobId: string;
  migrationJobId: string;
  tenantId: string;
  currentStage: string;
  progressPercentage: number;
}) {
  const {
    supabase,
    jobId,
    migrationJobId,
    tenantId,
    currentStage,
    progressPercentage,
  } = params;
  const timestamp = new Date().toISOString();

  await updateImportJobStrict({
    supabase,
    jobId,
    tenantId,
    updates: {
      status: "running",
      current_stage: currentStage,
      progress_percentage: progressPercentage,
      updated_at: timestamp,
    },
    context: "lifecycle-stage",
    metadata: {
      currentStage,
      progressPercentage,
    },
  });

  await updateMigrationJobBestEffort({
    supabase,
    migrationJobId,
    tenantId,
    updates: {
      status: "running",
      progress_percentage: progressPercentage,
    },
    context: "lifecycle-stage",
  });
}

async function updateMigrationJobBestEffort(params: {
  supabase: SupabaseClient;
  migrationJobId: string;
  tenantId: string;
  updates: Record<string, unknown>;
  context: string;
}) {
  const { supabase, migrationJobId, tenantId, updates, context } = params;
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, MIGRATION_JOB_UPDATE_TIMEOUT_MS);

  try {
    let query: any = supabase
      .from("migration_jobs" as any)
      .update(updates)
      .eq("id", migrationJobId)
      .eq("tenant_id", tenantId);

    if (typeof query.abortSignal === "function") {
      query = query.abortSignal(controller.signal);
    }

    const { error } = await query;
    if (error) {
      throw error;
    }
  } catch (error) {
    const failure = serializeImportFailure(error);
    console.warn(
      `[mailchimp-import] Skipping migration job update during ${context}:`,
      {
        migrationJobId,
        tenantId,
        message: failure.message,
        name: failure.name,
      },
    );
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

if (import.meta.main) {
  try {
    assertEncryptionKeyConfigured();
  } catch (error: any) {
    console.error("[mailchimp-import] FATAL:", error.message);
  }
}

let isShuttingDown = false;
addEventListener("beforeunload", (event) => {
  console.log(
    "[mailchimp-import] Function shutdown due to:",
    (event as any).detail?.reason,
  );
  isShuttingDown = true;
});

export async function handleMailchimpImportRequest(req: Request) {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) {
    return corsResponse;
  }

  let startedImportContext: {
    jobId: string;
    migrationJobId: string;
    tenantId: string;
  } | null = null;

  try {
    const { jobId, action: requestedAction } = (await req.json()) as {
      jobId?: string;
      action?: string;
    };
    const authHeader = req.headers.get("Authorization");
    const action = normalizeMailchimpImportAction(requestedAction);

    if (!authHeader) {
      return corsJsonResponse(
        { error: "Missing Authorization header" },
        {
          status: 401,
        },
      );
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return corsJsonResponse(
        {
          error: "Authentication failed",
          details: authError?.message ?? "No active session",
        },
        { status: 401 },
      );
    }

    const supabase = createServiceClient();
    const tenantId = await getTenantIdForUser(supabase, user.id);

    if (!jobId) {
      return corsJsonResponse(
        { error: "Missing Mailchimp import job id" },
        { status: 400 },
      );
    }

    if (action !== "start") {
      const result = await controlMailchimpImportJob(supabase, {
        jobId,
        tenantId,
        userId: user.id,
        action,
      });

      return corsJsonResponse(result, { status: 200 });
    }

    const importJob = await loadImportJob(supabase, jobId, tenantId, user.id);

    const startDecision = getImportStartDecision(importJob);
    if (!startDecision.allowed) {
      return corsJsonResponse(
        { error: startDecision.error ?? "Import job cannot be started" },
        {
          status: startDecision.statusCode ?? 409,
        },
      );
    }

    const config = parseImportJobConfig(importJob.config);
    if (config.listIds.length === 0 && config.segmentIds.length === 0) {
      return corsJsonResponse(
        { error: "Import job has no selected Mailchimp lists or segments" },
        { status: 400 },
      );
    }

    const connection = await loadMailchimpConnection(
      supabase,
      tenantId,
      user.id,
    );
    const migrationJobId = await ensureMigrationJob(
      supabase,
      importJob,
      tenantId,
      user.id,
      config,
    );

    const isResume = !startDecision.resetProgress && isResumeAttempt(importJob);
    const importJobStartUpdate = buildImportJobStartUpdate(
      importJob,
      migrationJobId,
      startDecision,
    );
    await updateImportJobStrict({
      supabase,
      jobId: importJob.id,
      tenantId,
      updates: importJobStartUpdate,
      context: "start-request",
      metadata: {
        currentStage: startDecision.initialStage,
        resetProgress: startDecision.resetProgress,
      },
    });

    await updateMigrationJobBestEffort({
      supabase,
      migrationJobId,
      tenantId,
      updates: {
        status: "running",
        started_at: new Date().toISOString(),
        completed_at: startDecision.resetProgress ? null : undefined,
        progress_current: startDecision.resetProgress ? 0 : undefined,
        progress_total: startDecision.resetProgress ? 0 : undefined,
        progress_percentage: startDecision.resetProgress ? 0 : undefined,
        error_message: null,
      },
      context: "start-request",
    });

    startedImportContext = {
      jobId: importJob.id,
      migrationJobId,
      tenantId,
    };

    const response = corsJsonResponse(
      { jobId: importJob.id, migrationJobId, status: "running" },
      { status: 202 },
    );

    EdgeRuntime.waitUntil(
      runMailchimpImportInBackground({
        supabase: createServiceClient(),
        job: {
          ...importJob,
          ...importJobStartUpdate,
          migration_job_id: migrationJobId,
          status: "running",
        },
        connection,
        tenantId,
        userId: user.id,
        migrationJobId,
      }),
    );

    return response;
  } catch (error: any) {
    const failure = serializeImportFailure(error);

    if (startedImportContext) {
      await persistMailchimpImportFailure({
        ...startedImportContext,
        error,
        context: "Mailchimp import failed before background execution started",
      });
    } else {
      console.error("[mailchimp-import] Error:", {
        message: failure.message,
        name: failure.name,
        stack: failure.stack,
      });
    }

    return corsJsonResponse(
      {
        error: failure.message,
        type: failure.name ?? "Error",
      },
      { status: 500 },
    );
  }
}

if (import.meta.main) {
  Deno.serve(handleMailchimpImportRequest);
}

export async function runMailchimpImport(params: {
  supabase: SupabaseClient;
  job: any;
  connection: any;
  tenantId: string;
  userId: string;
  migrationJobId: string;
  client?: MailchimpClient;
}) {
  const { supabase, job, connection, tenantId, userId, migrationJobId } =
    params;
  const config = parseImportJobConfig(job.config);

  if (
    (await getImportExecutionDirective(supabase, {
      jobId: job.id,
      tenantId,
    })) !== "continue"
  ) {
    return;
  }

  await writeImportLifecycleStage({
    supabase,
    jobId: job.id,
    migrationJobId,
    tenantId,
    currentStage: "Loading Mailchimp audience details...",
    progressPercentage: 2,
  });

  const [client, artifactMaps] = await Promise.all([
    params.client
      ? Promise.resolve(params.client)
      : MailchimpClient.fromConnection(
          connection as MailchimpConnectionCredentials,
        ),
    loadArtifactMaps(supabase, tenantId, config),
  ]);

  await writeImportLifecycleStage({
    supabase,
    jobId: job.id,
    migrationJobId,
    tenantId,
    currentStage: "Preparing selected Mailchimp audiences...",
    progressPercentage: 5,
  });

  console.log("[mailchimp-import] Reached Mailchimp import 5% boundary", {
    jobId: job.id,
    migrationJobId,
    tenantId,
    currentStage: "Preparing selected Mailchimp audiences...",
  });

  let workItems: WorkItem[] = [];
  try {
    workItems = await buildWorkItems(client, config, artifactMaps);
    console.log("[mailchimp-import] Prepared Mailchimp work items", {
      jobId: job.id,
      migrationJobId,
      tenantId,
      workItemCount: workItems.length,
      selectedLists: config.listIds.length,
      selectedSegments: config.segmentIds.length,
    });
  } catch (error) {
    const failure = serializeImportFailure(error);
    console.error(
      "[mailchimp-import] Failed while preparing work items after the 5% boundary:",
      {
        jobId: job.id,
        migrationJobId,
        tenantId,
        message: failure.message,
        name: failure.name,
      },
    );
    await rethrowImportMailchimpError(supabase, tenantId, userId, error);
  }

  if (workItems.length === 0) {
    throw new Error("No Mailchimp import work items could be determined");
  }

  const resumeState = getResumeState(job);
  const estimatedTotalRows =
    resumeState.estimatedTotalRows > 0
      ? resumeState.estimatedTotalRows
      : workItems.reduce((sum, item) => sum + item.estimatedTotalRows, 0);

  const report: ImportReport = {
    contacts_imported:
      typeof job.inserted_rows === "number" ? job.inserted_rows : 0,
    contacts_skipped:
      typeof job.skipped_rows === "number" ? job.skipped_rows : 0,
    contacts_failed: typeof job.failed_rows === "number" ? job.failed_rows : 0,
    segments_created: resumeState.segmentsCreated,
    tags_created: resumeState.tagsCreated,
    consents_recorded: resumeState.consentsRecorded,
    errors: resumeState.errors,
    batches_processed: resumeState.completedBatches,
  };

  let fetchedRows = typeof job.fetched_rows === "number" ? job.fetched_rows : 0;
  let currentBatch = resumeState.completedBatches;
  let failedBatches = resumeState.failedBatches;
  let completedScopeRows = workItems
    .slice(0, resumeState.activeScopeIndex)
    .reduce((sum, item) => sum + Math.max(item.estimatedTotalRows, 0), 0);

  const runtimeState: RuntimeState = {
    knownTagNames: new Set<string>(),
    seenEmails: new Set<string>(),
  };

  const initialProgress = computeImportProgressSnapshot({
    workItems,
    activeScopeIndex: resumeState.activeScopeIndex,
    completedScopeRows,
    activeScopeFetchedRows: Math.max(0, fetchedRows - completedScopeRows),
    activeScopeKnownTotalRows: null,
  });

  const initialStage =
    resumeState.activeScopeIndex > 0 || fetchedRows > 0
      ? "Resuming Mailchimp import..."
      : "Starting Mailchimp import...";

  console.log("[mailchimp-import] Writing initial progress state", {
    jobId: job.id,
    migrationJobId,
    tenantId,
    currentStage: initialStage,
    activeScopeIndex: resumeState.activeScopeIndex,
    progressPercentage: initialProgress.progressPercentage,
    estimatedTotalRows: initialProgress.totalRows,
  });

  await writeProgressState(supabase, {
    jobId: job.id,
    migrationJobId,
    tenantId,
    currentPage: typeof job.current_page === "number" ? job.current_page : 0,
    fetchedRows,
    insertedRows: report.contacts_imported,
    skippedRows: report.contacts_skipped,
    failedRows: report.contacts_failed,
    progressPercentage: initialProgress.progressPercentage,
    currentStage: initialStage,
    batchStats: buildBatchStats({
      report,
      currentBatch,
      failedBatches,
      totalScopes: workItems.length,
      activeScopeIndex: resumeState.activeScopeIndex,
      activeListId: workItems[resumeState.activeScopeIndex]?.listId ?? null,
      activeSegmentId:
        workItems[resumeState.activeScopeIndex]?.segmentCompositeId ?? null,
      estimatedTotalRows: initialProgress.totalRows,
      totalBatches: Math.max(
        1,
        Math.ceil(Math.max(initialProgress.totalRows, 1) / BATCH_SIZE),
      ),
    }),
  });

  console.log("[mailchimp-import] Initial progress state written", {
    jobId: job.id,
    migrationJobId,
    tenantId,
    progressPercentage: initialProgress.progressPercentage,
  });

  for (
    let scopeIndex = resumeState.activeScopeIndex;
    scopeIndex < workItems.length;
    scopeIndex += 1
  ) {
    if (isShuttingDown) {
      return;
    }

    if (
      (await getImportExecutionDirective(supabase, {
        jobId: job.id,
        tenantId,
      })) !== "continue"
    ) {
      return;
    }

    const workItem = workItems[scopeIndex];
    const resumeOffset =
      scopeIndex === resumeState.activeScopeIndex
        ? (typeof job.current_page === "number" ? job.current_page : 0) *
          BATCH_SIZE
        : 0;
    let scopeFetchedRows =
      scopeIndex === resumeState.activeScopeIndex
        ? Math.max(0, fetchedRows - completedScopeRows)
        : 0;
    let scopeKnownTotalRows: number | null = null;

    const initialScopeStage = getScopeStage(workItem, resumeOffset);
    let crmSegmentId: string | null = null;
    if (workItem.mode === "segment") {
      console.log(
        "[mailchimp-import] Ensuring CRM segment before first Mailchimp fetch",
        buildWorkItemLogContext({
          jobId: job.id,
          migrationJobId,
          tenantId,
          scopeIndex,
          workItem,
          currentStage: initialScopeStage,
          offset: resumeOffset,
        }),
      );

      try {
        crmSegmentId = await ensureCrmSegment(
          supabase,
          tenantId,
          userId,
          workItem,
          artifactMaps,
          report,
        );
        console.log(
          "[mailchimp-import] CRM segment ready before first Mailchimp fetch",
          {
            ...buildWorkItemLogContext({
              jobId: job.id,
              migrationJobId,
              tenantId,
              scopeIndex,
              workItem,
              currentStage: initialScopeStage,
              offset: resumeOffset,
            }),
            crmSegmentId,
          },
        );
      } catch (error) {
        const failure = serializeImportFailure(error);
        console.error(
          "[mailchimp-import] Failed before first Mailchimp fetch while ensuring CRM segment:",
          {
            ...buildWorkItemLogContext({
              jobId: job.id,
              migrationJobId,
              tenantId,
              scopeIndex,
              workItem,
              currentStage: initialScopeStage,
              offset: resumeOffset,
            }),
            message: failure.message,
            name: failure.name,
          },
        );
        throw error;
      }
    }

    let offset = resumeOffset;
    while (true) {
      if (isShuttingDown) {
        return;
      }

      if (
        (await getImportExecutionDirective(supabase, {
          jobId: job.id,
          tenantId,
        })) !== "continue"
      ) {
        return;
      }

      const progressSnapshot = computeImportProgressSnapshot({
        workItems,
        activeScopeIndex: scopeIndex,
        completedScopeRows,
        activeScopeFetchedRows: scopeFetchedRows,
        activeScopeKnownTotalRows: scopeKnownTotalRows,
      });

      await writeProgressState(supabase, {
        jobId: job.id,
        migrationJobId,
        tenantId,
        currentPage: Math.floor(offset / BATCH_SIZE),
        fetchedRows,
        insertedRows: report.contacts_imported,
        skippedRows: report.contacts_skipped,
        failedRows: report.contacts_failed,
        progressPercentage: progressSnapshot.progressPercentage,
        currentStage: getScopeStage(workItem, offset),
        batchStats: buildBatchStats({
          report,
          currentBatch,
          failedBatches,
          totalScopes: workItems.length,
          activeScopeIndex: scopeIndex,
          activeListId: workItem.listId,
          activeSegmentId: workItem.segmentCompositeId ?? null,
          estimatedTotalRows: progressSnapshot.totalRows,
          totalBatches: Math.max(
            1,
            Math.ceil(Math.max(progressSnapshot.totalRows, 1) / BATCH_SIZE),
          ),
        }),
      });

      if (offset === resumeOffset) {
        console.log(
          "[mailchimp-import] Starting first Mailchimp fetch for scope",
          buildWorkItemLogContext({
            jobId: job.id,
            migrationJobId,
            tenantId,
            scopeIndex,
            workItem,
            currentStage: getScopeStage(workItem, offset),
            offset,
          }),
        );
      }

      const fetchResult = await fetchWorkItemMembers({
        client,
        workItem,
        offset,
        supabase,
        tenantId,
        userId,
      });

      if (fetchResult.warning) {
        console.warn(
          "[mailchimp-import] Skipping Mailchimp scope after fetch warning:",
          {
            ...buildWorkItemLogContext({
              jobId: job.id,
              migrationJobId,
              tenantId,
              scopeIndex,
              workItem,
              currentStage: getScopeStage(workItem, offset),
              offset,
            }),
            warning: fetchResult.warning,
          },
        );
        report.errors.push(fetchResult.warning);
        break;
      }

      if (!fetchResult.result) {
        throw new Error("Mailchimp fetch returned no result");
      }

      const result = fetchResult.result;
      scopeKnownTotalRows = Math.max(
        scopeKnownTotalRows ?? 0,
        Number(result.total_items ?? 0),
        scopeFetchedRows + result.members.length,
      );

      if (result.members.length === 0) {
        break;
      }

      currentBatch += 1;
      let batchOutcome: BatchOutcome;
      try {
        batchOutcome = await processBatch(
          supabase,
          result.members,
          workItem.listId,
          tenantId,
          userId,
          runtimeState,
        );
      } catch (error: any) {
        batchOutcome = {
          importedCount: 0,
          skippedCount: 0,
          failedCount: result.members.length,
          consentsRecorded: 0,
          tagsCreated: 0,
          customerIds: [],
          errorMessages: [
            `Batch ${currentBatch} failed: ${error?.message ?? "Unknown batch error"}`,
          ],
        };
      }

      const batchErrorMessages = [...batchOutcome.errorMessages];

      if (crmSegmentId && batchOutcome.customerIds.length > 0) {
        try {
          await linkCustomersToSegment(
            supabase,
            crmSegmentId,
            batchOutcome.customerIds,
            userId,
          );
        } catch (error: any) {
          batchErrorMessages.push(
            `Segment link error: ${error?.message ?? "Unknown segment linking error"}`,
          );
        }
      }

      fetchedRows += result.members.length;
      scopeFetchedRows += result.members.length;
      report.contacts_imported += batchOutcome.importedCount;
      report.contacts_skipped += batchOutcome.skippedCount;
      report.contacts_failed += batchOutcome.failedCount;
      report.consents_recorded += batchOutcome.consentsRecorded;
      report.tags_created += batchOutcome.tagsCreated;
      report.batches_processed += 1;

      if (batchErrorMessages.length > 0) {
        failedBatches += 1;
        report.errors.push(...batchErrorMessages);

        await supabase.rpc("log_import_batch_error", {
          p_job_id: job.id,
          p_batch_number: currentBatch,
          p_error_message: batchErrorMessages.join(" | "),
          p_failed_items: result.members.map(
            (member: MailchimpMember) => member.email_address,
          ),
        });
      } else {
        try {
          await supabase.rpc("record_contact_import_event", {
            p_tenant_id: tenantId,
            p_source: "mailchimp",
            p_contact_count: batchOutcome.importedCount,
            p_metadata: {
              job_id: job.id,
              migration_job_id: migrationJobId,
              list_id: workItem.listId,
              segment_id: workItem.segmentCompositeId ?? null,
              batch_number: currentBatch,
            },
          });
        } catch (eventError: any) {
          console.warn(
            "[mailchimp-import] Failed to record contact import event:",
            eventError?.message ?? eventError,
          );
        }
      }

      offset += BATCH_SIZE;

      const postBatchProgress = computeImportProgressSnapshot({
        workItems,
        activeScopeIndex: scopeIndex,
        completedScopeRows,
        activeScopeFetchedRows: scopeFetchedRows,
        activeScopeKnownTotalRows: scopeKnownTotalRows,
      });

      await writeProgressState(supabase, {
        jobId: job.id,
        migrationJobId,
        tenantId,
        currentPage: Math.floor(offset / BATCH_SIZE),
        fetchedRows,
        insertedRows: report.contacts_imported,
        skippedRows: report.contacts_skipped,
        failedRows: report.contacts_failed,
        progressPercentage: postBatchProgress.progressPercentage,
        currentStage: getScopeStage(workItem, offset),
        batchStats: buildBatchStats({
          report,
          currentBatch,
          failedBatches,
          totalScopes: workItems.length,
          activeScopeIndex: scopeIndex,
          activeListId: workItem.listId,
          activeSegmentId: workItem.segmentCompositeId ?? null,
          estimatedTotalRows: postBatchProgress.totalRows,
          totalBatches: Math.max(
            1,
            Math.ceil(Math.max(postBatchProgress.totalRows, 1) / BATCH_SIZE),
          ),
        }),
      });

      if (result.members.length < BATCH_SIZE) {
        break;
      }
    }

    completedScopeRows += Math.max(scopeKnownTotalRows ?? scopeFetchedRows, 0);

    const scopeCompletionProgress = computeImportProgressSnapshot({
      workItems,
      activeScopeIndex: Math.min(scopeIndex + 1, workItems.length),
      completedScopeRows,
      activeScopeFetchedRows: 0,
      activeScopeKnownTotalRows: null,
    });

    await writeProgressState(supabase, {
      jobId: job.id,
      migrationJobId,
      tenantId,
      currentPage: 0,
      fetchedRows,
      insertedRows: report.contacts_imported,
      skippedRows: report.contacts_skipped,
      failedRows: report.contacts_failed,
      progressPercentage: scopeCompletionProgress.progressPercentage,
      currentStage:
        scopeIndex === workItems.length - 1
          ? "Finalizing Mailchimp import..."
          : `Completed ${workItem.label}`,
      batchStats: buildBatchStats({
        report,
        currentBatch,
        failedBatches,
        totalScopes: workItems.length,
        activeScopeIndex: Math.min(scopeIndex + 1, workItems.length - 1),
        activeListId: workItems[scopeIndex + 1]?.listId ?? null,
        activeSegmentId: workItems[scopeIndex + 1]?.segmentCompositeId ?? null,
        estimatedTotalRows: scopeCompletionProgress.totalRows,
        totalBatches: Math.max(
          1,
          Math.ceil(
            Math.max(scopeCompletionProgress.totalRows, 1) / BATCH_SIZE,
          ),
        ),
      }),
    });
  }

  const finalTotalRows = Math.max(completedScopeRows, fetchedRows, 0);

  if (
    (await getImportExecutionDirective(supabase, {
      jobId: job.id,
      tenantId,
    })) !== "continue"
  ) {
    return;
  }

  await updateImportJobStrict({
    supabase,
    jobId: job.id,
    tenantId,
    updates: {
      status: "completed",
      completed_at: new Date().toISOString(),
      progress_percentage: 100,
      current_stage: "complete",
      current_page: 0,
      fetched_rows: fetchedRows,
      inserted_rows: report.contacts_imported,
      skipped_rows: report.contacts_skipped,
      failed_rows: report.contacts_failed,
      report,
      batch_stats: buildBatchStats({
        report,
        currentBatch,
        failedBatches,
        totalScopes: workItems.length,
        activeScopeIndex: workItems.length - 1,
        activeListId: null,
        activeSegmentId: null,
        estimatedTotalRows: finalTotalRows,
        totalBatches: Math.max(
          1,
          Math.ceil(Math.max(finalTotalRows, 1) / BATCH_SIZE),
        ),
      }),
    },
    context: "completion",
    metadata: {
      progressPercentage: 100,
      finalTotalRows,
    },
  });

  await updateMigrationJobBestEffort({
    supabase,
    migrationJobId,
    tenantId,
    updates: {
      status: "completed",
      completed_at: new Date().toISOString(),
      progress_percentage: 100,
      progress_current: finalTotalRows,
      progress_total: finalTotalRows,
      metadata: {
        result: report,
        total_scopes: workItems.length,
        estimated_total_rows: finalTotalRows,
      },
    },
    context: "completion",
  });
}

export async function processBatch(
  supabase: SupabaseClient,
  members: MailchimpMember[],
  listId: string,
  tenantId: string,
  userId: string,
  runtimeState: RuntimeState,
): Promise<BatchOutcome> {
  const errorMessages: string[] = [];
  const processableMembers: MailchimpMember[] = [];
  let skippedCount = 0;
  let failedCount = 0;

  for (const member of members) {
    const email = normalizeEmail(member.email_address);
    if (!email) {
      failedCount += 1;
      errorMessages.push("Missing email address on Mailchimp member");
      continue;
    }

    if (runtimeState.seenEmails.has(email)) {
      skippedCount += 1;
      continue;
    }

    if (!EMAIL_PATTERN.test(email)) {
      failedCount += 1;
      errorMessages.push(`Invalid email format: ${email}`);
      continue;
    }

    runtimeState.seenEmails.add(email);
    processableMembers.push({
      ...member,
      email_address: email,
    });
  }

  if (processableMembers.length === 0) {
    return {
      importedCount: 0,
      skippedCount,
      failedCount,
      consentsRecorded: 0,
      tagsCreated: 0,
      customerIds: [],
      errorMessages,
    };
  }

  let emailToCustomerId: Map<string, string>;
  try {
    emailToCustomerId = await batchUpsertContacts(
      supabase,
      tenantId,
      processableMembers,
    );
  } catch (error: any) {
    return {
      importedCount: 0,
      skippedCount,
      failedCount: failedCount + processableMembers.length,
      consentsRecorded: 0,
      tagsCreated: 0,
      customerIds: [],
      errorMessages: [
        ...errorMessages,
        `Batch upsert error: ${error?.message ?? "Unknown CRM customer error"}`,
      ],
    };
  }

  const importedCount = emailToCustomerId.size;
  let consentsRecorded = 0;
  let tagsCreated = 0;

  try {
    consentsRecorded = await batchUpsertConsents(
      supabase,
      processableMembers,
      emailToCustomerId,
    );
  } catch (error: any) {
    errorMessages.push(
      `Consent write error: ${error?.message ?? "Unknown consent error"}`,
    );
  }

  try {
    await batchUpsertSuppressions(supabase, tenantId, processableMembers);
  } catch (error: any) {
    errorMessages.push(
      `Suppression write error: ${error?.message ?? "Unknown suppression error"}`,
    );
  }

  try {
    tagsCreated = await batchUpsertTags(
      supabase,
      tenantId,
      processableMembers,
      emailToCustomerId,
      runtimeState,
    );
  } catch (error: any) {
    errorMessages.push(
      `Tag write error: ${error?.message ?? "Unknown tag error"}`,
    );
  }

  try {
    await batchInsertSources(
      supabase,
      tenantId,
      processableMembers,
      emailToCustomerId,
      listId,
    );
  } catch (error: any) {
    errorMessages.push(
      `Source write error: ${error?.message ?? "Unknown source error"}`,
    );
  }

  return {
    importedCount,
    skippedCount,
    failedCount,
    consentsRecorded,
    tagsCreated,
    customerIds: Array.from(emailToCustomerId.values()),
    errorMessages,
  };
}

async function batchUpsertContacts(
  supabase: SupabaseClient,
  tenantId: string,
  members: MailchimpMember[],
): Promise<Map<string, string>> {
  const contactRows = members.map((member) => {
    const mergeFields = asObject(member.merge_fields) ?? {};
    const customFields: Record<string, string> = {};

    for (const [key, value] of Object.entries(mergeFields)) {
      if (!["FNAME", "LNAME", "PHONE"].includes(key) && value != null) {
        customFields[key] = String(value);
      }
    }

    return {
      tenant_id: tenantId,
      email: member.email_address,
      first_name: asNullableString(mergeFields.FNAME),
      last_name: asNullableString(mergeFields.LNAME),
      phone: asNullableString(mergeFields.PHONE),
      custom_fields: Object.keys(customFields).length > 0 ? customFields : null,
    };
  });

  const { data, error } = await supabase
    .from("crm_customers")
    .upsert(contactRows, {
      onConflict: "tenant_id,email",
      ignoreDuplicates: false,
    })
    .select("id, email");

  if (error) {
    throw error;
  }

  return new Map((data ?? []).map((row: any) => [row.email, row.id]));
}

async function batchUpsertConsents(
  supabase: SupabaseClient,
  members: MailchimpMember[],
  emailToCustomerId: Map<string, string>,
): Promise<number> {
  const consentRows = members.flatMap((member) => {
    const customerId = emailToCustomerId.get(member.email_address);
    if (!customerId) {
      return [];
    }

    if (member.status === "subscribed") {
      return [
        {
          customer_id: customerId,
          channel: "email",
          status: "opted_in",
          consent_timestamp: member.timestamp_opt ?? new Date().toISOString(),
        },
      ];
    }

    if (member.status === "unsubscribed") {
      return [
        {
          customer_id: customerId,
          channel: "email",
          status: "opted_out",
          consent_timestamp: member.timestamp_opt ?? new Date().toISOString(),
        },
      ];
    }

    if (member.status === "cleaned") {
      return [
        {
          customer_id: customerId,
          channel: "email",
          status: "suppressed",
          consent_timestamp: member.timestamp_opt ?? new Date().toISOString(),
        },
      ];
    }

    return [];
  });

  if (consentRows.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("customer_consents")
    .upsert(consentRows, {
      onConflict: "customer_id,channel",
      ignoreDuplicates: false,
    });

  if (error) {
    throw error;
  }

  return consentRows.length;
}

async function batchUpsertSuppressions(
  supabase: SupabaseClient,
  tenantId: string,
  members: MailchimpMember[],
) {
  const suppressionRows = members.flatMap((member) => {
    if (member.status !== "unsubscribed" && member.status !== "cleaned") {
      return [];
    }

    return [
      {
        tenant_id: tenantId,
        email: member.email_address,
        channel: "email",
        suppression_type:
          member.status === "cleaned" ? "bounced" : "unsubscribed",
        reason:
          member.status === "cleaned"
            ? "Cleaned by Mailchimp"
            : "Unsubscribed in Mailchimp",
        auto_suppressed: false,
        suppressed_at: new Date().toISOString(),
        lifted_at: null,
      },
    ];
  });

  if (suppressionRows.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("suppression_list")
    .upsert(suppressionRows, {
      onConflict: "tenant_id,email,channel,suppression_type",
      ignoreDuplicates: false,
    });

  if (error) {
    throw error;
  }
}

async function batchUpsertTags(
  supabase: SupabaseClient,
  tenantId: string,
  members: MailchimpMember[],
  emailToCustomerId: Map<string, string>,
  runtimeState: RuntimeState,
): Promise<number> {
  const uniqueTagNames = new Set<string>();
  const memberTagMap = new Map<string, string[]>();

  for (const member of members) {
    const tagNames = Array.isArray(member.tags)
      ? member.tags
          .map((tag) => tag.name)
          .filter((name): name is string => Boolean(name))
      : [];

    if (tagNames.length === 0) {
      continue;
    }

    memberTagMap.set(member.email_address, tagNames);
    for (const tagName of tagNames) {
      uniqueTagNames.add(tagName);
    }
  }

  if (uniqueTagNames.size === 0) {
    return 0;
  }

  const unseenTagNames = Array.from(uniqueTagNames).filter(
    (tagName) => !runtimeState.knownTagNames.has(tagName),
  );

  let createdCount = 0;
  if (unseenTagNames.length > 0) {
    const { data: existingTags, error: existingError } = await supabase
      .from("crm_tags")
      .select("name")
      .eq("tenant_id", tenantId)
      .in("name", unseenTagNames);

    if (existingError) {
      throw existingError;
    }

    const existingNames = new Set(
      (existingTags ?? []).map((tag: any) => tag.name),
    );
    createdCount = unseenTagNames.filter(
      (tagName) => !existingNames.has(tagName),
    ).length;
  }

  const { data: tags, error } = await supabase
    .from("crm_tags")
    .upsert(
      Array.from(uniqueTagNames).map((name) => ({ tenant_id: tenantId, name })),
      {
        onConflict: "tenant_id,name",
        ignoreDuplicates: false,
      },
    )
    .select("id, name");

  if (error) {
    throw error;
  }

  for (const tagName of uniqueTagNames) {
    runtimeState.knownTagNames.add(tagName);
  }

  const tagIdByName = new Map(
    (tags ?? []).map((tag: any) => [tag.name, tag.id]),
  );
  const linkRows: Array<{ contact_id: string; tag_id: string }> = [];

  for (const [email, tagNames] of memberTagMap.entries()) {
    const customerId = emailToCustomerId.get(email);
    if (!customerId) {
      continue;
    }

    for (const tagName of tagNames) {
      const tagId = tagIdByName.get(tagName);
      if (tagId) {
        linkRows.push({ contact_id: customerId, tag_id: String(tagId) });
      }
    }
  }

  if (linkRows.length > 0) {
    const { error: linkError } = await supabase
      .from("customer_tags")
      .upsert(linkRows, {
        onConflict: "contact_id,tag_id",
        ignoreDuplicates: true,
      });

    if (linkError) {
      throw linkError;
    }
  }

  return createdCount;
}

async function batchInsertSources(
  supabase: SupabaseClient,
  tenantId: string,
  members: MailchimpMember[],
  emailToCustomerId: Map<string, string>,
  listId: string,
) {
  const sourceRows = members.flatMap((member) => {
    const customerId = emailToCustomerId.get(member.email_address);
    if (!customerId) {
      return [];
    }

    return [
      {
        tenant_id: tenantId,
        customer_id: customerId,
        source_type: "mailchimp",
        source_id: member.id,
        imported_at: new Date().toISOString(),
      },
    ];
  });

  if (sourceRows.length === 0) {
    return;
  }

  const { error } = await supabase.from("customer_sources").upsert(sourceRows, {
    onConflict: "customer_id,source_type",
    ignoreDuplicates: true,
  });

  if (error) {
    throw error;
  }
}

async function ensureCrmSegment(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  workItem: WorkItem,
  artifactMaps: ArtifactMaps,
  report: ImportReport,
): Promise<string> {
  const sourceId = workItem.segmentCompositeId;
  if (!sourceId) {
    throw new Error("Segment work item is missing composite source id");
  }

  const { data: existing, error: existingError } = await runTimedSupabaseQuery<{
    data: { id?: string } | null;
    error: unknown;
  }>({
    query: supabase
      .from("crm_segments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("source", "mailchimp")
      .eq("source_id", sourceId)
      .maybeSingle(),
    timeoutMs: CRM_SEGMENT_QUERY_TIMEOUT_MS,
    timeoutContext: `CRM segment lookup for ${sourceId}`,
  });

  if (existingError) {
    throw existingError;
  }

  if (typeof (existing as any)?.id === "string") {
    console.log("[mailchimp-import] Reusing existing CRM segment", {
      tenantId,
      sourceId,
      crmSegmentId: (existing as any).id,
      workItemKey: workItem.key,
    });
    return (existing as any).id;
  }

  const name = artifactMaps.segmentNames.get(sourceId) ?? workItem.label;
  const { data, error } = await runTimedSupabaseQuery<{
    data: { id?: string } | null;
    error: unknown;
  }>({
    query: supabase
      .from("crm_segments")
      .insert({
        tenant_id: tenantId,
        user_id: userId,
        name,
        source: "mailchimp",
        source_id: sourceId,
      })
      .select("id")
      .single(),
    timeoutMs: CRM_SEGMENT_QUERY_TIMEOUT_MS,
    timeoutContext: `CRM segment insert for ${sourceId}`,
  });

  if (error && isUniqueViolation(error)) {
    const { data: concurrentExisting, error: concurrentLookupError } =
      await runTimedSupabaseQuery<{
        data: { id?: string } | null;
        error: unknown;
      }>({
        query: supabase
          .from("crm_segments")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("source", "mailchimp")
          .eq("source_id", sourceId)
          .maybeSingle(),
        timeoutMs: CRM_SEGMENT_QUERY_TIMEOUT_MS,
        timeoutContext: `CRM segment re-lookup for ${sourceId}`,
      });

    if (
      !concurrentLookupError &&
      typeof (concurrentExisting as any)?.id === "string"
    ) {
      console.log(
        "[mailchimp-import] Reused CRM segment after concurrent insert conflict",
        {
          tenantId,
          sourceId,
          crmSegmentId: (concurrentExisting as any).id,
          workItemKey: workItem.key,
        },
      );
      return String((concurrentExisting as any).id);
    }

    throw concurrentLookupError ?? error;
  }

  if (error || !(data as any)?.id) {
    throw error ?? new Error("Failed to create CRM segment");
  }

  console.log("[mailchimp-import] Created CRM segment for Mailchimp scope", {
    tenantId,
    sourceId,
    crmSegmentId: (data as any).id,
    workItemKey: workItem.key,
  });

  report.segments_created += 1;
  return String((data as any).id);
}

async function linkCustomersToSegment(
  supabase: SupabaseClient,
  segmentId: string,
  customerIds: string[],
  userId: string,
) {
  const uniqueCustomerIds = Array.from(new Set(customerIds));
  if (uniqueCustomerIds.length === 0) {
    return;
  }

  const { data: existingLinks, error: existingError } = await supabase
    .from("customer_segments")
    .select("customer_id")
    .eq("segment_id", segmentId)
    .in("customer_id", uniqueCustomerIds);

  if (existingError) {
    throw existingError;
  }

  const existingCustomerIds = new Set(
    (existingLinks ?? []).map((row: any) => row.customer_id),
  );

  const linkRows = uniqueCustomerIds
    .filter((customerId) => !existingCustomerIds.has(customerId))
    .map((customerId) => ({
      customer_id: customerId,
      segment_id: segmentId,
      assigned_by_user_id: userId,
    }));

  if (linkRows.length === 0) {
    return;
  }

  const { error } = await supabase.from("customer_segments").insert(linkRows);
  if (error) {
    throw error;
  }
}

export async function writeProgressState(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    migrationJobId: string;
    tenantId: string;
    currentPage: number;
    fetchedRows: number;
    insertedRows: number;
    skippedRows: number;
    failedRows: number;
    progressPercentage: number;
    currentStage: string;
    batchStats: Record<string, unknown>;
  },
) {
  const {
    jobId,
    migrationJobId,
    tenantId,
    currentPage,
    fetchedRows,
    insertedRows,
    skippedRows,
    failedRows,
    progressPercentage,
    currentStage,
    batchStats,
  } = params;

  await updateImportJobStrict({
    supabase,
    jobId,
    tenantId,
    updates: {
      current_page: currentPage,
      fetched_rows: fetchedRows,
      inserted_rows: insertedRows,
      skipped_rows: skippedRows,
      failed_rows: failedRows,
      total_pages_est: Math.max(
        1,
        Math.ceil((Number(batchStats.estimated_total_rows) || 1) / BATCH_SIZE),
      ),
      progress_percentage: progressPercentage,
      current_stage: currentStage,
      batch_stats: batchStats,
    },
    context: "progress-write",
    metadata: {
      currentPage,
      fetchedRows,
      insertedRows,
      skippedRows,
      failedRows,
      progressPercentage,
      currentStage,
    },
  });

  await updateMigrationJobBestEffort({
    supabase,
    migrationJobId,
    tenantId,
    updates: {
      status: "running",
      progress_current: fetchedRows,
      progress_total: Number(batchStats.estimated_total_rows) || 0,
      progress_percentage: progressPercentage,
      metadata: {
        ...batchStats,
        current_stage: currentStage,
      },
    },
    context: "progress-write",
  });
}

export async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  migrationJobId: string,
  tenantId: string,
  message: string,
  stack?: string | null,
) {
  const timestamp = new Date().toISOString();
  const errorDetails: Record<string, string> = {
    message,
    timestamp,
  };

  console.error(
    "[mailchimp-import] Persisting Mailchimp import failure state",
    {
      jobId,
      migrationJobId,
      tenantId,
      message,
    },
  );

  if (stack) {
    errorDetails.stack = stack;
  }

  let importJobPersistError: unknown = null;
  try {
    await updateImportJobStrict({
      supabase,
      jobId,
      tenantId,
      updates: {
        status: "failed",
        current_stage: `Error: ${message}`,
        error_details: [errorDetails],
        completed_at: timestamp,
        updated_at: timestamp,
      },
      context: "failure-persist",
      metadata: {
        currentStage: `Error: ${message}`,
      },
    });
  } catch (error) {
    importJobPersistError = error;
  }

  const migrationMetadata: Record<string, unknown> = {
    failure_at: timestamp,
    failure_message: message,
  };

  if (stack) {
    migrationMetadata.failure_stack = stack;
  }

  await updateMigrationJobBestEffort({
    supabase,
    migrationJobId,
    tenantId,
    updates: {
      status: "failed",
      error_message: message,
      completed_at: timestamp,
      metadata: migrationMetadata,
    },
    context: "failure-persist",
  });

  if (importJobPersistError) {
    throw importJobPersistError;
  }
}

export function buildBatchStats(params: {
  report: ImportReport;
  currentBatch: number;
  failedBatches: number;
  totalScopes: number;
  activeScopeIndex: number;
  activeListId: string | null;
  activeSegmentId: string | null;
  estimatedTotalRows: number;
  totalBatches: number;
}) {
  const {
    report,
    currentBatch,
    failedBatches,
    totalScopes,
    activeScopeIndex,
    activeListId,
    activeSegmentId,
    estimatedTotalRows,
    totalBatches,
  } = params;

  return {
    total_batches: totalBatches,
    completed_batches: currentBatch,
    failed_batches: failedBatches,
    contacts_per_batch: BATCH_SIZE,
    contacts_imported: report.contacts_imported,
    contacts_skipped: report.contacts_skipped,
    contacts_failed: report.contacts_failed,
    consents_recorded: report.consents_recorded,
    tags_created: report.tags_created,
    segments_created: report.segments_created,
    errors: report.errors,
    total_scopes: totalScopes,
    active_scope_index: activeScopeIndex,
    active_list_id: activeListId,
    active_segment_id: activeSegmentId,
    estimated_total_rows: estimatedTotalRows,
  };
}

export function getImportStartDecision(job: any): ImportStartDecision {
  if (job.status === "completed") {
    return {
      allowed: false,
      statusCode: 409,
      error: "Import job already completed",
      resetProgress: false,
      initialStage: "complete",
    };
  }

  if (job.status === "running") {
    return {
      allowed: false,
      statusCode: 409,
      error: "Import job already running",
      resetProgress: false,
      initialStage: "running",
    };
  }

  if (job.status === "cancelled") {
    return {
      allowed: false,
      statusCode: 409,
      error: "Cancelled import jobs cannot be resumed",
      resetProgress: false,
      initialStage: "cancelled",
    };
  }

  if (job.status === "failed") {
    return {
      allowed: true,
      resetProgress: true,
      initialStage: "Restarting failed Mailchimp import...",
    };
  }

  return {
    allowed: true,
    resetProgress: false,
    initialStage: isResumeAttempt(job)
      ? "Resuming Mailchimp import..."
      : "Initializing Mailchimp import...",
  };
}

export function buildImportJobStartUpdate(
  importJob: any,
  migrationJobId: string,
  decision: ImportStartDecision,
) {
  const basePayload: Record<string, unknown> = {
    migration_job_id: migrationJobId,
    status: "running",
    current_stage: decision.initialStage,
    error_details: null,
  };

  if (!decision.resetProgress) {
    return basePayload;
  }

  return {
    ...basePayload,
    current_page: 0,
    fetched_rows: 0,
    inserted_rows: 0,
    skipped_rows: 0,
    failed_rows: 0,
    total_pages_est: null,
    progress_percentage: 0,
    report: null,
    batch_stats: null,
    completed_at: null,
  };
}

function computeImportProgressSnapshot(params: {
  workItems: WorkItem[];
  activeScopeIndex: number;
  completedScopeRows: number;
  activeScopeFetchedRows: number;
  activeScopeKnownTotalRows: number | null;
}): ImportProgressSnapshot {
  const {
    workItems,
    activeScopeIndex,
    completedScopeRows,
    activeScopeFetchedRows,
    activeScopeKnownTotalRows,
  } = params;

  if (activeScopeIndex >= workItems.length) {
    const totalRows = Math.max(completedScopeRows, 0);
    return {
      currentRows: totalRows,
      totalRows,
      progressPercentage: totalRows > 0 ? 99 : 0,
    };
  }

  const currentScopeEstimate = Math.max(
    activeScopeKnownTotalRows ??
      workItems[activeScopeIndex]?.estimatedTotalRows ??
      0,
    activeScopeFetchedRows,
  );
  const remainingScopeEstimate = workItems
    .slice(activeScopeIndex + 1)
    .reduce((sum, item) => sum + Math.max(item.estimatedTotalRows, 0), 0);
  const totalRows = Math.max(
    completedScopeRows + currentScopeEstimate + remainingScopeEstimate,
    0,
  );
  const currentRows = Math.max(
    0,
    completedScopeRows + Math.min(activeScopeFetchedRows, currentScopeEstimate),
  );

  return {
    currentRows,
    totalRows,
    progressPercentage: computeProgressPercentage(currentRows, totalRows),
  };
}

function getResumeState(job: any): ResumeState {
  const batchStats = asObject(job.batch_stats);
  return {
    activeScopeIndex: asNumber(batchStats?.active_scope_index, 0),
    completedBatches: asNumber(batchStats?.completed_batches, 0),
    failedBatches: asNumber(batchStats?.failed_batches, 0),
    estimatedTotalRows: asNumber(batchStats?.estimated_total_rows, 0),
    errors: asStringArray(batchStats?.errors),
    consentsRecorded: asNumber(batchStats?.consents_recorded, 0),
    tagsCreated: asNumber(batchStats?.tags_created, 0),
    segmentsCreated: asNumber(batchStats?.segments_created, 0),
  };
}

export function computeProgressPercentage(
  fetchedRows: number,
  estimatedTotalRows: number,
) {
  if (estimatedTotalRows <= 0) {
    return fetchedRows > 0 ? 1 : 0;
  }

  return Math.max(
    0,
    Math.min(99, Math.round((fetchedRows / estimatedTotalRows) * 100)),
  );
}

function isMailchimpStatusError(
  error: unknown,
  status: number,
): error is MailchimpRequestError {
  return error instanceof MailchimpRequestError && error.status === status;
}

function normalizeImportJobStatus(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeMailchimpImportAction(
  value: string | undefined,
): MailchimpImportAction {
  if (value === "pause" || value === "cancel") {
    return value;
  }

  return "start";
}

async function controlMailchimpImportJob(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    tenantId: string;
    userId: string;
    action: Exclude<MailchimpImportAction, "start">;
  },
) {
  const { jobId, tenantId, userId, action } = params;
  const importJob = await loadImportJob(supabase, jobId, tenantId, userId);
  const currentStatus = normalizeImportJobStatus(importJob.status);
  const timestamp = new Date().toISOString();

  if (action === "pause") {
    if (!["pending", "running"].includes(currentStatus)) {
      throw new Error(
        "Only pending or running Mailchimp imports can be paused",
      );
    }

    await supabase
      .from("import_jobs")
      .update({
        status: "paused",
        current_stage: "Paused by user",
      })
      .eq("id", importJob.id)
      .eq("tenant_id", tenantId);

    if (importJob.migration_job_id) {
      await updateMigrationJobBestEffort({
        supabase,
        migrationJobId: importJob.migration_job_id,
        tenantId,
        updates: {
          status: "paused",
          paused_at: timestamp,
          metadata: {
            ...(importJob.batch_stats &&
            typeof importJob.batch_stats === "object"
              ? importJob.batch_stats
              : {}),
            current_stage: "Paused by user",
          },
        },
        context: "pause-control",
      });
    }

    return {
      jobId: importJob.id,
      status: "paused",
      message: "Mailchimp import paused",
    };
  }

  if (!["pending", "running", "paused"].includes(currentStatus)) {
    throw new Error(
      "Only pending, running, or paused Mailchimp imports can be cancelled",
    );
  }

  await supabase
    .from("import_jobs")
    .update({
      status: "cancelled",
      current_stage: "Cancelled by user",
      completed_at: timestamp,
    })
    .eq("id", importJob.id)
    .eq("tenant_id", tenantId);

  if (importJob.migration_job_id) {
    await updateMigrationJobBestEffort({
      supabase,
      migrationJobId: importJob.migration_job_id,
      tenantId,
      updates: {
        status: "cancelled",
        completed_at: timestamp,
        error_message: null,
        metadata: {
          ...(importJob.batch_stats && typeof importJob.batch_stats === "object"
            ? importJob.batch_stats
            : {}),
          current_stage: "Cancelled by user",
          cancelled_by_user: true,
        },
      },
      context: "cancel-control",
    });
  }

  return {
    jobId: importJob.id,
    status: "cancelled",
    message: "Mailchimp import cancelled",
  };
}

async function getImportExecutionDirective(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    tenantId: string;
  },
): Promise<ImportExecutionDirective> {
  const { jobId, tenantId } = params;

  try {
    const { data, error } = await supabase
      .from("import_jobs")
      .select("status")
      .eq("id", jobId)
      .eq("tenant_id", tenantId)
      .eq("provider", "mailchimp")
      .maybeSingle();

    if (error || !data) {
      console.warn(
        "[mailchimp-import] Unable to read control state; continuing import",
        error?.message ?? "missing import job row",
      );
      return "continue";
    }

    const status = normalizeImportJobStatus(
      (data as { status?: unknown }).status,
    );
    if (status === "paused" || status === "cancelled") {
      return status;
    }
  } catch (error) {
    console.warn(
      "[mailchimp-import] Control state check failed; continuing import",
      error,
    );
  }

  return "continue";
}

async function rethrowImportMailchimpError(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  error: unknown,
): Promise<never> {
  if (isMailchimpStatusError(error, 401)) {
    await expireMailchimpConnection(supabase, tenantId, userId);
    throw new Error(
      "Mailchimp connection expired during import. Reconnect Mailchimp and retry.",
    );
  }

  throw error;
}

async function fetchWorkItemMembers(params: {
  client: MailchimpClient;
  workItem: WorkItem;
  offset: number;
  supabase: SupabaseClient;
  tenantId: string;
  userId: string;
}): Promise<
  | {
      result: Awaited<ReturnType<MailchimpClient["getListMembers"]>>;
      warning?: undefined;
    }
  | {
      result?: undefined;
      warning: string;
    }
> {
  const { client, workItem, offset, supabase, tenantId, userId } = params;

  console.log("[mailchimp-import] Fetching Mailchimp members", {
    tenantId,
    listId: workItem.listId,
    segmentCompositeId: workItem.segmentCompositeId ?? null,
    workItemKey: workItem.key,
    offset,
    limit: BATCH_SIZE,
  });

  try {
    const result =
      workItem.mode === "segment"
        ? await client.getSegmentMembers(
            workItem.listId,
            workItem.segmentId ?? "",
            offset,
            BATCH_SIZE,
          )
        : await client.getListMembers(workItem.listId, offset, BATCH_SIZE);

    return { result };
  } catch (error) {
    if (isMailchimpStatusError(error, 404)) {
      return {
        warning:
          workItem.mode === "segment"
            ? `Segment ${workItem.label} is no longer available in Mailchimp. Skipping this selection.`
            : `List ${workItem.label} is no longer available in Mailchimp. Skipping this selection.`,
      };
    }

    await rethrowImportMailchimpError(supabase, tenantId, userId, error);
    throw new Error("Unreachable Mailchimp fetch error state");
  }
}

async function expireMailchimpConnection(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
) {
  await supabase
    .from("provider_connections")
    .update({
      status: "expired",
      token_expires_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "mailchimp");
}

export function getScopeStage(workItem: WorkItem, offset: number) {
  const batchNumber = Math.floor(offset / BATCH_SIZE) + 1;
  return `Fetching ${workItem.label} · batch ${batchNumber}`;
}

export async function buildWorkItems(
  _client: MailchimpClient,
  config: { listIds: string[]; segmentIds: string[] },
  artifactMaps: ArtifactMaps,
): Promise<WorkItem[]> {
  const segmentIdsByList = new Map<string, string[]>();
  for (const selection of config.segmentIds) {
    const listId = extractListId(selection);
    const segmentId = extractSegmentId(selection);
    if (!listId || !segmentId) {
      continue;
    }

    const existing = segmentIdsByList.get(listId) ?? [];
    existing.push(selection);
    segmentIdsByList.set(listId, existing);
  }

  const orderedListIds = orderedUnique([
    ...config.listIds,
    ...config.segmentIds
      .map((selection) => extractListId(selection))
      .filter((listId): listId is string => Boolean(listId)),
  ]);

  const workItems: WorkItem[] = [];

  for (const listId of orderedListIds) {
    const selectedSegments = segmentIdsByList.get(listId) ?? [];
    if (selectedSegments.length > 0) {
      for (const segmentSelection of selectedSegments) {
        const segmentId = extractSegmentId(segmentSelection) ?? "";
        workItems.push({
          key: `segment:${segmentSelection}`,
          mode: "segment",
          listId,
          segmentId,
          segmentCompositeId: segmentSelection,
          label:
            artifactMaps.segmentNames.get(segmentSelection) ??
            `segment ${segmentId}`,
          estimatedTotalRows:
            artifactMaps.segmentCounts.get(segmentSelection) ?? 0,
        });
      }
      continue;
    }

    workItems.push({
      key: `list:${listId}`,
      mode: "full_list",
      listId,
      label: artifactMaps.listNames.get(listId) ?? `list ${listId}`,
      estimatedTotalRows: artifactMaps.listCounts.get(listId) ?? 0,
    });
  }

  return workItems;
}

async function loadArtifactMaps(
  supabase: SupabaseClient,
  tenantId: string,
  config: { listIds: string[]; segmentIds: string[] },
): Promise<ArtifactMaps> {
  const listCounts = new Map<string, number>();
  const listNames = new Map<string, string>();
  const segmentCounts = new Map<string, number>();
  const segmentNames = new Map<string, string>();

  const listArtifactsPromise =
    config.listIds.length > 0
      ? supabase
          .from("provider_artifacts")
          .select("external_id, name, member_count")
          .eq("tenant_id", tenantId)
          .eq("provider", "mailchimp")
          .eq("artifact_type", "list")
          .in("external_id", config.listIds)
      : Promise.resolve({ data: [], error: null });

  const segmentArtifactsPromise =
    config.segmentIds.length > 0
      ? supabase
          .from("provider_artifacts")
          .select("external_id, name, member_count")
          .eq("tenant_id", tenantId)
          .eq("provider", "mailchimp")
          .eq("artifact_type", "segment")
          .in("external_id", config.segmentIds)
      : Promise.resolve({ data: [], error: null });

  const [listArtifactsResult, segmentArtifactsResult] = await Promise.all([
    listArtifactsPromise,
    segmentArtifactsPromise,
  ]);

  if (listArtifactsResult.error) {
    throw listArtifactsResult.error;
  }

  if (segmentArtifactsResult.error) {
    throw segmentArtifactsResult.error;
  }

  for (const artifact of (listArtifactsResult.data ?? []) as any[]) {
    listCounts.set(
      String(artifact.external_id),
      Number(artifact.member_count ?? 0),
    );
    listNames.set(String(artifact.external_id), String(artifact.name));
  }

  for (const artifact of (segmentArtifactsResult.data ?? []) as any[]) {
    segmentCounts.set(
      String(artifact.external_id),
      Number(artifact.member_count ?? 0),
    );
    segmentNames.set(String(artifact.external_id), String(artifact.name));
  }

  return { listCounts, listNames, segmentCounts, segmentNames };
}

function parseImportJobConfig(value: unknown): {
  listIds: string[];
  segmentIds: string[];
} {
  const config = asObject(value);
  return {
    listIds: orderedUnique(asStringArray(config?.listIds)),
    segmentIds: orderedUnique(asStringArray(config?.segmentIds)),
  };
}

function orderedUnique(values: string[]) {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function extractListId(segmentSelection?: string): string | null {
  if (!segmentSelection) {
    return null;
  }

  const separatorIndex = segmentSelection.indexOf(":");
  return separatorIndex === -1
    ? null
    : segmentSelection.slice(0, separatorIndex);
}

function extractSegmentId(segmentSelection?: string): string | null {
  if (!segmentSelection) {
    return null;
  }

  const separatorIndex = segmentSelection.indexOf(":");
  return separatorIndex === -1
    ? segmentSelection
    : segmentSelection.slice(separatorIndex + 1);
}

function normalizeEmail(value: string | null | undefined) {
  return typeof value === "string" ? value.toLowerCase().trim() : "";
}

function asNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asObject(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, any>;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isResumeAttempt(job: any) {
  return (
    (typeof job.current_page === "number" && job.current_page > 0) ||
    (typeof job.fetched_rows === "number" && job.fetched_rows > 0) ||
    Boolean(job.migration_job_id)
  );
}

async function getTenantIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("tenant_id")
    .eq("id", userId)
    .single();

  if (error || !data?.tenant_id) {
    throw new Error("Tenant not found for user");
  }

  return String((data as any).tenant_id);
}

async function loadImportJob(
  supabase: SupabaseClient,
  jobId: string,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "mailchimp")
    .single();

  if (error || !data) {
    throw new Error("Import job not found");
  }

  return data;
}

async function loadMailchimpConnection(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("provider_connections")
    .select("encrypted_access_token, metadata")
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .eq("provider", "mailchimp")
    .eq("status", "connected")
    .single();

  if (error || !data?.encrypted_access_token) {
    throw new Error("Mailchimp not connected");
  }

  return data;
}

async function ensureMigrationJob(
  supabase: SupabaseClient,
  importJob: any,
  tenantId: string,
  userId: string,
  config: { listIds: string[]; segmentIds: string[] },
): Promise<string> {
  if (importJob.migration_job_id) {
    const { data: existing } = await supabase
      .from("migration_jobs" as any)
      .select("id")
      .eq("id", importJob.migration_job_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (typeof (existing as any)?.id === "string") {
      return (existing as any).id;
    }
  }

  const { data, error } = await supabase
    .from("migration_jobs" as any)
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      source_platform: "mailchimp",
      job_type: "import",
      status: "pending",
      progress_current: 0,
      progress_total: 0,
      metadata: {
        list_ids: config.listIds,
        segment_ids: config.segmentIds,
      },
    })
    .select("id")
    .single();

  if (error || !(data as any)?.id) {
    throw new Error(
      `Failed to create migration job: ${error?.message ?? "Unknown error"}`,
    );
  }

  return String((data as any).id);
}

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
