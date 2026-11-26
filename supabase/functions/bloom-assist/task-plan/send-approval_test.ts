// cd supabase/functions && deno test -A --config deno.json bloom-assist/task-plan/send-approval_test.ts
import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import type { JsonObject, PersistenceClient } from "../types.ts";
import type { ToolExecutionContext } from "../tools/types.ts";
import { executeTool } from "../tools/executor.ts";
import { preparePlanForApproval } from "./executor.ts";
import type { TaskPlan, TaskPlanItem } from "./types.ts";

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "33333333-3333-4333-8333-333333333333";
const CAMPAIGN = "55555555-5555-4555-8555-555555555555";
const OTHER_CAMPAIGN = "66666666-6666-4666-8666-666666666666";

/** Records every table and RPC the tool touches; only the execution log may be written. */
function recordingClient() {
  const tables: string[] = [];
  const rpcs: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "in", "is", "order", "limit", "update", "upsert"]) {
    builder[method] = () => builder;
  }
  builder.insert = () => Promise.resolve({ error: null });
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
  builder.single = () => Promise.resolve({ data: null, error: null });
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null });
  const client = {
    from(table: string) {
      tables.push(table);
      return builder;
    },
    rpc(fn: string) {
      rpcs.push(fn);
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as PersistenceClient;
  return { client, tables, rpcs };
}

function contextFor(client: PersistenceClient, approved: boolean): ToolExecutionContext {
  return {
    tenantId: TENANT,
    userId: USER,
    userRole: "admin",
    userName: "Owner",
    conversationId: "conversation-1",
    messageId: "message-1",
    timezone: "UTC",
    authenticatedTenantId: TENANT,
    serviceClient: client,
    dataClient: client,
    approved,
  } as ToolExecutionContext;
}

for (const approved of [false, true]) {
  Deno.test(`send_campaign without send_mode never sends or offers approval (approved=${approved})`, async () => {
    const { client, tables, rpcs } = recordingClient();
    const result = await executeTool("send_campaign", { campaign_id: CAMPAIGN }, contextFor(client, approved));

    assertEquals(result.success, false);
    assertEquals(result.error, "validation_error");
    assertEquals(result.confirmation_required, false);
    const issues = JSON.stringify(result.data);
    assertStringIncludes(issues, "send_mode");
    // Nothing but the execution log: no campaign read, no send RPC.
    assertEquals(tables, ["bloom_tool_executions"]);
    assertEquals(rpcs, []);
  });
}

function sendTask(toolParams: JsonObject): TaskPlanItem {
  return {
    task_id: "task_1",
    action: "send",
    entity_type: "campaign",
    entity_id: CAMPAIGN,
    entity_name: "Spring sale",
    tool_name: "send_campaign",
    tool_params: toolParams,
    description: "Send campaign now",
    field_changes: null,
    risk_level: "high",
    depends_on: [],
    editable_fields: [],
    validation_annotations: [],
    status: "pending",
    error_message: null,
  };
}

function planWith(task: TaskPlanItem): TaskPlan {
  return {
    plan_id: "plan-1",
    originating_message_id: "message-1",
    summary: "Send campaign",
    risk_level: task.risk_level,
    compact: false,
    compact_confirmation: null,
    tasks: [task],
    created_at: new Date(0).toISOString(),
  };
}

Deno.test("approving a stored send without send_mode fails instead of defaulting", () => {
  const plan = planWith(sendTask({ campaign_id: CAMPAIGN }));
  const { plan: prepared } = preparePlanForApproval(plan, ["task_1"], [], {}, null);

  assertEquals(prepared.tasks[0].status, "failed");
  assertStringIncludes(prepared.tasks[0].error_message ?? "", "send_mode");
  assertEquals(prepared.tasks[0].tool_params, { campaign_id: CAMPAIGN });
});

Deno.test("approval edits cannot add send_mode or retarget the campaign, and retry keeps the preview", () => {
  const plan = planWith(sendTask({ campaign_id: CAMPAIGN }));
  const forgedEdits: JsonObject[] = [{ send_mode: "now" }, { campaign_id: OTHER_CAMPAIGN }];
  for (const edits of forgedEdits) {
    const rejected = preparePlanForApproval(plan, ["task_1"], [], { task_1: edits }, null);
    assertEquals(rejected.plan.tasks[0].status, "failed");
    assertStringIncludes(rejected.plan.tasks[0].error_message ?? "", "cannot change after preview");
    assertEquals(rejected.plan.tasks[0].tool_params, { campaign_id: CAMPAIGN });

    const retry = preparePlanForApproval(rejected.plan, [], [], {}, "task_1");
    assertEquals(retry.plan.tasks[0].status, "failed");
    assertEquals(retry.plan.tasks[0].tool_params, { campaign_id: CAMPAIGN });
  }
});

Deno.test("fields the approval card offered can still be edited", () => {
  const task: TaskPlanItem = {
    ...sendTask({}),
    action: "update",
    tool_name: "update_campaign",
    tool_params: { campaign_id: CAMPAIGN, changes: { subject_line: "Old" } },
    risk_level: "medium",
    editable_fields: ["changes.subject_line"],
  };
  const { plan } = preparePlanForApproval(planWith(task), ["task_1"], [], { task_1: { "changes.subject_line": "New" } }, null);
  assert(plan.tasks[0].status === "approved", plan.tasks[0].error_message ?? "");
  assertEquals((plan.tasks[0].tool_params.changes as JsonObject).subject_line, "New");
});
