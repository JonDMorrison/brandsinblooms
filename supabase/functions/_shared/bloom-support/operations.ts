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
  "client.lookup", "campaign.list", "campaign.read", "site.read", "site.pages", "event.list", "pos.products", "pos.inventory", "pos.sales_summary", "pos.price_history", "site.preview_link",
]);
export const WRITE_OPERATIONS = new Set([
  "campaign.create_draft", "campaign.update_draft", "campaign.schedule", "campaign.unschedule",
  "site.page.update", "site.create_draft", "site.publish", "event.update",
  "site.section.update", "site.section.reorder", "site.section.visibility",
]);
const PERMISSION: Record<string, string> = {
  ...OPERATION_PERMISSIONS,
  "campaign.list": "ops.campaign.edit",
  "site.pages": "ops.site.read",
  "event.list": "ops.site.read",
  "site.preview_link": "ops.site.read",
};

export function describeOperations() {
  return {
    reads: [...READ_OPERATIONS].map((k) => ({ kind: k, permission: PERMISSION[k] })),
    changes: [...WRITE_OPERATIONS].map((k) => ({ kind: k, permission: PERMISSION[k], undo: UNDOABLE.has(k) })),
    remote: { cms: remoteConfigured("cms"), pos: remoteConfigured("pos") },
  };
}
const UNDOABLE = new Set(["campaign.schedule", "campaign.unschedule", "campaign.update_draft", "site.page.update", "site.publish", "event.update", "site.section.update", "site.section.reorder", "site.section.visibility"]);

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
  if (!res.ok) throw new BloomError(res.status === 403 ? 403 : res.status === 404 ? 404 : res.status === 400 ? 400 : res.status === 409 ? 409 : 502, out?.error ?? "product_error", out?.message ?? `${product} returned ${res.status}`);
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
    case "site.preview_link":
      result = await callProduct("cms", req.kind, { site_id: linkFor(account, "cms", inputs), inputs, actor: actorFacts(caller) });
      break;
    case "pos.products":
    case "pos.inventory":
    case "pos.sales_summary":
    case "pos.price_history":
      result = await callProduct("pos", req.kind, { pos_tenant_id: linkFor(account, "pos", inputs), inputs, actor: actorFacts(caller) });
      break;
  }
  if (caller.role !== "service") await audit({ inputs: Object.keys(inputs) });
  return result;
}

function actorFacts(caller: Caller) {
  return { principal_id: caller.principalId, role: caller.role, name: caller.name ?? null, via: caller.via };
}


