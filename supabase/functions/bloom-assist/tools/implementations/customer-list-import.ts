// "Import this list": add the contacts in a spreadsheet the person uploaded to
// this chat as CRM customers.
//
// Preview (no approval yet): read the upload, map its columns, and count new /
// updated / skipped rows. Nothing is written.
// Approved run: the same deterministic parse and mapping, then the CRM's own
// import RPCs (begin_customer_csv_import + import_crm_customer_batch), called
// as the approving person, so role checks, identity matching, suppression and
// consent evidence are exactly the import dialog's.
//
// Consent: Bloom imports record the owner's "express" attestation (the wording
// from IMPORT_ATTESTATION_OPTIONS), shown on the approval card. The model never
// picks the attestation; it is fixed here.

import {
  CUSTOMER_IMPORT_BATCH_SIZE,
  importCustomerBatch,
} from "../../../../../src/lib/crm/customerImportBatch.ts";
import {
  buildImportCustomers,
  type BuiltImportCustomers,
  getDefaultImportField,
  type ImportColumnMapping,
  isAllowedImportField,
  isValidImportEmail,
} from "../../../../../src/lib/crm/customerImportRows.ts";
import { getAttestationOption } from "../../../../../src/lib/crm/importAttestationOptions.ts";
import {
  type ConversationUpload,
  resolveConversationUpload,
  UploadAccessError,
} from "../../conversation-uploads.ts";
import type { JsonObject, JsonValue, PersistenceClient } from "../../types.ts";
import type { ConfirmationDetails, ToolExecutionContext, ToolResult } from "../types.ts";

export const IMPORT_CUSTOMER_LIST_TOOL = "import_customer_list" as const;
/** Largest list one chat import takes; bigger files go through Customers > Import. */
export const CHAT_IMPORT_MAX_ROWS = 2000;
/** Stop starting new batches after this long so the request can report back. */
export const CHAT_IMPORT_TIME_BUDGET_MS = 110_000;
export const CHAT_IMPORT_ATTESTATION = "express" as const;
const IMPORT_ROLES = new Set(["owner_admin", "marketing"]);
const SAMPLE_SIZE = 5;
const EXAMPLE_LIMIT = 5;

type RpcClient = Pick<PersistenceClient, "rpc">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  return "Unknown error";
}

function result(args: {
  success: boolean;
  message: string;
  error?: string | null;
  data?: JsonValue | null;
  count?: number | null;
  blockType?: ToolResult["block_type"];
  confirmation?: ConfirmationDetails | null;
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType ?? "text",
    confirmation_required: Boolean(args.confirmation),
    confirmation_details: args.confirmation ?? null,
  };
}

function failure(message: string, error: string): ToolResult {
  return result({ success: false, message, error });
}

/** The express attestation the approval card shows and the approval records. */
export function chatImportAttestation() {
  return getAttestationOption(CHAT_IMPORT_ATTESTATION);
}

// ---------------------------------------------------------------------------
// Column mapping
// ---------------------------------------------------------------------------

export type MappingResolution = {
  mappings: ImportColumnMapping[];
  /** Model suggestions that were not applied, with the reason. */
  ignored: string[];
  error: string | null;
};

function samplesFor(rows: string[][], index: number): string[] {
  const samples: string[] = [];
  for (const row of rows) {
    const value = (row[index] ?? "").trim();
    if (value) samples.push(value);
    if (samples.length >= SAMPLE_SIZE) break;
  }
  return samples;
}

/** True when most non-empty values in the first 50 rows of a column are email addresses. */
function looksLikeEmailColumn(rows: string[][], index: number): boolean {
  let filled = 0;
  let emails = 0;
  for (const row of rows.slice(0, 50)) {
    const value = (row[index] ?? "").trim();
    if (!value) continue;
    filled++;
    if (isValidImportEmail(value)) emails++;
  }
  return filled >= 1 && emails / filled >= 0.8;
}

