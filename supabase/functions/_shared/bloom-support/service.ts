// Bloom Support — high-level actions shared by the REST API and the MCP server.
import { BloomError, type Caller, rpc, str, uuid } from "./runtime.ts";
import { sanitizeContext, redactText, STATUS_LABEL } from "./policy.ts";
import { randomToken, sha256Hex } from "./crypto.ts";
import { describeOperations, executeOperation, previewOperation, runRead, undoOperation } from "./operations.ts";
import { emailConfig } from "./email.ts";
import { aiConfig } from "./ai.ts";
import { env } from "./runtime.ts";

const A = (c: Caller) => ({ actor: c.principalId });

export function requireWriteScope(c: Caller) {
  if (c.scopes.length && !c.scopes.includes("write") && !c.scopes.includes("*")) throw new BloomError(403, "forbidden", "This API key is read-only");
}

export const actions = {
  me: (c: Caller) => rpc("whoami", A(c)),
  summary: (c: Caller) => rpc("queue_summary", A(c)),
  listTickets: (c: Caller, filters: Record<string, unknown>) => rpc("list_tickets", { ...A(c), filters }),
  getTicket: (c: Caller, id: string) => rpc("get_ticket", { ...A(c), ticket_id: uuid(id, "ticket_id") }),

  async createTicket(c: Caller, input: Record<string, unknown>, channel = "staff") {
    requireWriteScope(c);
    const body = redactText(str(input.body ?? input.description ?? input.message) ?? "");
    return await rpc("create_ticket", {
      ...A(c),
      ticket: {
        product: str(input.product, 20) ?? "unknown",
        channel: str(input.channel, 20) ?? channel,
        subject: redactText(str(input.subject, 300) ?? ""),
        body,
        kind_hint: str(input.kind, 20) ?? str(input.kind_hint, 20),
        priority_hint: str(input.priority, 20) ?? str(input.priority_hint, 20),
        account_id: str(input.account_id, 40) ?? null,
        conversation_id: str(input.conversation_id, 40) ?? null,
        requester_id: str(input.requester_id, 40) ?? null,
        context: sanitizeContext(input.context),
        dedupe_key: str(input.idempotency_key ?? input.dedupe_key, 200) ?? null,
      },
    });
  },

  addMessage(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("add_message", {
      ...A(c), ticket_id: uuid(id, "ticket_id"),
      message: { body: str(input.body), visibility: str(input.visibility, 10) ?? "public", idempotency_key: str(input.idempotency_key, 200) ?? null, notify_client: input.notify_client ?? true },
    });
  },
  updateTicket(c: Caller, id: string, patch: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("update_ticket", { ...A(c), ticket_id: uuid(id, "ticket_id"), patch });
  },
  setAutomation(c: Caller, id: string, mode: string, reason?: string) {
    requireWriteScope(c);
    return rpc("set_automation", { ...A(c), ticket_id: uuid(id, "ticket_id"), mode, reason: reason ?? null });
  },
  linkTickets(c: Caller, from: string, to: string, kind: string) {
    requireWriteScope(c);
    return rpc("link_tickets", { ...A(c), from: uuid(from, "ticket_id"), to: uuid(to, "to"), kind });
  },
  related: (c: Caller, id: string) => rpc("related_tickets", { ...A(c), ticket_id: uuid(id, "ticket_id") }),
  startInvestigation(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("open_engineering_issue", { ...A(c), ticket_id: uuid(id, "ticket_id"), issue: { title: str(input.title, 300), repository: str(input.repository, 200), existing_issue_id: str(input.existing_issue_id, 40), evidence: { requested_by: c.name ?? c.principalId, note: redactText(str(input.note, 4000) ?? "") } } });
  },
  routeFeature(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("route_feature_request", { ...A(c), ticket_id: uuid(id, "ticket_id"), feature: { title: str(input.title, 300), description: str(input.description, 5000), feature_request_id: str(input.feature_request_id, 40), excerpt: str(input.excerpt, 1000) } });
  },
  escalate(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("escalate", { ...A(c), ticket_id: uuid(id, "ticket_id"), audience: str(input.audience, 10) ?? "both", reason: str(input.reason, 500) ?? "Needs a decision", detail: str(input.detail, 4000) ?? null, dedupe_key: str(input.dedupe_key, 200) ?? null });
  },
  listAccounts: (c: Caller, q?: string) => rpc("list_accounts", { ...A(c), q: q ?? null }),
  getAccount: (c: Caller, id: string) => rpc("get_account", { ...A(c), account_id: uuid(id, "account_id") }),
  updateAccount(c: Caller, id: string, patch: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("update_account", { ...A(c), account_id: uuid(id, "account_id"), patch });
  },
  listEngineering: (c: Caller, status?: string) => rpc("list_engineering", { ...A(c), status: status ?? null }),
  updateEngineering(c: Caller, id: string, update: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("update_engineering_issue", { ...A(c), issue_id: uuid(id, "issue_id"), update });
  },
  listFeatures: (c: Caller, status?: string) => rpc("list_features", { ...A(c), status: status ?? null }),
  decideFeature(c: Caller, id: string, decision: string, note?: string) {
    requireWriteScope(c);
    return rpc("decide_feature_request", { ...A(c), feature_request_id: uuid(id, "feature_request_id"), decision, note: note ?? null });
  },
  listEscalations: (c: Caller, openOnly = true) => rpc("list_escalations", { ...A(c), open_only: openOnly }),
  resolveEscalation(c: Caller, id: string, decision: string) {
    requireWriteScope(c);
    return rpc("resolve_escalation", { ...A(c), escalation_id: uuid(id, "escalation_id"), decision });
  },
  operationsCatalog: () => describeOperations(),
  readOperation: (c: Caller, input: Record<string, unknown>) =>
    runRead(c, { kind: String(input.kind), account_id: uuid(input.account_id, "account_id"), ticket_id: str(input.ticket_id, 40) ?? null, inputs: (input.inputs as Record<string, unknown>) ?? {} }),
  previewOperation(c: Caller, input: Record<string, unknown>) {
    requireWriteScope(c);
    return previewOperation(c, { kind: String(input.kind), account_id: uuid(input.account_id, "account_id"), ticket_id: str(input.ticket_id, 40) ?? null, inputs: (input.inputs as Record<string, unknown>) ?? {}, idempotency_key: str(input.idempotency_key, 200) });
  },
  executeOperation(c: Caller, id: string) {
    requireWriteScope(c);
    return executeOperation(c, uuid(id, "operation_id"));
  },
  undoOperation(c: Caller, id: string) {
    requireWriteScope(c);
    return undoOperation(c, uuid(id, "operation_id"));
  },
  getOperation: (c: Caller, id: string) => rpc("get_operation", { ...A(c), operation_id: uuid(id, "operation_id") }),
  listJobs: (c: Caller, status?: string) => rpc("list_jobs", { ...A(c), status: status ?? null }),
  controlJob(c: Caller, id: string, action: string) {
    requireWriteScope(c);
    return rpc("control_job", { ...A(c), job_id: uuid(id, "job_id"), action });
  },
  getSettings: (c: Caller) => rpc("get_settings", A(c)),
  setSetting(c: Caller, key: string, value: unknown) {
    requireWriteScope(c);
    return rpc("set_setting", { ...A(c), key, value });
  },
  listStaff: (c: Caller) => rpc("list_staff", A(c)),
  setRole(c: Caller, principal: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("set_principal_role", { ...A(c), principal });
  },
  listKeys: (c: Caller) => rpc("list_api_keys", A(c)),
  async createKey(c: Caller, input: Record<string, unknown>) {
    requireWriteScope(c);
    if (c.via !== "crm_session") throw new BloomError(403, "forbidden", "Create API keys from a signed-in BloomSuite session");
    const token = `bsk_${randomToken(32)}`;
    const days = Math.min(Number(input.expires_days ?? 365) || 365, 730);
    const id = await rpc<string>("create_api_key", {
      ...A(c), principal_id: str(input.principal_id, 40) ?? c.principalId, label: str(input.label, 100) ?? "API key",
      prefix: token.slice(0, 10), hash: await sha256Hex(token), scopes: Array.isArray(input.scopes) ? input.scopes : [],
      expires_at: new Date(Date.now() + days * 86400_000).toISOString(),
    });
    return { id, token, note: "Shown once. Store it in your ChatGPT connector or secret manager." };
  },
  revokeKey(c: Caller, id: string) {
    requireWriteScope(c);
    return rpc("revoke_api_key", { ...A(c), key_id: uuid(id, "key_id") });
  },
  createServiceIdentity(c: Caller, name: string, scope: string) {
    requireWriteScope(c);
    return rpc("create_service_principal", { ...A(c), name, grants: [scope] });
  },
  notifications: (c: Caller, markRead = false) => rpc("list_notifications", { ...A(c), mark_read: markRead }),
  listKnowledge: (c: Caller) => rpc("list_knowledge", A(c)),
  saveKnowledge(c: Caller, article: Record<string, unknown>) {
    requireWriteScope(c);
    return rpc("upsert_knowledge", { ...A(c), article });
  },
  async health(c: Caller) {
    await rpc("queue_summary", A(c));
    const ai = await aiConfig();
    const email = emailConfig();
    const ops = describeOperations().remote;
    const missing = [
      ...email.missing,
      ...ai.missing,
      ...(env("RESEND_INBOUND_WEBHOOK_SECRET") ? [] : ["RESEND_INBOUND_WEBHOOK_SECRET"]),
      ...(env("BLOOM_INTAKE_SECRET_CMS") ? [] : ["BLOOM_INTAKE_SECRET_CMS"]),
      ...(env("BLOOM_INTAKE_SECRET_POS") ? [] : ["BLOOM_INTAKE_SECRET_POS"]),
      ...ops.cms.missing, ...ops.pos.missing,
      ...["AUTOMATION", "INVESTIGATION", "RELEASE"].filter((s) => !env(`BLOOM_SERVICE_KEY_${s}`)).map((s) => `BLOOM_SERVICE_KEY_${s}`),
      ...(env("BLOOM_GITHUB_REPAIR_TOKEN") ? [] : ["BLOOM_GITHUB_REPAIR_TOKEN"]),
      ...(env("BLOOM_GITHUB_RELEASE_TOKEN") ? [] : ["BLOOM_GITHUB_RELEASE_TOKEN"]),
    ];
    return { ok: true, missing_configuration: [...new Set(missing)], email: { configured: email.configured, inbox: email.supportAddress }, ai: { provider: ai.provider, model: ai.model }, operations: ops, statuses: STATUS_LABEL };
  },
  async track(token: string) {
    if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) throw new BloomError(404, "not_found", "Link not found");
    const t = await rpc("ticket_by_tracking_token", { hash: await sha256Hex(token) });
    if (!t) throw new BloomError(404, "not_found", "This link has expired or does not exist");
    return t;
  },
};