/** Site creation uses the authenticated person's stored email, never model input. */
async function siteCreationActor(caller: Caller) {
  if (caller.role === "service") throw new BloomError(403, "forbidden", "Site creation needs a person to confirm it");
  for (const permission of ["ops.site.create", "accounts.write"]) {
    if (!await rpc<boolean>("has_permission", { actor: caller.principalId, permission })) {
      throw new BloomError(403, "forbidden", permission + " required");
    }
  }
  const me = await rpc<{ email: string | null }>("whoami", { actor: caller.principalId });
  if (!me.email) throw new BloomError(403, "forbidden", "A verified person is required for site creation");
  return { ...actorFacts(caller), email: me.email };
}
const siteUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Builds and records a preview. Nothing changes in the product. */
export async function previewOperation(caller: Caller, req: OperationRequest): Promise<Record<string, unknown>> {
  if (!WRITE_OPERATIONS.has(req.kind)) throw new BloomError(400, "invalid", `Unknown change operation ${req.kind}`);
  const permission = PERMISSION[req.kind];
  // Check before any product is asked for a preview, so a caller without the
  // permission learns nothing about the client's data.
  if (!await rpc<boolean>("has_permission", { actor: caller.principalId, permission })) {
    throw new BloomError(403, "forbidden", `${permission} required`);
  }
  const inputs = { ...(req.inputs ?? {}) };
  const account = await loadAccount(caller, req.account_id);
  let preview: Record<string, unknown>;
  switch (req.kind) {
    case "site.create_draft": {
      const actor = await siteCreationActor(caller);
      const hasAnchor = account.links.some(link => link.product === "cms");
      const site_id = hasAnchor || inputs.site_id != null ? linkFor(account, "cms", inputs) : null;
      const result = await callProduct("cms", "site.create_draft.preview", {
        account_id: account.id, account_name: account.name, site_id, inputs, actor,
      });
      const guard = result.guard as Record<string, unknown> | undefined;
      if (!guard || guard.expected_account_id !== account.id || !siteUuid(guard.expected_creator_id)
          || typeof guard.expected_creator_email !== "string"
          || !Object.hasOwn(guard, "expected_tenant_id") || !Object.hasOwn(guard, "expected_anchor_site_id")
          || guard.expected_anchor_site_id !== site_id) {
        throw new BloomError(502, "verification_failed", "BloomSites did not return a valid client and creator preview");
      }
      Object.assign(inputs, guard);
      preview = result;
      break;
    }
    case "campaign.schedule": {
      const facts = await opsRpc<Record<string, unknown>>("campaign_facts", { actor: caller.principalId, account_id: account.id, campaign_id: inputs.campaign_id });
      if (typeof inputs.scheduled_at !== "string" || Number.isNaN(Date.parse(inputs.scheduled_at))) throw new BloomError(400, "invalid", "scheduled_at (ISO time) required");
      const tz = typeof inputs.timezone === "string" ? inputs.timezone : "America/Toronto";
      let local = inputs.scheduled_at;
      try {
        local = new Intl.DateTimeFormat("en-CA", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(new Date(inputs.scheduled_at));
      } catch { /* invalid timezone: keep ISO */ }
      const aud = facts.audience as { segments: Array<{ name: string }>; include_all_customers: boolean; additional_customers: number; projected_recipients: number | null };
      const content = facts.content as { channel: string; subject: string | null; preheader: string | null; sender_name: string | null; sender_email: string | null; excerpt: string };
      const client = facts.client as { name: string } | null;
      // Fingerprint of audience + content: execution refuses if either changed after this preview.
      inputs.fingerprint = facts.fingerprint;
      inputs.timezone = tz;
      preview = {
        summary: `Schedule "${facts.name}" for ${client?.name ?? account.name}: ${aud.projected_recipients ?? "?"} recipients, ${local} (${tz})`,
        client: { account: account.name, crm_tenant: client?.name ?? null },
        audience: { segments: aud.segments.map((s) => s.name), include_all_customers: aud.include_all_customers, additional_customers: aud.additional_customers, projected_recipients: aud.projected_recipients },
        content: { channel: content.channel, subject: content.subject, preheader: content.preheader, from: `${content.sender_name ?? ""} <${content.sender_email ?? "default sender"}>`, excerpt: content.excerpt },
        timing: { scheduled_at_utc: inputs.scheduled_at, local, timezone: tz, irreversible_after: inputs.scheduled_at },
        campaign: facts.campaign,
      };
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
      // The product returns the state the person reviewed (e.g. the page version). It is stored with the
      // operation and overrides any caller-supplied value, so execution refuses if that state changed.
      const guard = (r as { guard?: unknown } | null)?.guard;
      if (guard && typeof guard === "object" && !Array.isArray(guard)) Object.assign(inputs, guard);
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
  already?: boolean; undo?: Record<string, unknown> | null; result?: unknown; permission: string; expires_at: string;
}

/**
 * Executes a previewed operation exactly once. Every change requires a person:
 * service identities may prepare previews but never execute or undo.
 */
export async function executeOperation(caller: Caller, operationId: string): Promise<Record<string, unknown>> {
  // Every change is confirmed by a person. Service identities may prepare previews only.
  if (caller.role === "service") throw new BloomError(403, "forbidden", "This change needs a person to confirm it");
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
    case "site.create_draft": {
      const actor = await siteCreationActor(caller);
      const account = await loadAccount(caller, op.account_id);
      const anchor = inputs.expected_anchor_site_id;
      if (anchor !== null && (!siteUuid(anchor) || !account.links.some(link => link.product === "cms" && link.external_id === anchor))) {
        throw new BloomError(403, "forbidden", "The reviewed anchor is no longer linked to this client");
      }
      const expiry = Date.parse(op.expires_at);
      if (!Number.isFinite(expiry)) throw new BloomError(500, "invalid_operation", "The creation request has no valid expiry");
      const response = await callProduct("cms", "site.create_draft", {
        account_id: account.id, account_name: account.name, site_id: anchor, inputs, actor,
        operation_id: op.id, resume_only: expiry < Date.now(),
      });
      const result = response.result as { site?: { id?: unknown; created_by?: unknown; tenant_id?: unknown; is_published?: unknown; commerce_enabled?: unknown }; account_id?: unknown } | undefined;
      const verification = response.verification as Record<string, unknown> | undefined;
      if (!result?.site || !siteUuid(result.site.id) || !siteUuid(result.site.tenant_id)
          || result.account_id !== account.id || verification?.passed !== true || verification.account_id !== account.id
          || result.site.created_by !== inputs.expected_creator_id || result.site.is_published !== false || result.site.commerce_enabled !== false) {
        throw new BloomError(502, "verification_failed", "The new client draft could not be verified");
      }
      const siteId = result.site.id;
      if (!account.links.some(link => link.product === "cms" && link.external_id === siteId)) {
        await rpc("update_account", { actor: caller.principalId, account_id: account.id,
          patch: { link: { product: "cms", external_id: siteId, label: String(inputs.name ?? account.name).slice(0, 200) } } });
      }
      const saved = await loadAccount(caller, account.id);
      if (!saved.links.some(link => link.product === "cms" && link.external_id === siteId)) {
        throw new BloomError(502, "verification_failed", "The draft exists but its client link needs recovery");
      }
      return { result, verification: { ...verification, account_linked: true }, undo: null };
    }
    case "campaign.schedule": {
      const r = await opsRpc<Record<string, unknown>>("campaign_schedule", {
        actor: caller.principalId, account_id: op.account_id, campaign_id: inputs.campaign_id, scheduled_at: inputs.scheduled_at, timezone: inputs.timezone ?? null,
        fingerprint: inputs.fingerprint ?? null,
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
      // A draft edit has no automatic undo: the snapshot is a read model, not the
      // editable fields, so replaying it could change more than the edit did.
      // Keep the before state as evidence and say plainly that undo is done in the product.
      return {
        result: r.data,
        verification: { passed: !!after, campaign: after, ...(before ? { before, undo: "Change it back in the campaign editor" } : {}) },
        undo: null,
      };
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
  if (caller.role === "service") throw new BloomError(403, "forbidden", "Undoing a change needs a person to confirm it");
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