/**
 * Header matching first; a proposed mapping ({ "<header>": "<field>" }) may
 * override it, but only onto a real header and an allowed import field.
 */
export function resolveColumnMapping(
  headers: string[],
  dataRows: string[][],
  proposed: JsonValue | undefined,
): MappingResolution {
  const fields = headers.map((header) => getDefaultImportField(header));
  const ignored: string[] = [];

  if (proposed !== undefined && proposed !== null) {
    if (!isRecord(proposed)) {
      ignored.push("The suggested column mapping was not a header-to-field object.");
    } else {
      for (const [rawHeader, rawField] of Object.entries(proposed)) {
        const header = rawHeader.trim().toLowerCase();
        const index = headers.findIndex((candidate) => candidate.trim().toLowerCase() === header);
        if (index < 0) {
          ignored.push(`"${rawHeader}" is not a column in this file.`);
          continue;
        }
        const field = typeof rawField === "string" ? rawField.trim() : "";
        if (!isAllowedImportField(field)) {
          ignored.push(`"${rawHeader}" cannot be imported as "${String(rawField)}".`);
          continue;
        }
        fields[index] = field;
      }
    }
  }

  // An unusual header on a column that is plainly email addresses is still the email column.
  if (!fields.includes("email")) {
    const emailLike = headers
      .map((_, index) => index)
      .filter((index) => looksLikeEmailColumn(dataRows, index));
    if (emailLike.length === 1) fields[emailLike[0]] = "email";
  }

  const emailColumns = fields.filter((field) => field === "email").length;
  const mappings = headers.map((header, index) => ({
    csvHeader: header,
    databaseField: fields[index],
    sampleData: samplesFor(dataRows, index),
    sourceIndex: index,
  }));
  if (emailColumns === 0) {
    return {
      mappings,
      ignored,
      error: "No column in this file is an email address. Tell Bloom which column holds the email.",
    };
  }
  if (emailColumns > 1) {
    return { mappings, ignored, error: "More than one column is mapped to email. Choose one." };
  }
  return { mappings, ignored, error: null };
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

export type ImportPreview = {
  file_name: string;
  total_rows: number;
  importable: number;
  new_customers: number;
  updated_customers: number;
  skipped_rows: number;
  skipped_invalid_email: number;
  skipped_duplicate_in_file: number;
  invalid_email_examples: string[];
  duplicate_email_examples: string[];
  stays_unsubscribed: number;
  column_mapping: Record<string, string>;
  ignored_mapping_suggestions: string[];
};

export function summarizeImport(args: {
  fileName: string;
  totalRows: number;
  built: BuiltImportCustomers;
  mappings: ImportColumnMapping[];
  ignored: string[];
  existingEmails: Set<string>;
  unsubscribedEmails: Set<string>;
}): ImportPreview {
  const emails = args.built.customers.map((customer) => String(customer.email));
  const updated = emails.filter((email) => args.existingEmails.has(email)).length;
  return {
    file_name: args.fileName,
    total_rows: args.totalRows,
    importable: emails.length,
    new_customers: emails.length - updated,
    updated_customers: updated,
    skipped_rows: args.built.invalidEmailRows.length + args.built.duplicatesMerged,
    skipped_invalid_email: args.built.invalidEmailRows.length,
    skipped_duplicate_in_file: args.built.duplicatesMerged,
    invalid_email_examples: args.built.invalidEmailRows
      .slice(0, EXAMPLE_LIMIT)
      .map((row) => `Row ${row.row + 1}: ${row.value ? `"${row.value}"` : "no email"}`),
    duplicate_email_examples: args.built.duplicateEmails.slice(0, EXAMPLE_LIMIT),
    stays_unsubscribed: emails.filter((email) => args.unsubscribedEmails.has(email)).length,
    column_mapping: Object.fromEntries(
      args.mappings.map((mapping) => [mapping.csvHeader, mapping.databaseField]),
    ),
    ignored_mapping_suggestions: args.ignored,
  };
}

function skipReasons(preview: ImportPreview): string {
  const reasons = [
    preview.skipped_invalid_email > 0
      ? `${preview.skipped_invalid_email} with a missing or invalid email`
      : null,
    preview.skipped_duplicate_in_file > 0
      ? `${preview.skipped_duplicate_in_file} repeated email${preview.skipped_duplicate_in_file === 1 ? "" : "s"} merged into the first row`
      : null,
  ].filter(Boolean);
  return reasons.length > 0 ? reasons.join("; ") : "none";
}

export function previewFieldDiffs(preview: ImportPreview): JsonObject[] {
  const diffs: JsonObject[] = [
    { field: "File", current_value: null, new_value: preview.file_name },
    { field: "Rows in file", current_value: null, new_value: preview.total_rows },
    { field: "New customers", current_value: null, new_value: preview.new_customers },
    { field: "Existing customers updated", current_value: null, new_value: preview.updated_customers },
    { field: "Rows skipped", current_value: null, new_value: preview.skipped_rows },
    { field: "Why rows are skipped", current_value: null, new_value: skipReasons(preview) },
  ];
  if (preview.invalid_email_examples.length > 0) {
    diffs.push({ field: "Invalid email examples", current_value: null, new_value: preview.invalid_email_examples.join("; ") });
  }
  if (preview.stays_unsubscribed > 0) {
    diffs.push({
      field: "Stay unsubscribed",
      current_value: null,
      new_value: `${preview.stays_unsubscribed} already unsubscribed or suppressed; they are not opted back in`,
    });
  }
  diffs.push({
    field: "Columns",
    current_value: null,
    new_value: Object.entries(preview.column_mapping)
      .map(([header, field]) => `${header} → ${field === "skip" ? "not imported" : field}`)
      .join("; "),
  });
  if (preview.ignored_mapping_suggestions.length > 0) {
    diffs.push({ field: "Mapping suggestions not used", current_value: null, new_value: preview.ignored_mapping_suggestions.join(" ") });
  }
  return diffs;
}

// ---------------------------------------------------------------------------
// Loading the file
// ---------------------------------------------------------------------------

type LoadedList = {
  upload: ConversationUpload;
  headers: string[];
  dataRows: string[][];
  mapping: MappingResolution;
  built: BuiltImportCustomers;
};

type LoadOutcome = { ok: true; list: LoadedList } | { ok: false; result: ToolResult };

export type ImportDependencies = {
  readUpload: (upload: ConversationUpload) => Promise<Uint8Array>;
};

// attachments.ts loads the spreadsheet parser, so it is imported only when a
// file is actually read.
const loadAttachments = () => import("../../attachments.ts");

const defaultDependencies = (context: ToolExecutionContext): ImportDependencies => ({
  readUpload: async (upload) =>
    (await loadAttachments()).downloadAttachmentBytes(context.serviceClient, upload.storagePath),
});

async function loadList(
  params: JsonObject,
  context: ToolExecutionContext,
  deps: ImportDependencies,
): Promise<LoadOutcome> {
  let upload: ConversationUpload;
  try {
    upload = await resolveConversationUpload(context.serviceClient, {
      tenantId: context.tenantId,
      userId: context.userId,
      conversationId: context.conversationId,
      reference: readString(params.upload_id),
      kinds: ["csv", "excel"],
    });
  } catch (error) {
    if (error instanceof UploadAccessError) {
      return { ok: false, result: failure(error.message, "forbidden") };
    }
    throw error;
  }

  const kind = upload.kind === "excel" ? "excel" : "csv";
  const bytes = await deps.readUpload(upload);
  const rows = await (await loadAttachments()).parseSpreadsheetRows(bytes, kind);
  if (rows.length < 2) {
    return { ok: false, result: failure(`"${upload.filename}" needs a header row and at least one contact.`, "validation_error") };
  }
  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header, index) => header.trim() || `Column ${index + 1}`);
  if (dataRows.length > CHAT_IMPORT_MAX_ROWS) {
    return {
      ok: false,
      result: failure(
        `"${upload.filename}" has ${dataRows.length.toLocaleString("en-US")} rows. Bloom can import up to ${CHAT_IMPORT_MAX_ROWS.toLocaleString("en-US")} contacts at a time from chat. Split the file, or use Customers > Import for the whole list.`,
        "import_too_large",
      ),
    };
  }

  const mapping = resolveColumnMapping(headers, dataRows, params.column_mapping);
  if (mapping.error) {
    return { ok: false, result: failure(mapping.error, "validation_error") };
  }
  const built = buildImportCustomers(dataRows, mapping.mappings);
  if (built.customers.length === 0) {
    return {
      ok: false,
      result: failure(`No row in "${upload.filename}" has a valid email address, so there is nothing to import.`, "validation_error"),
    };
  }
  return { ok: true, list: { upload, headers, dataRows, mapping, built } };
}

