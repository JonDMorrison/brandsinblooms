import { createClient } from "npm:@supabase/supabase-js@2";
import { assertEncryptionKeyConfigured } from "../_shared/crypto/tokens.ts";
import { corsJsonResponse, handleCorsPrelight } from "../_shared/cors.ts";
import { MailchimpClient } from "../_shared/mailchimp/MailchimpClient.ts";
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

async function handleMailchimpImportRequest(req: Request) {
  const corsResponse = handleCorsPrelight(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    const { jobId } = await req.json();
    const authHeader = req.headers.get("Authorization");

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
    const importJob = await loadImportJob(supabase, jobId, tenantId, user.id);

    if (importJob.status === "completed") {
      return corsJsonResponse(
        { error: "Import job already completed" },
        {
          status: 409,
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

    const isResume = isResumeAttempt(importJob);
    await supabase
      .from("import_jobs")
      .update({
        migration_job_id: migrationJobId,
        status: "running",
        current_stage: isResume
          ? "Resuming Mailchimp import..."
          : "Initializing Mailchimp import...",
        error_details: null,
      })
      .eq("id", importJob.id)
      .eq("tenant_id", tenantId);

    await supabase
      .from("migration_jobs" as any)
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", migrationJobId)
      .eq("tenant_id", tenantId);

    const response = corsJsonResponse(
      { jobId: importJob.id, migrationJobId, status: "running" },
      { status: 202 },
    );

    EdgeRuntime.waitUntil(
      runMailchimpImport({
        supabase: createServiceClient(),
        job: {
          ...importJob,
          migration_job_id: migrationJobId,
          status: "running",
        },
        connection,
        tenantId,
        userId: user.id,
        migrationJobId,
      }).catch(async (error: any) => {
        console.error("[mailchimp-import] Unhandled error:", error);
        const backgroundClient = createServiceClient();
        await markJobFailed(
          backgroundClient,
          importJob.id,
          migrationJobId,
          error?.message ?? "Unknown Mailchimp import failure",
        );
      }),
    );

    return response;
  } catch (error: any) {
    console.error("[mailchimp-import] Error:", error);
    return corsJsonResponse(
      {
        error: error?.message ?? "Mailchimp import failed to start",
        type: error?.name ?? "Error",
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
  const client =
    params.client ??
    (await MailchimpClient.fromConnection(
      connection as MailchimpConnectionCredentials,
    ));
  const config = parseImportJobConfig(job.config);
  const artifactMaps = await loadArtifactMaps(supabase, tenantId, config);
  const workItems = await buildWorkItems(client, config, artifactMaps);

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

  const runtimeState: RuntimeState = {
    knownTagNames: new Set<string>(),
    seenEmails: new Set<string>(),
  };

  await writeProgressState(supabase, {
    jobId: job.id,
    migrationJobId,
    tenantId,
    currentPage: typeof job.current_page === "number" ? job.current_page : 0,
    fetchedRows,
    insertedRows: report.contacts_imported,
    skippedRows: report.contacts_skipped,
    failedRows: report.contacts_failed,
    progressPercentage: computeProgressPercentage(
      fetchedRows,
      estimatedTotalRows,
    ),
    currentStage:
      resumeState.activeScopeIndex > 0 || fetchedRows > 0
        ? "Resuming Mailchimp import..."
        : "Starting Mailchimp import...",
    batchStats: buildBatchStats({
      report,
      currentBatch,
      failedBatches,
      totalScopes: workItems.length,
      activeScopeIndex: resumeState.activeScopeIndex,
      activeListId: workItems[resumeState.activeScopeIndex]?.listId ?? null,
      activeSegmentId:
        workItems[resumeState.activeScopeIndex]?.segmentCompositeId ?? null,
      estimatedTotalRows,
      totalBatches: Math.max(
        1,
        Math.ceil(Math.max(estimatedTotalRows, 1) / BATCH_SIZE),
      ),
    }),
  });

  for (
    let scopeIndex = resumeState.activeScopeIndex;
    scopeIndex < workItems.length;
    scopeIndex += 1
  ) {
    if (isShuttingDown) {
      return;
    }

    const workItem = workItems[scopeIndex];
    const resumeOffset =
      scopeIndex === resumeState.activeScopeIndex
        ? (typeof job.current_page === "number" ? job.current_page : 0) *
          BATCH_SIZE
        : 0;

    const crmSegmentId =
      workItem.mode === "segment"
        ? await ensureCrmSegment(
            supabase,
            tenantId,
            userId,
            workItem,
            artifactMaps,
            report,
          )
        : null;

    let offset = resumeOffset;
    while (true) {
      if (isShuttingDown) {
        return;
      }

      await writeProgressState(supabase, {
        jobId: job.id,
        migrationJobId,
        tenantId,
        currentPage: Math.floor(offset / BATCH_SIZE),
        fetchedRows,
        insertedRows: report.contacts_imported,
        skippedRows: report.contacts_skipped,
        failedRows: report.contacts_failed,
        progressPercentage: computeProgressPercentage(
          fetchedRows,
          estimatedTotalRows,
        ),
        currentStage: getScopeStage(workItem, offset),
        batchStats: buildBatchStats({
          report,
          currentBatch,
          failedBatches,
          totalScopes: workItems.length,
          activeScopeIndex: scopeIndex,
          activeListId: workItem.listId,
          activeSegmentId: workItem.segmentCompositeId ?? null,
          estimatedTotalRows,
          totalBatches: Math.max(
            1,
            Math.ceil(Math.max(estimatedTotalRows, 1) / BATCH_SIZE),
          ),
        }),
      });

      const result =
        workItem.mode === "segment"
          ? await client.getSegmentMembers(
              workItem.listId,
              workItem.segmentId ?? "",
              offset,
              BATCH_SIZE,
            )
          : await client.getListMembers(workItem.listId, offset, BATCH_SIZE);

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

      fetchedRows += result.members.length;
      report.contacts_imported += batchOutcome.importedCount;
      report.contacts_skipped += batchOutcome.skippedCount;
      report.contacts_failed += batchOutcome.failedCount;
      report.consents_recorded += batchOutcome.consentsRecorded;
      report.tags_created += batchOutcome.tagsCreated;
      report.batches_processed += 1;

      if (batchOutcome.errorMessages.length > 0) {
        failedBatches += 1;
        report.errors.push(...batchOutcome.errorMessages);

        await supabase.rpc("log_import_batch_error", {
          p_job_id: job.id,
          p_batch_number: currentBatch,
          p_error_message: batchOutcome.errorMessages.join(" | "),
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

      if (crmSegmentId && batchOutcome.customerIds.length > 0) {
        await linkCustomersToSegment(
          supabase,
          crmSegmentId,
          batchOutcome.customerIds,
          userId,
        );
      }

      offset += BATCH_SIZE;

      await writeProgressState(supabase, {
        jobId: job.id,
        migrationJobId,
        tenantId,
        currentPage: Math.floor(offset / BATCH_SIZE),
        fetchedRows,
        insertedRows: report.contacts_imported,
        skippedRows: report.contacts_skipped,
        failedRows: report.contacts_failed,
        progressPercentage: computeProgressPercentage(
          fetchedRows,
          estimatedTotalRows,
        ),
        currentStage: getScopeStage(workItem, offset),
        batchStats: buildBatchStats({
          report,
          currentBatch,
          failedBatches,
          totalScopes: workItems.length,
          activeScopeIndex: scopeIndex,
          activeListId: workItem.listId,
          activeSegmentId: workItem.segmentCompositeId ?? null,
          estimatedTotalRows,
          totalBatches: Math.max(
            1,
            Math.ceil(Math.max(estimatedTotalRows, 1) / BATCH_SIZE),
          ),
        }),
      });

      if (result.members.length < BATCH_SIZE) {
        break;
      }
    }

    await writeProgressState(supabase, {
      jobId: job.id,
      migrationJobId,
      tenantId,
      currentPage: 0,
      fetchedRows,
      insertedRows: report.contacts_imported,
      skippedRows: report.contacts_skipped,
      failedRows: report.contacts_failed,
      progressPercentage: computeProgressPercentage(
        fetchedRows,
        estimatedTotalRows,
      ),
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
        estimatedTotalRows,
        totalBatches: Math.max(
          1,
          Math.ceil(Math.max(estimatedTotalRows, 1) / BATCH_SIZE),
        ),
      }),
    });
  }

  await supabase
    .from("import_jobs")
    .update({
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
        estimatedTotalRows,
        totalBatches: Math.max(
          1,
          Math.ceil(Math.max(estimatedTotalRows, 1) / BATCH_SIZE),
        ),
      }),
    })
    .eq("id", job.id)
    .eq("tenant_id", tenantId);

  await supabase
    .from("migration_jobs" as any)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      progress_percentage: 100,
      progress_current: fetchedRows,
      progress_total: estimatedTotalRows,
      metadata: {
        result: report,
        total_scopes: workItems.length,
        estimated_total_rows: estimatedTotalRows,
      },
    })
    .eq("id", migrationJobId)
    .eq("tenant_id", tenantId);
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

  const { data: existing } = await supabase
    .from("crm_segments")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("source", "mailchimp")
    .eq("source_id", sourceId)
    .maybeSingle();

  if (typeof (existing as any)?.id === "string") {
    return (existing as any).id;
  }

  const name = artifactMaps.segmentNames.get(sourceId) ?? workItem.label;
  const { data, error } = await supabase
    .from("crm_segments")
    .insert({
      tenant_id: tenantId,
      user_id: userId,
      name,
      source: "mailchimp",
      source_id: sourceId,
    })
    .select("id")
    .single();

  if (error || !(data as any)?.id) {
    throw error ?? new Error("Failed to create CRM segment");
  }

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

  await supabase
    .from("import_jobs")
    .update({
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
    })
    .eq("id", jobId)
    .eq("tenant_id", tenantId);

  await supabase
    .from("migration_jobs" as any)
    .update({
      status: "running",
      progress_current: fetchedRows,
      progress_total: Number(batchStats.estimated_total_rows) || 0,
      progress_percentage: progressPercentage,
      metadata: {
        ...batchStats,
        current_stage: currentStage,
      },
    })
    .eq("id", migrationJobId)
    .eq("tenant_id", tenantId);
}

export async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  migrationJobId: string,
  message: string,
) {
  const timestamp = new Date().toISOString();

  await supabase
    .from("import_jobs")
    .update({
      status: "failed",
      current_stage: `Error: ${message}`,
      error_details: [{ message, timestamp }],
    })
    .eq("id", jobId);

  await supabase
    .from("migration_jobs" as any)
    .update({
      status: "failed",
      error_message: message,
      metadata: {
        failure_at: timestamp,
      },
    })
    .eq("id", migrationJobId);
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

export function getScopeStage(workItem: WorkItem, offset: number) {
  const batchNumber = Math.floor(offset / BATCH_SIZE) + 1;
  return `Fetching ${workItem.label} · batch ${batchNumber}`;
}

export async function buildWorkItems(
  client: MailchimpClient,
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

  const liveSegmentsByList = new Map<
    string,
    Array<{ id: number; name: string; member_count: number }>
  >();
  const workItems: WorkItem[] = [];

  for (const listId of orderedListIds) {
    const selectedSegments = segmentIdsByList.get(listId) ?? [];
    if (selectedSegments.length > 0) {
      if (!liveSegmentsByList.has(listId)) {
        liveSegmentsByList.set(listId, await client.getSegments(listId));
      }

      const liveSegments = liveSegmentsByList.get(listId) ?? [];
      for (const segmentSelection of selectedSegments) {
        const segmentId = extractSegmentId(segmentSelection) ?? "";
        const liveSegment = liveSegments.find(
          (segment) => String(segment.id) === segmentId,
        );
        workItems.push({
          key: `segment:${segmentSelection}`,
          mode: "segment",
          listId,
          segmentId,
          segmentCompositeId: segmentSelection,
          label:
            artifactMaps.segmentNames.get(segmentSelection) ??
            liveSegment?.name ??
            `segment ${segmentId}`,
          estimatedTotalRows:
            artifactMaps.segmentCounts.get(segmentSelection) ??
            liveSegment?.member_count ??
            0,
        });
      }
      continue;
    }

    let estimatedTotalRows = artifactMaps.listCounts.get(listId) ?? 0;
    let label = artifactMaps.listNames.get(listId) ?? `list ${listId}`;
    if (estimatedTotalRows === 0 || !artifactMaps.listNames.has(listId)) {
      const listInfo = await client.getList(listId);
      estimatedTotalRows = listInfo.stats?.member_count ?? estimatedTotalRows;
      label = listInfo.name;
    }

    workItems.push({
      key: `list:${listId}`,
      mode: "full_list",
      listId,
      label,
      estimatedTotalRows,
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

  if (config.listIds.length > 0) {
    const { data: listArtifacts } = await supabase
      .from("provider_artifacts")
      .select("external_id, name, member_count")
      .eq("tenant_id", tenantId)
      .eq("provider", "mailchimp")
      .eq("artifact_type", "list")
      .in("external_id", config.listIds);

    for (const artifact of (listArtifacts ?? []) as any[]) {
      listCounts.set(
        String(artifact.external_id),
        Number(artifact.member_count ?? 0),
      );
      listNames.set(String(artifact.external_id), String(artifact.name));
    }
  }

  if (config.segmentIds.length > 0) {
    const { data: segmentArtifacts } = await supabase
      .from("provider_artifacts")
      .select("external_id, name, member_count")
      .eq("tenant_id", tenantId)
      .eq("provider", "mailchimp")
      .eq("artifact_type", "segment")
      .in("external_id", config.segmentIds);

    for (const artifact of (segmentArtifacts ?? []) as any[]) {
      segmentCounts.set(
        String(artifact.external_id),
        Number(artifact.member_count ?? 0),
      );
      segmentNames.set(String(artifact.external_id), String(artifact.name));
    }
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
