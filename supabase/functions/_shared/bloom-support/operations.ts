// Bloom Support — permissioned product operations.
//
// Reads run immediately and are audited. Changes follow
//   preview → (person or authorized identity) execute → verify → record
// and carry undo data where the product supports it. Every operation is
// re-authorized in the database (record_operation_preview / claim_operation)
// for the acting principal and the target account.
import { BloomError, type Caller, db, env, rpc } from "./runtime.ts";
import { OPERATION_PERMISSIONS } from "./policy.ts";
import { signIntake } from "./crypto.ts";
import { campaignMutationImplementation } from "../../bloom-assist/tools/implementations/campaign-mutations.ts";
import type { ToolExecutionContext } from "../../bloom-assist/tools/types.ts";

export const READ_OPERATIONS = new Set([
  "client.lookup", "campaign.list", "campaign.read", "site.read", "site.pages", "event.list", "pos.products", "pos.inventory", "pos.sales_summary",
]);
export const WRITE_OPERATIONS = new Set([
  "campaign.create_draft", "campaign.update_draft", "campaign.schedule", "campaign.unschedule",
  "site.page.update", "site.create_draft", "site.publish", "event.update",
]);
const PERMISSION: Record<string, string> = {
  ...OPERATION_PERMISSIONS,
  "campaign.list": "ops.campaign.edit",
  "site.pages": "ops.site.read",
  "event.list": "ops.site.read",
};

export function describeOperations() {
  return {
    reads: [...READ_OPERATIONS].map((k) => ({ kind: k, permission: PERMISSION[k] })),
    changes: [...WRITE_OPERATIONS].map((k) => ({ kind: k, permission: PERMISSION[k], undo: UNDOABLE.has(k) })),
    remote: { cms: remoteConfigured("cms"), pos: remoteConfigured("pos") },
  };
}
const UNDOABLE = new Set(["campaign.schedule", "campaign.unschedule", "campaign.update_draft", "site.page.update", "site.publish", "event.update"]);

async function opsRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await db().rpc("bloom_support_ops_rpc", { p_fn: fn, p: args });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : error.code === "22023" ? 400 : 500;
    throw new BloomError(status, status === 403 ? "forbidden" : status === 404 ? "not_found" : status === 400 ? "invalid" : "db_error", error.message);
  }
  return data as T;
}

interface Account {
  id: string;
  name: string;
  crm_tenant_id: string | null;
  links: Array<{ product: string; external_id: string; label: string | null }>;
}

async function loadAccount(caller: Caller, accountId: string): Promise<Account> {
  return await rpc<Account>("get_account", { actor: caller.principalId, account_id: accountId });
}

function linkFor(account: Account, product: "cms" | "pos", inputs: Record<string, unknown>): string {
  const links = account.links.filter((l) => l.product === product);
  const requested = typeof inputs.site_id === "string" ? inputs.site_id : typeof inputs.pos_tenant_id === "string" ? inputs.pos_tenant_id : null;
  if (requested) {
    // The target must be one of the account's own linked records.
    if (!links.some((l) => l.external_id === requested)) throw new BloomError(403, "forbidden", `${product} record is not linked to this account`);
    return requested;
  }
  if (links.length === 1) return links[0].external_id;
  if (links.length === 0) throw new BloomError(400, "invalid", `Account has no linked ${product === "cms" ? "BloomSites site" : "POS business"}`);
  throw new BloomError(400, "invalid", `Account has several ${product} links; pass ${product === "cms" ? "site_id" : "pos_tenant_id"}`);
}

// ---------------------------------------------------------------------------
// Remote product adapters (BloomSites, POS): signed server-to-server calls.
// ---------------------------------------------------------------------------
function remoteConfigured(product: "cms" | "pos"): { configured: boolean; missing: string[] } {
  const p = product.toUpperCase();
  const missing = [`BLOOM_OPS_URL_${p}`, `BLOOM_OPS_SECRET_${p}`].filter((k) => !env(k));
  return { configured: missing.length === 0, missing };
}