/** Pins what the person approves to the exact file and the mapping it showed. */
function pinnedParams(list: LoadedList): JsonObject {
  const mapping: JsonObject = {};
  for (const column of list.mapping.mappings) mapping[column.csvHeader] = column.databaseField;
  return { upload_id: list.upload.storagePath, column_mapping: mapping };
}

async function readExisting(
  client: PersistenceClient,
  tenantId: string,
  emails: string[],
): Promise<{ existing: Set<string>; unsubscribed: Set<string> }> {
  const existing = new Set<string>();
  const unsubscribed = new Set<string>();
  for (let index = 0; index < emails.length; index += 200) {
    const chunk = emails.slice(index, index + 200);
    const { data, error } = await client
      .from("crm_customers")
      .select("email, email_opt_out_at")
      .eq("tenant_id", tenantId)
      .in("email", chunk);
    if (error) throw new Error(`Could not check existing customers: ${error.message}`);
    for (const row of Array.isArray(data) ? data : []) {
      if (!isRecord(row) || typeof row.email !== "string") continue;
      const email = row.email.trim().toLowerCase();
      existing.add(email);
      if (row.email_opt_out_at) unsubscribed.add(email);
    }
    const { data: suppressed, error: suppressionError } = await client
      .from("suppression_list")
      .select("email")
      .eq("tenant_id", tenantId)
      .eq("channel", "email")
      .is("lifted_at", null)
      .in("email", chunk);
    if (suppressionError) throw new Error(`Could not check unsubscribes: ${suppressionError.message}`);
    for (const row of Array.isArray(suppressed) ? suppressed : []) {
      if (isRecord(row) && typeof row.email === "string") unsubscribed.add(row.email.trim().toLowerCase());
    }
  }
  return { existing, unsubscribed };
}

