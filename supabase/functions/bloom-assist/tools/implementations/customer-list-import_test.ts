// cd supabase/functions && deno test -A --config deno.json bloom-assist/tools/implementations/customer-list-import_test.ts
import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { getAttestationOption } from "../../../../../src/lib/crm/importAttestationOptions.ts";
import { pathBelongsTo, resolveConversationUpload } from "../../conversation-uploads.ts";
import type { PersistenceClient } from "../../types.ts";
import type { ToolExecutionContext } from "../types.ts";
import {
  applyPhotoToCampaignParams,
  copyPhotoToCampaignImages,
  resolveCampaignPhoto,
} from "./campaign-photo.ts";
import {
  CHAT_IMPORT_MAX_ROWS,
  executeCustomerListImport,
  prepareCustomerListImport,
  resolveColumnMapping,
  runImportBatches,
} from "./customer-list-import.ts";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const CONVERSATION = "44444444-4444-4444-8444-444444444444";
const CSV_PATH = `${TENANT}/${CONVERSATION}/aaaa_contacts.csv`;
const PHOTO_PATH = `${TENANT}/${CONVERSATION}/bbbb_tulips.jpg`;

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;
type RpcCall = { fn: string; args: Row };

/** A small in-memory stand-in for the PostgREST query builder. */
function fakeClient(tables: Tables, rpc: (fn: string, args: Row) => { data: unknown; error: unknown } = () => ({ data: null, error: null })) {
  const rpcCalls: RpcCall[] = [];
  const invokes: Row[] = [];
  const uploads: Array<{ bucket: string; path: string; type: string }> = [];
  const client = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let limit = Infinity;
      const run = () => (tables[table] ?? []).filter((row) => filters.every((f) => f(row))).slice(0, limit);
      const builder = {
        select: () => builder,
        eq: (key: string, value: unknown) => (filters.push((row) => row[key] === value), builder),
        in: (key: string, values: unknown[]) => (filters.push((row) => values.includes(row[key])), builder),
        is: (key: string, value: unknown) => (filters.push((row) => (row[key] ?? null) === value), builder),
        order: () => builder,
        limit: (n: number) => ((limit = n), builder),
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (resolve: (value: { data: Row[]; error: null }) => unknown) => resolve({ data: run(), error: null }),
      };
      return builder;
    },
    rpc(fn: string, args: Row = {}) {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpc(fn, args));
    },
    functions: {
      invoke: (name: string, options: Row) => {
        invokes.push({ name, ...options });
        return Promise.resolve({ data: null, error: null });
      },
    },
    storage: {
      from: (bucket: string) => ({
        upload: (path: string, body: Blob, options: { contentType: string }) => {
          uploads.push({ bucket, path, type: options.contentType ?? body.type });
          return Promise.resolve({ data: { path }, error: null });
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example.test/${bucket}/${path}` } }),
      }),
    },
  };
  return { client: client as unknown as PersistenceClient, rpcCalls, invokes, uploads };
}

function conversationTables(extra: Tables = {}, attachments: Row[] = [
  { filename: "contacts.csv", mime_type: "text/csv", size: 120, storage_path: CSV_PATH, processing_status: "ready" },
]): Tables {
  return {
    bloom_conversations: [{ id: CONVERSATION, tenant_id: TENANT, user_id: USER, status: "active" }],
    bloom_messages: [{ conversation_id: CONVERSATION, tenant_id: TENANT, user_id: USER, role: "user", attachments, created_at: "2026-11-06T10:00:00Z" }],
    ...extra,
  };
}

const access = (role = "owner_admin", tenantId = TENANT) => ({ tenantId, role, permissions: [] });

function contextFor(service: PersistenceClient, data: PersistenceClient, approved = false): ToolExecutionContext {
  return {
    tenantId: TENANT,
    userId: USER,
    userRole: "admin",
    userName: "Owner",
    conversationId: CONVERSATION,
    messageId: "msg-1",
    timezone: "UTC",
    serviceClient: service,
    dataClient: data,
    approved,
  } as ToolExecutionContext;
}

const csv = (text: string) => ({ readUpload: () => Promise.resolve(new TextEncoder().encode(text)) });

const LIST = [
  "Email,First Name,Last Name,Phone",
  "ann@example.com,Ann,Lee,555-111-2222",
  "BOB@example.com,Bob,,",
  "not-an-email,Cara,,",
  ",Dee,,",
  "ann@example.com,Annie,,",
  "existing@example.com,Eve,,",
  "gone@example.com,Gus,,",
].join("\n");

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

Deno.test("upload paths must be inside this tenant's and conversation's folder", () => {
  assert(pathBelongsTo(CSV_PATH, TENANT, CONVERSATION));
  assert(!pathBelongsTo(`${OTHER_TENANT}/${CONVERSATION}/x.csv`, TENANT, CONVERSATION));
  assert(!pathBelongsTo(`${TENANT}/other-conversation/x.csv`, TENANT, CONVERSATION));
  assert(!pathBelongsTo(`${TENANT}/${CONVERSATION}/../x.csv`, TENANT, CONVERSATION));
  assert(!pathBelongsTo(`${TENANT}/${CONVERSATION}/a/b.csv`, TENANT, CONVERSATION));
});

Deno.test("an upload reference from another tenant is refused before any lookup", async () => {
  const { client } = fakeClient(conversationTables());
  await assertRejects(
    () => resolveConversationUpload(client, { tenantId: TENANT, userId: USER, conversationId: CONVERSATION, reference: `${OTHER_TENANT}/${CONVERSATION}/x.csv`, kinds: ["csv"] }),
    Error,
    "not uploaded to this conversation",
  );
});

Deno.test("someone else's conversation is refused even with a well-formed path", async () => {
  const tables = conversationTables();
  tables.bloom_conversations = [{ id: CONVERSATION, tenant_id: TENANT, user_id: "someone-else", status: "active" }];
  const { client } = fakeClient(tables);
  await assertRejects(
    () => resolveConversationUpload(client, { tenantId: TENANT, userId: USER, conversationId: CONVERSATION, reference: CSV_PATH, kinds: ["csv"] }),
    Error,
    "not uploaded to this conversation",
  );
});

Deno.test("a path in the right folder that was never attached by this person is refused", async () => {
  const { client } = fakeClient(conversationTables());
  await assertRejects(
    () => resolveConversationUpload(client, { tenantId: TENANT, userId: USER, conversationId: CONVERSATION, reference: `${TENANT}/${CONVERSATION}/zzzz_other.csv`, kinds: ["csv"] }),
    Error,
    "not uploaded to this conversation",
  );
});

Deno.test("with no reference the latest spreadsheet in the conversation is used", async () => {
  const { client } = fakeClient(conversationTables());
  const upload = await resolveConversationUpload(client, { tenantId: TENANT, userId: USER, conversationId: CONVERSATION, reference: null, kinds: ["csv", "excel"] });
  assertEquals(upload.storagePath, CSV_PATH);
  assertEquals(upload.kind, "csv");
});

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

Deno.test("headers are matched deterministically", () => {
  const mapping = resolveColumnMapping(["E-mail", "First Name", "Mobile", "Favourite Plant"], [], undefined);
  assertEquals(mapping.error, null);
  assertEquals(mapping.mappings.map((m) => m.databaseField), ["email", "first_name", "phone", "custom:favourite_plant"]);
});

Deno.test("a model-proposed mapping is validated: unknown headers and fields are ignored", () => {
  const mapping = resolveColumnMapping(["Contact", "Name"], [["a@b.co", "Ann"]], {
    Contact: "email",
    Name: "password_hash",
    Missing: "first_name",
  });
  assertEquals(mapping.error, null);
  assertEquals(mapping.mappings.map((m) => m.databaseField), ["email", "custom:name"]);
  assertEquals(mapping.ignored.length, 2);
});

Deno.test("a file with no email column cannot be imported", () => {
  const mapping = resolveColumnMapping(["Name", "Phone"], [], undefined);
  assertStringIncludes(mapping.error ?? "", "email");
});

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

Deno.test("preview counts new, updated and skipped rows with reasons, and writes nothing", async () => {
  const service = fakeClient(conversationTables({
    crm_customers: [
      { tenant_id: TENANT, email: "existing@example.com", email_opt_out_at: null },
      { tenant_id: TENANT, email: "gone@example.com", email_opt_out_at: "2026-01-01T00:00:00Z" },
      { tenant_id: OTHER_TENANT, email: "bob@example.com", email_opt_out_at: null },
    ],
    suppression_list: [],
  }));
  const data = fakeClient({}, (fn) => fn === "get_current_crm_access" ? { data: access(), error: null } : { data: null, error: { message: "unexpected" } });
  const preview = await prepareCustomerListImport({}, contextFor(service.client, data.client), csv(LIST));

  assert(preview.success);
  assertEquals(preview.confirmation_required, true);
  const payload = preview.data as Record<string, unknown>;
  const counts = payload.preview as Record<string, unknown>;
  assertEquals(counts.total_rows, 7);
  assertEquals(counts.importable, 4); // ann, bob, existing, gone
  assertEquals(counts.new_customers, 2); // bob only exists in another tenant
  assertEquals(counts.updated_customers, 2);
  assertEquals(counts.skipped_invalid_email, 2);
  assertEquals(counts.skipped_duplicate_in_file, 1);
  assertEquals(counts.stays_unsubscribed, 1);
  // Pins the exact file and mapping that were previewed.
  assertEquals((payload.pinned_tool_params as Record<string, unknown>).upload_id, CSV_PATH);
  // The card shows the express attestation wording verbatim.
  const notice = (payload.task_plan as Record<string, Record<string, unknown>>).notice;
  assertEquals(notice.body, getAttestationOption("express").wording);
  // Only the access check ran; no import RPCs.
  assertEquals(data.rpcCalls.map((c) => c.fn), ["get_current_crm_access"]);
});

Deno.test("preview refuses a list over the row cap with a clear message", async () => {
  const rows = ["email", ...Array.from({ length: CHAT_IMPORT_MAX_ROWS + 1 }, (_, i) => `p${i}@example.com`)].join("\n");
  const service = fakeClient(conversationTables({ crm_customers: [], suppression_list: [] }));
  const data = fakeClient({}, () => ({ data: access(), error: null }));
  const result = await prepareCustomerListImport({}, contextFor(service.client, data.client), csv(rows));
  assertEquals(result.success, false);
  assertEquals(result.error, "import_too_large");
  assertStringIncludes(result.message, "2,000");
});

Deno.test("preview refuses people without owner or marketing access", async () => {
  const service = fakeClient(conversationTables());
  const data = fakeClient({}, () => ({ data: access("staff"), error: null }));
  const result = await prepareCustomerListImport({}, contextFor(service.client, data.client), csv(LIST));
  assertEquals(result.success, false);
  assertEquals(result.error, "forbidden");
});

Deno.test("preview refuses when the signed-in CRM company is not this chat's company", async () => {
  const service = fakeClient(conversationTables());
  const data = fakeClient({}, () => ({ data: access("owner_admin", OTHER_TENANT), error: null }));
  const result = await prepareCustomerListImport({}, contextFor(service.client, data.client), csv(LIST));
  assertEquals(result.error, "forbidden");
});

// ---------------------------------------------------------------------------
// Approved run
// ---------------------------------------------------------------------------

Deno.test("approved import records the express attestation and imports through the CRM RPCs", async () => {
  const service = fakeClient(conversationTables());
  const data = fakeClient({}, (fn, args) => {
    if (fn === "get_current_crm_access") return { data: access("marketing"), error: null };
    if (fn === "begin_customer_csv_import") return { data: { attestationId: "att-1", tenantId: TENANT }, error: null };
    if (fn === "import_crm_customer_batch") {
      const rows = args.p_customers as Row[];
      return {
        data: { imported: rows.length, created: rows.length, updated: 0, customers: rows.map((_, i) => ({ id: `c-${i}` })), errors: [] },
        error: null,
      };
    }
    return { data: null, error: { message: "unexpected" } };
  });
  const result = await executeCustomerListImport(
    { upload_id: CSV_PATH },
    contextFor(service.client, data.client, true),
    csv(LIST),
  );
  assert(result.success, result.message);
  const begin = data.rpcCalls.find((c) => c.fn === "begin_customer_csv_import")!;
  assertEquals(begin.args.p_attestation_type, "express");
  assertEquals(begin.args.p_attestation_wording, getAttestationOption("express").wording);
  assertEquals(begin.args.p_contact_count, 4);
  const batches = data.rpcCalls.filter((c) => c.fn === "import_crm_customer_batch");
  assert(batches.every((c) => c.args.p_attestation_id === "att-1"));
  const sent = batches.flatMap((c) => c.args.p_customers as Row[]).map((r) => r.email);
  assertEquals(sent, ["ann@example.com", "bob@example.com", "existing@example.com", "gone@example.com"]);
  // The client never sets opt-in itself; consent comes from the attestation in the RPC.
  assert(batches.flatMap((c) => c.args.p_customers as Row[]).every((r) => r.email_opt_in === undefined));
  assertEquals(data.invokes.map((i) => i.name), ["recompute-segment-memberships"]);
});

Deno.test("an approved import with a forged upload id writes nothing", async () => {
  const service = fakeClient(conversationTables());
  const data = fakeClient({}, () => ({ data: access(), error: null }));
  const result = await executeCustomerListImport(
    { upload_id: `${OTHER_TENANT}/${CONVERSATION}/aaaa_contacts.csv` },
    contextFor(service.client, data.client, true),
    csv(LIST),
  );
  assertEquals(result.success, false);
  assertEquals(result.error, "forbidden");
  assertEquals(data.rpcCalls.map((c) => c.fn), ["get_current_crm_access"]);
});

Deno.test("batches stop at the time budget and report what was not reached", async () => {
  let clock = 0;
  const data = fakeClient({}, (_fn, args) => {
    clock += 60_000;
    const rows = args.p_customers as Row[];
    return { data: { imported: rows.length, created: rows.length, updated: 0, customers: [], errors: [] }, error: null };
  });
  const customers = Array.from({ length: 12 }, (_, i) => ({ email: `p${i}@example.com` }));
  const summary = await runImportBatches(data.client, customers, "att", { now: () => clock, budgetMs: 100_000 });
  assertEquals(summary.created, 10);
  assertEquals(summary.not_reached, 2);
});

// ---------------------------------------------------------------------------
// Campaign photo
// ---------------------------------------------------------------------------

const photoTables = () => conversationTables({}, [
  { filename: "tulips.jpg", mime_type: "image/jpeg", size: 2048, storage_path: PHOTO_PATH, processing_status: "ready" },
]);

Deno.test("a campaign photo must be this conversation's png/jpeg upload and not for SMS", async () => {
  const { client } = fakeClient(photoTables());
  const context = contextFor(client, client);
  const upload = await resolveCampaignPhoto(context, { photo_upload_id: "latest" });
  assertEquals(upload.storagePath, PHOTO_PATH);
  await assertRejects(() => resolveCampaignPhoto(context, { photo_upload_id: `${OTHER_TENANT}/${CONVERSATION}/bbbb_tulips.jpg` }), Error, "not uploaded");
  await assertRejects(() => resolveCampaignPhoto(context, { photo_upload_id: "latest", delivery_method: "sms" }), Error, "email campaign");
});

Deno.test("the photo is copied into campaign-images under the person's own folder", async () => {
  const { client, uploads } = fakeClient({});
  const url = await copyPhotoToCampaignImages({
    source: client,
    destination: client,
    userId: USER,
    upload: { storagePath: PHOTO_PATH, filename: "tulips.jpg", mimeType: "image/jpeg", size: 3, kind: "image" },
    read: () => Promise.resolve(new Uint8Array([1, 2, 3])),
  });
  assertEquals(uploads.length, 1);
  assertEquals(uploads[0].bucket, "campaign-images");
  assert(uploads[0].path.startsWith(`${USER}/studio/`));
  assert(uploads[0].path.endsWith(".jpg"));
  assertStringIncludes(url, "campaign-images");
});

Deno.test("the copied photo becomes the hero image or the top of a plain email, and the reference is dropped", () => {
  const designed = applyPhotoToCampaignParams(
    { name: "Spring", template_id: "botanical-seasonal", newsletter_brief: { headline: "Hi", introduction: "x", features: [] }, photo_upload_id: PHOTO_PATH },
    "https://cdn.example.test/p.jpg",
    "bbbb_tulips.jpg",
  );
  assertEquals((designed.newsletter_brief as Row).heroImageUrl, "https://cdn.example.test/p.jpg");
  assertEquals("photo_upload_id" in designed, false);

  const plain = applyPhotoToCampaignParams({ name: "Spring", content: "<p>Hello</p>", photo_upload_id: PHOTO_PATH }, "https://cdn.example.test/p.jpg", "tulips.jpg");
  assert(String(plain.content).startsWith('<p><img src="https://cdn.example.test/p.jpg"'));
  assertStringIncludes(String(plain.content), "<p>Hello</p>");
});

// ---------------------------------------------------------------------------
// Approval card
// ---------------------------------------------------------------------------

Deno.test("the task plan pins the previewed file, keeps the mapping read-only and carries the consent notice", async () => {
  const { generateTaskPlan } = await import("../../task-plan/generator.ts");
  const { taskPlanToJson } = await import("../../task-plan/types.ts");
  const service = fakeClient(conversationTables({ crm_customers: [], suppression_list: [] }));
  const data = fakeClient({}, () => ({ data: access(), error: null }));
  const preview = await prepareCustomerListImport({ upload_id: "latest" }, contextFor(service.client, data.client), csv(LIST));
  const plan = generateTaskPlan([{
    tool_call_id: "call-1",
    tool_name: "import_customer_list",
    tool_params: { upload_id: "latest" },
    tool_result: {
      success: true,
      data: preview.data,
      confirmation_required: true,
      confirmation_details: preview.confirmation_details,
    } as never,
    block_type: "confirmation",
    execution_time_ms: 1,
    error_message: null,
    iteration: 1,
  }], { tenantId: TENANT, userId: USER, userRole: "admin", userName: null, conversationId: CONVERSATION, messageId: "msg-1" } as never);
  const [task] = plan.tasks;
  assertEquals(task.tool_params.upload_id, CSV_PATH);
  assertEquals(task.action, "create");
  assertEquals(task.editable_fields.includes("column_mapping"), false);
  assertEquals(task.editable_fields.includes("upload_id"), false);
  assertStringIncludes(task.description, "Import 4 contacts");
  assert(task.field_changes?.some((change) => change.field === "New customers" && change.new_value === 4));
  const json = taskPlanToJson(plan) as { tasks: Array<{ notice: { body: string } }> };
  assertEquals(json.tasks[0].notice.body, getAttestationOption("express").wording);
});