export async function callProduct(product: "cms" | "pos", action: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const cfg = remoteConfigured(product);
  if (!cfg.configured) throw new BloomError(503, "not_configured", `${product.toUpperCase()} operations are not connected: set ${cfg.missing.join(", ")}`);
  const body = JSON.stringify({ action, ...payload });
  const ts = Math.floor(Date.now() / 1000);
  const sig = await signIntake(env(`BLOOM_OPS_SECRET_${product.toUpperCase()}`)!, ts, body);
  const res = await fetch(env(`BLOOM_OPS_URL_${product.toUpperCase()}`)!, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-bloom-timestamp": String(ts), "x-bloom-signature": sig },
    body,
    signal: AbortSignal.timeout(25000),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new BloomError(res.status === 403 ? 403 : res.status === 404 ? 404 : res.status === 400 ? 400 : 502, out?.error ?? "product_error", out?.message ?? `${product} returned ${res.status}`);
  return out as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CRM campaigns: reuse the existing bloom-assist campaign implementations for
// drafts (same validation, audience resolution and duplicate checks).
// ---------------------------------------------------------------------------
async function tenantOwnerUserId(tenantId: string): Promise<string> {
  const { data } = await db().from("users").select("id, role").eq("tenant_id", tenantId).limit(25);
  const rows = (data ?? []) as Array<{ id: string; role: string | null }>;
  const owner = rows.find((r) => r.role === "owner") ?? rows.find((r) => r.role === "admin") ?? rows[0];
  if (!owner) throw new BloomError(400, "invalid", "The CRM tenant has no users to own the campaign");
  return owner.id;
}

async function runCampaignTool(tool: "create_campaign" | "update_campaign", tenantId: string, opId: string, params: Record<string, unknown>, approved: boolean) {
  const impl = campaignMutationImplementation(tool);
  if (!impl) throw new BloomError(500, "internal", `missing ${tool}`);
  const ctx: ToolExecutionContext = {
    tenantId,
    userId: await tenantOwnerUserId(tenantId),
    userRole: "owner",
    userName: "Bloom Support",
    conversationId: `bloom-op-${opId}`,
    messageId: `bloom-op-${opId}-${approved ? "exec" : "preview"}`,
    timezone: typeof params.timezone === "string" ? params.timezone : "America/Toronto",
    serviceClient: db(),
    approved,
  } as ToolExecutionContext;
  // deno-lint-ignore no-explicit-any
  const result = await impl(params as any, ctx);
  if (!result.success && !result.confirmation_required) throw new BloomError(400, "invalid", result.error ?? result.message ?? `${tool} failed`);
  return result;
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------
export interface OperationRequest {
  kind: string;
  account_id: string;
  ticket_id?: string | null;
  inputs?: Record<string, unknown>;
  idempotency_key?: string;
}

export async function runRead(caller: Caller, req: OperationRequest): Promise<unknown> {
  if (!READ_OPERATIONS.has(req.kind)) throw new BloomError(400, "invalid", `Unknown read operation ${req.kind}`);
  const permission = PERMISSION[req.kind];
  const allowed = await rpc<boolean>("has_permission", { actor: caller.principalId, permission });
  if (!allowed) throw new BloomError(403, "forbidden", `${permission} required`);
  const inputs = req.inputs ?? {};
  const account = await loadAccount(caller, req.account_id);
  const audit = (detail: Record<string, unknown>) =>
    rpc("log", { actor: caller.principalId, ticket_id: req.ticket_id ?? null, account_id: account.id, action: "operation.read", detail: { kind: req.kind, ...detail } }).catch(() => undefined);
  let result: unknown;
  switch (req.kind) {
    case "client.lookup":
      result = account;
      break;
    case "campaign.list":
      result = await opsRpc("campaign_list", { actor: caller.principalId, account_id: account.id, status: inputs.status ?? null });
      break;
    case "campaign.read":
      result = await opsRpc("campaign_facts", { actor: caller.principalId, account_id: account.id, campaign_id: inputs.campaign_id });
      break;
    case "site.read":
    case "site.pages":
    case "event.list":
      result = await callProduct("cms", req.kind, { site_id: linkFor(account, "cms", inputs), inputs, actor: actorFacts(caller) });
      break;
    case "pos.products":
    case "pos.inventory":
    case "pos.sales_summary":
      result = await callProduct("pos", req.kind, { pos_tenant_id: linkFor(account, "pos", inputs), inputs, actor: actorFacts(caller) });
      break;
  }
  if (caller.role !== "service") await audit({ inputs: Object.keys(inputs) });
  return result;
}

function actorFacts(caller: Caller) {
  return { principal_id: caller.principalId, role: caller.role, name: caller.name ?? null, via: caller.via };
}

/** Builds and records a preview. Nothing changes in the product. */
export async function previewOperation(caller: Caller, req: OperationRequest): Promise<Record<string, unknown>> {
  if (!WRITE_OPERATIONS.has(req.kind)) throw new BloomError(400, "invalid", `Unknown change operation ${req.kind}`);
  const permission = PERMISSION[req.kind];
  const inputs = req.inputs ?? {};
  const account = await loadAccount(caller, req.account_id);
  let preview: Record<string, unknown>;
  switch (req.kind) {
    case "campaign.schedule": {
      const facts = await opsRpc<Record<string, unknown>>("campaign_facts", { actor: caller.principalId, account_id: account.id, campaign_id: inputs.campaign_id });
      if (typeof inputs.scheduled_at !== "string" || Number.isNaN(Date.parse(inputs.scheduled_at))) throw new BloomError(400, "invalid", "scheduled_at (ISO time) required");
      preview = { summary: `Schedule "${facts.name}" to send at ${inputs.scheduled_at}`, campaign: facts, recipients: facts.projected_recipient_count, irreversible_after: inputs.scheduled_at };
      break;
    }
    case "campaign.unschedule": {
      const facts = await opsRpc<Record<string, unknown>>("campaign_facts", { actor: caller.principalId, account_id: account.id, campaign_id: inputs.campaign_id });
      preview = { summary: `Return "${facts.name}" to draft (cancel the scheduled send)`, campaign: facts };
      break;
    }
    case "campaign.create_draft":
    case "campaign.update_draft": {
      const tenant = await opsRpc<string>("campaign_tenant", { actor: caller.principalId, account_id: account.id, permission });
      const r = await runCampaignTool(req.kind === "campaign.create_draft" ? "create_campaign" : "update_campaign", tenant, crypto.randomUUID(), inputs, false);
      preview = { summary: r.confirmation_details?.action ?? r.message, details: r.confirmation_details ?? null, data: r.data ?? null };
      break;
    }
    default: {
      const product = "cms" as const;
      const site_id = linkFor(account, product, inputs);
      const r = await callProduct(product, `${req.kind}.preview`, { site_id, inputs, actor: actorFacts(caller) });
      preview = r;
    }
  }
  return await rpc("record_operation_preview", {
    actor: caller.principalId,
    operation: {
      account_id: account.id, ticket_id: req.ticket_id ?? null, kind: req.kind, permission, inputs, preview,
      idempotency_key: req.idempotency_key ?? `${caller.principalId}:${req.kind}:${crypto.randomUUID()}`,
    },
  });
}

interface OperationRow {
  id: string; kind: string; account_id: string; ticket_id: string | null; inputs: Record<string, unknown>; status: string;
  already?: boolean; undo?: Record<string, unknown> | null; result?: unknown; permission: string;
}

/**
 * Executes a previewed operation exactly once. Consequential sends require a
 * person: service identities may prepare previews but not execute campaign
 * scheduling or publishing.
 */
export async function executeOperation(caller: Caller, operationId: string): Promise<Record<string, unknown>> {
  const existing = await rpc<OperationRow>("get_operation", { actor: caller.principalId, operation_id: operationId });
  if (caller.role === "service" && ["campaign.schedule", "site.publish", "site.create_draft"].includes(existing.kind)) {
    throw new BloomError(403, "forbidden", "This change needs a person to confirm it");
  }
  const op = await rpc<OperationRow>("claim_operation", { actor: caller.principalId, operation_id: operationId });
  if (op.already || op.status !== "executing") return op as unknown as Record<string, unknown>;
  try {
    const { result, verification, undo } = await perform(caller, op);
    return await rpc("finish_operation", { actor: caller.principalId, operation_id: op.id, outcome: { status: "succeeded", result, verification, undo } });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await rpc("finish_operation", { actor: caller.principalId, operation_id: op.id, outcome: { status: "failed", error: message.slice(0, 1000) } });
    throw e;
  }
}

async function perform(caller: Caller, op: OperationRow): Promise<{ result: unknown; verification: unknown; undo: unknown }> {
  const inputs = op.inputs ?? {};
  switch (op.kind) {
    case "campaign.schedule": {
      const r = await opsRpc<Record<string, unknown>>("campaign_schedule", {
        actor: caller.principalId, account_id: op.account_id, campaign_id: inputs.campaign_id, scheduled_at: inputs.scheduled_at, timezone: inputs.timezone ?? null,
      });
      const after = await opsRpc<Record<string, unknown>>("campaign_facts", { actor: caller.principalId, account_id: op.account_id, campaign_id: inputs.campaign_id });
      return { result: r, verification: { checked: "campaign row", status: after.status, scheduled_at: after.scheduled_at, passed: after.status === "scheduled" }, undo: { kind: "campaign.unschedule", campaign_id: inputs.campaign_id } };
    }
    case "campaign.unschedule": {
      const r = await opsRpc<Record<string, unknown>>("campaign_unschedule", { actor: caller.principalId, account_id: op.account_id, campaign_id: inputs.campaign_id });
      const after = await opsRpc<Record<string, unknown>>("campaign_facts", { actor: caller.principalId, account_id: op.account_id, campaign_id: inputs.campaign_id });
      return { result: r, verification: { status: after.status, passed: after.status === "draft" }, undo: null };
    }
    case "campaign.create_draft":
    case "campaign.update_draft": {
      const tenant = await opsRpc<string>("campaign_tenant", { actor: caller.principalId, account_id: op.account_id, permission: op.permission });
      let before: Record<string, unknown> | null = null;
      if (op.kind === "campaign.update_draft") before = await opsRpc("campaign_facts", { actor: caller.principalId, account_id: op.account_id, campaign_id: inputs.campaign_id });
      const r = await runCampaignTool(op.kind === "campaign.create_draft" ? "create_campaign" : "update_campaign", tenant, op.id, inputs, true);
      if (!r.success) throw new BloomError(400, "invalid", r.error ?? "campaign change failed");
      const id = (r.data as Record<string, unknown> | null)?.campaign_id ?? (r.data as Record<string, unknown> | null)?.id ?? inputs.campaign_id;
      const after = id ? await opsRpc<Record<string, unknown>>("campaign_facts", { actor: caller.principalId, account_id: op.account_id, campaign_id: id }) : null;
      return { result: r.data, verification: { passed: !!after, campaign: after }, undo: before ? { kind: "campaign.update_draft", restore: before } : null };
    }
    default: {
      const account = await loadAccount(caller, op.account_id);
      const site_id = linkFor(account, "cms", inputs);
      const r = await callProduct("cms", op.kind, { site_id, inputs, actor: actorFacts(caller), operation_id: op.id });
      return { result: r.result ?? r, verification: r.verification ?? null, undo: r.undo ?? null };
    }
  }
}

/** Undo for operations that recorded restoration data. */
export async function undoOperation(caller: Caller, operationId: string): Promise<Record<string, unknown>> {
  const op = await rpc<OperationRow>("get_operation", { actor: caller.principalId, operation_id: operationId });
  if (op.status !== "succeeded" || !op.undo) throw new BloomError(400, "invalid", "This operation has no supported undo");
  const undo = op.undo as Record<string, unknown>;
  const allowed = await rpc<boolean>("has_permission", { actor: caller.principalId, permission: op.permission });
  if (!allowed) throw new BloomError(403, "forbidden", `${op.permission} required`);
  let result: unknown;
  if (undo.kind === "campaign.unschedule") {
    result = await opsRpc("campaign_unschedule", { actor: caller.principalId, account_id: op.account_id, campaign_id: undo.campaign_id });
  } else if (typeof undo.kind === "string" && undo.kind.startsWith("site.") || typeof undo.kind === "string" && undo.kind.startsWith("event.")) {
    const account = await loadAccount(caller, op.account_id);
    result = await callProduct("cms", `${undo.kind}.undo`, { site_id: linkFor(account, "cms", op.inputs ?? {}), undo, actor: actorFacts(caller), operation_id: op.id });
  } else {
    throw new BloomError(400, "invalid", "Undo for this operation must be done in the product");
  }
  return await rpc("finish_operation", { actor: caller.principalId, operation_id: op.id, outcome: { status: "undone", result } });
}