/** The CRM's own access check: this tenant, and owner or marketing access. */
async function checkImportAccess(client: RpcClient, tenantId: string): Promise<string | null> {
  const { data, error } = await client.rpc("get_current_crm_access");
  if (error || !isRecord(data)) return "Bloom could not confirm your access to import customers.";
  if (data.tenantId !== tenantId) return "Customer imports run in the company you are signed in to. Switch to it and ask again.";
  if (typeof data.role !== "string" || !IMPORT_ROLES.has(data.role)) {
    return "Importing customers needs owner or marketing access.";
  }
  return null;
}

export async function prepareCustomerListImport(
  params: JsonObject,
  context: ToolExecutionContext,
  deps: ImportDependencies = defaultDependencies(context),
): Promise<ToolResult> {
  if (!context.dataClient) return failure("Bloom could not confirm your access to import customers.", "forbidden");
  const accessProblem = await checkImportAccess(context.dataClient, context.tenantId);
  if (accessProblem) return failure(accessProblem, "forbidden");

  const loaded = await loadList(params, context, deps);
  if (!loaded.ok) return loaded.result;
  const { list } = loaded;
  const { existing, unsubscribed } = await readExisting(
    context.serviceClient,
    context.tenantId,
    list.built.customers.map((customer) => String(customer.email)),
  );
  const preview = summarizeImport({
    fileName: list.upload.filename,
    totalRows: list.dataRows.length,
    built: list.built,
    mappings: list.mapping.mappings,
    ignored: list.mapping.ignored,
    existingEmails: existing,
    unsubscribedEmails: unsubscribed,
  });
  const attestation = chatImportAttestation();
  const action = `Import ${preview.importable} contact${preview.importable === 1 ? "" : "s"} from "${preview.file_name}"`;
  const details: ConfirmationDetails = {
    action,
    affected_count: preview.importable,
    reversible: false,
    risk_level: "medium",
    tool_name: IMPORT_CUSTOMER_LIST_TOOL,
  };
  return result({
    success: true,
    message: `${action}: ${preview.new_customers} new, ${preview.updated_customers} updated, ${preview.skipped_rows} skipped (${skipReasons(preview)}). Approving records your express-consent statement and opts these contacts in to marketing email.`,
    blockType: "confirmation",
    count: preview.importable,
    confirmation: details,
    data: {
      tool_name: IMPORT_CUSTOMER_LIST_TOOL,
      confirmation_details: details,
      pinned_tool_params: pinnedParams(list),
      preview: preview as unknown as JsonObject,
      task_plan: {
        field_diffs: previewFieldDiffs(preview),
        notice: {
          title: "By approving, you confirm:",
          body: attestation.wording,
          detail: attestation.detail,
        },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Approved run
// ---------------------------------------------------------------------------

type BatchResponse = {
  imported: number;
  created: number;
  updated: number;
  customers: Array<{ id: string }>;
  errors: Array<{ row: number; email: string | null; message: string }>;
};

function readBatch(value: unknown): BatchResponse {
  const record = isRecord(value) ? value : {};
  const number = (key: string) => (typeof record[key] === "number" ? record[key] as number : 0);
  return {
    imported: number("imported"),
    created: number("created"),
    updated: number("updated"),
    customers: Array.isArray(record.customers)
      ? record.customers.filter((item): item is { id: string } => isRecord(item) && typeof item.id === "string")
      : [],
    errors: Array.isArray(record.errors)
      ? record.errors.filter(isRecord).map((item) => ({
        row: typeof item.row === "number" ? item.row : 0,
        email: typeof item.email === "string" ? item.email : null,
        message: typeof item.message === "string" ? item.message : "Row failed",
      }))
      : [],
  };
}

export type ImportRunSummary = {
  created: number;
  updated: number;
  failed: number;
  not_reached: number;
  errors: string[];
  customer_ids: string[];
};

/** Sends the rows through import_crm_customer_batch, in the dialog's batch size. */
export async function runImportBatches(
  client: RpcClient,
  customers: Array<Record<string, unknown>>,
  attestationId: string,
  options: { now?: () => number; budgetMs?: number } = {},
): Promise<ImportRunSummary> {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.budgetMs ?? CHAT_IMPORT_TIME_BUDGET_MS);
  const summary: ImportRunSummary = { created: 0, updated: 0, failed: 0, not_reached: 0, errors: [], customer_ids: [] };

  for (let offset = 0; offset < customers.length; offset += CUSTOMER_IMPORT_BATCH_SIZE) {
    if (now() > deadline) {
      summary.not_reached = customers.length - offset;
      break;
    }
    const batch = customers.slice(offset, offset + CUSTOMER_IMPORT_BATCH_SIZE);
    const outcomes = await importCustomerBatch(batch, async (rows) => {
      const { data, error } = await client.rpc("import_crm_customer_batch", {
        p_customers: rows,
        p_attestation_id: attestationId,
      });
      if (error) throw error;
      return readBatch(data);
    }, offset);
    for (const outcome of outcomes) {
      if (!outcome.result) {
        summary.failed += outcome.count;
        summary.errors.push(errorMessage(outcome.error));
        continue;
      }
      summary.created += outcome.result.created;
      summary.updated += outcome.result.updated;
      summary.failed += outcome.result.errors.length;
      summary.errors.push(...outcome.result.errors.map((rowError) =>
        `${rowError.email ?? `Row ${outcome.offset + rowError.row}`}: ${rowError.message}`
      ));
      summary.customer_ids.push(...outcome.result.customers.map((customer) => customer.id));
    }
  }
  return summary;
}

export async function executeCustomerListImport(
  params: JsonObject,
  context: ToolExecutionContext,
  deps: ImportDependencies = defaultDependencies(context),
): Promise<ToolResult> {
  const client = context.dataClient;
  if (!client) return failure("Bloom could not confirm your access to import customers.", "forbidden");
  const accessProblem = await checkImportAccess(client, context.tenantId);
  if (accessProblem) return failure(accessProblem, "forbidden");

  const loaded = await loadList(params, context, deps);
  if (!loaded.ok) return loaded.result;
  const { list } = loaded;
  const customers = list.built.customers;
  const attestation = chatImportAttestation();

  // The approving person's attestation header, exactly as the import dialog writes it.
  const { data: begin, error: beginError } = await client.rpc("begin_customer_csv_import", {
    p_attestation_type: CHAT_IMPORT_ATTESTATION,
    p_contact_count: customers.length,
    p_import_batch_id: `bloom-chat:${list.upload.filename}`.slice(0, 200),
    p_attestation_wording: attestation.wording,
  });
  if (beginError) return failure(`The import could not start: ${beginError.message}`, "execution_error");
  if (!isRecord(begin) || typeof begin.attestationId !== "string" || begin.tenantId !== context.tenantId) {
    return failure("The import consent record could not be created.", "execution_error");
  }

  const run = await runImportBatches(client, customers, begin.attestationId);

  if (run.customer_ids.length > 0) {
    // Same follow-up as the import dialog; a failure here does not undo the import.
    const { error } = await client.functions.invoke("recompute-segment-memberships", {
      body: { tenant_id: context.tenantId, customer_ids: run.customer_ids },
    });
    if (error) run.errors.push(`Customers imported, but the segment refresh failed: ${errorMessage(error)}`);
  }

  const imported = run.created + run.updated;
  const skipped = list.built.invalidEmailRows.length + list.built.duplicatesMerged;
  const parts = [
    `Imported ${imported} of ${customers.length} contacts from "${list.upload.filename}": ${run.created} new, ${run.updated} updated.`,
    skipped > 0 ? `${skipped} rows were skipped (missing/invalid email or repeated in the file).` : null,
    run.failed > 0 ? `${run.failed} rows failed.` : null,
    run.not_reached > 0
      ? `${run.not_reached} contacts were not imported because the import ran out of time. Ask Bloom to import the file again to finish; contacts already imported are updated, not duplicated.`
      : null,
    "Your express-consent statement was recorded with this import.",
  ].filter(Boolean);

  return result({
    success: imported > 0,
    message: parts.join(" "),
    error: imported > 0 ? null : "execution_error",
    blockType: "text",
    count: imported,
    data: {
      file_name: list.upload.filename,
      attestation_id: begin.attestationId,
      attestation_type: CHAT_IMPORT_ATTESTATION,
      created: run.created,
      updated: run.updated,
      failed: run.failed,
      skipped,
      not_reached: run.not_reached,
      errors: run.errors.slice(0, 20),
    },
  });
}

export async function importCustomerList(
  params: JsonObject,
  context: ToolExecutionContext,
): Promise<ToolResult> {
  return context.approved === true
    ? await executeCustomerListImport(params, context)
    : await prepareCustomerListImport(params, context);
}
