// Bloom Support — high-level actions shared by the REST API and the MCP server.
import { BloomError, type Caller, directRpc, mutationRpc, rpc, str, uuid } from "./runtime.ts";
import { sanitizeContext, redactText, STATUS_LABEL } from "./policy.ts";
import { randomToken, sha256Hex } from "./crypto.ts";
import { describeOperations, executeOperation, previewOperation, runRead, undoOperation } from "./operations.ts";
import { emailConfig } from "./email.ts";
import { aiConfig, completeJson } from "./ai.ts";
import { cleanPlain, type EscalationContext, PLAIN_SCHEMA, PLAIN_SYSTEM, plainPrompt } from "./plain-escalation.ts";
import { env } from "./runtime.ts";

const A = (c: Caller) => ({ actor: c.principalId });

const MESSAGE_PURPOSES = new Set([
  "reply",
  "clarification",
  "resolution",
  "acknowledgement",
  "progress",
  "feature_decision",
  "notification",
]);
const MAX_TICKET_BODY_LENGTH = 20_000;
const MAX_TICKET_SUBJECT_LENGTH = 300;

function boundedString(value: unknown, name: string, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length > maxLength) {
    throw new BloomError(400, "invalid", `${name} must be ${maxLength.toLocaleString("en-US")} characters or fewer`);
  }
  return value;
}

function messagePurpose(value: unknown): string {
  const purpose = str(value, 30) ?? "reply";
  if (!MESSAGE_PURPOSES.has(purpose)) {
    throw new BloomError(400, "invalid", "Unsupported message purpose");
  }
  return purpose;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

interface TrustedCreateTicketOptions {
  /** Computed only by the signed intake handler, where attachment manifests are available. */
  intakeFingerprint: string;
}

export function requireWriteScope(c: Caller) {
  if (c.scopes.length && !c.scopes.includes("write") && !c.scopes.includes("*")) throw new BloomError(403, "forbidden", "This API key is read-only");
}

export const actions = {
  me: (c: Caller) => rpc("whoami", A(c)),
  summary: (c: Caller) => rpc("queue_summary", A(c)),
  listTickets: (c: Caller, filters: Record<string, unknown>) => rpc("list_tickets", { ...A(c), filters }),
  mergeTickets(c: Caller, source: string, target: string, reason?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "merge_tickets", { ...A(c), source_id: uuid(source, "source_id"), target_id: uuid(target, "target_id"), reason: reason ?? null });
  },
  reconcileTicketLinks(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    if (!["platform_admin", "platform_operator", "support"].includes(c.role)) {
      throw new BloomError(403, "forbidden", "A staff person must reconcile ticket links");
    }
    return directRpc("bloom_support_reconcile_ticket_links", {
      p_actor: c.principalId, p_ticket: uuid(id, "ticket_id"), p_request: input,
    });
  },
  setSpam(c: Caller, id: string, spam: boolean) {
    requireWriteScope(c);
    return mutationRpc(c, "set_spam", { ...A(c), ticket_id: uuid(id, "ticket_id"), spam });
  },
  bulkUpdate(c: Caller, ids: unknown, bulk: Record<string, unknown>) {
    requireWriteScope(c);
    const list = Array.isArray(ids) ? ids.map((x) => uuid(x, "ticket_ids[]")) : [];
    return mutationRpc(c, "bulk_update", { ...A(c), ticket_ids: list, bulk });
  },
  clientAction(c: Caller, id: string, action: string, message?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "client_action", { ...A(c), ticket_id: uuid(id, "ticket_id"), action, message: message ?? null });
  },
  decidePostReply(c: Caller, id: string, decision: string, messageId?: string, note?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "resolve_post_reply", { ...A(c), ticket_id: uuid(id, "ticket_id"), decision, message_id: messageId ?? null, note: note ?? null });
  },
  timers: (c: Caller, id: string) => rpc("ticket_timers", { ...A(c), ticket_id: uuid(id, "ticket_id") }),
  listProblems: (c: Caller, status?: string) => rpc("list_problems", { ...A(c), status: status ?? null }),
  createProblem(c: Caller, problem: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "create_problem", { ...A(c), problem });
  },
  linkProblem(c: Caller, ticket: string, problem: string) {
    requireWriteScope(c);
    return mutationRpc(c, "link_problem", { ...A(c), ticket_id: uuid(ticket, "ticket_id"), problem_id: uuid(problem, "problem_id") });
  },
  updateProblem(c: Caller, id: string, patch: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "update_problem", { ...A(c), problem_id: uuid(id, "problem_id"), patch });
  },
  listViews: (c: Caller) => rpc("list_views", A(c)),
  saveView(c: Caller, name: string, filters: Record<string, unknown>, shared: boolean) {
    requireWriteScope(c);
    return mutationRpc(c, "save_view", { ...A(c), name, filters, shared });
  },
  deleteView(c: Caller, id: string) {
    requireWriteScope(c);
    return mutationRpc(c, "delete_view", { ...A(c), view_id: uuid(id, "view_id") });
  },
  metrics: (c: Caller, from?: string, to?: string) => rpc("report_metrics", { ...A(c), from: from ?? null, to: to ?? null }),
  summary_report: (c: Caller, period: string) => rpc("summary_report", { ...A(c), period }),
  setAccountAutomation(c: Caller, id: string, paused: boolean) {
    requireWriteScope(c);
    return mutationRpc(c, "set_account_automation", { ...A(c), account_id: uuid(id, "account_id"), paused });
  },
  getTicket: (c: Caller, id: string) => rpc("get_ticket", { ...A(c), ticket_id: uuid(id, "ticket_id") }),

  async createTicket(
    c: Caller,
    input: Record<string, unknown>,
    channel = "staff",
    trusted?: TrustedCreateTicketOptions,
  ) {
    requireWriteScope(c);
    const body = redactText(boundedString(
      input.body ?? input.description ?? input.message,
      "body",
      MAX_TICKET_BODY_LENGTH,
    ) ?? "");
    const ticket = {
      product: str(input.product, 20) ?? "unknown",
      channel: str(input.channel, 20) ?? channel,
      subject: redactText(boundedString(input.subject, "subject", MAX_TICKET_SUBJECT_LENGTH) ?? ""),
      body,
      kind_hint: str(input.kind, 20) ?? str(input.kind_hint, 20),
      priority_hint: str(input.priority, 20) ?? str(input.priority_hint, 20),
      account_id: str(input.account_id, 40) ?? null,
      conversation_id: str(input.conversation_id, 40) ?? null,
      requester_id: str(input.requester_id, 40) ?? null,
      context: sanitizeContext(input.context),
      dedupe_key: str(input.idempotency_key ?? input.dedupe_key, 200) ?? null,
    };
    const intakeFingerprint = ticket.dedupe_key
      ? trusted?.intakeFingerprint ?? await sha256Hex(JSON.stringify(canonical(ticket)))
      : null;
    if (trusted && !/^[0-9a-f]{64}$/.test(trusted.intakeFingerprint)) {
      throw new BloomError(500, "invalid_fingerprint", "Internal intake fingerprint is invalid");
    }
    return await mutationRpc(c, "create_ticket", {
      ...A(c),
      ticket: {
        ...ticket,
        intake_fingerprint: intakeFingerprint,
      },
    });
  },

  addMessage(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "add_message", {
      ...A(c), ticket_id: uuid(id, "ticket_id"),
      message: {
        body: boundedString(input.body, "body", MAX_TICKET_BODY_LENGTH),
        visibility: str(input.visibility, 10) ?? "public",
        purpose: messagePurpose(input.purpose),
        idempotency_key: str(input.idempotency_key, 200) ?? null,
        notify_client: input.notify_client ?? true,
      },
    });
  },
  sendAndSolve(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    boundedString(input.body, "body", MAX_TICKET_BODY_LENGTH);
    return directRpc("bloom_support_send_and_solve", {
      p_actor: c.principalId, p_ticket: uuid(id, "ticket_id"), p_request: input,
    });
  },
  async updateTicket(c: Caller, id: string, patch: Record<string, unknown>) {
    requireWriteScope(c);
    const ticketId = uuid(id, "ticket_id");
    let trustedPatch = patch;
    // A staff member confirms the affected flow in the desk UI. For a linked
    // fix, take deployment evidence from the trusted database record rather
    // than making the browser reproduce internal release metadata.
    if (patch.status === "resolved" && c.role !== "service") {
      const ticket = await rpc<Record<string, unknown>>("get_ticket", {
        ...A(c),
        ticket_id: ticketId,
      });
      const engineering = ticket.engineering && typeof ticket.engineering === "object"
        ? ticket.engineering as Record<string, unknown>
        : null;
      const deployment = engineering?.deployment;
      if (ticket.engineering_issue_id && deployment && typeof deployment === "object") {
        const evidence = patch.resolution_evidence && typeof patch.resolution_evidence === "object"
          ? patch.resolution_evidence as Record<string, unknown>
          : {};
        trustedPatch = {
          ...patch,
          resolution_evidence: {
            ...evidence,
            deployment,
            release_verification: engineering?.verification ?? null,
            engineering_issue_id: ticket.engineering_issue_id,
          },
        };
      }
    }
    return mutationRpc(c, "update_ticket", { ...A(c), ticket_id: ticketId, patch: trustedPatch });
  },
  setAutomation(c: Caller, id: string, mode: string, reason?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "set_automation", { ...A(c), ticket_id: uuid(id, "ticket_id"), mode, reason: reason ?? null });
  },
  linkTickets(c: Caller, from: string, to: string, kind: string) {
    requireWriteScope(c);
    return mutationRpc(c, "link_tickets", { ...A(c), from: uuid(from, "ticket_id"), to: uuid(to, "to"), kind });
  },
  related: (c: Caller, id: string) => rpc("related_tickets", { ...A(c), ticket_id: uuid(id, "ticket_id") }),
  startInvestigation(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "open_engineering_issue", { ...A(c), ticket_id: uuid(id, "ticket_id"), issue: { title: str(input.title, 300), repository: str(input.repository, 200), existing_issue_id: str(input.existing_issue_id, 40), evidence: { requested_by: c.name ?? c.principalId, note: redactText(str(input.note, 4000) ?? "") } } });
  },
  // Only Jon or Jeff, as themselves, can let a coding agent work on a bug Bloom or Support reported.
  startRepair(c: Caller, id: string, note?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "update_engineering_issue", { ...A(c), issue_id: uuid(id, "issue_id"), update: { start_repair: true, note: str(note, 2000) ?? null } });
  },
  routeFeature(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "route_feature_request", { ...A(c), ticket_id: uuid(id, "ticket_id"), feature: { title: str(input.title, 300), description: str(input.description, 5000), feature_request_id: str(input.feature_request_id, 40), excerpt: str(input.excerpt, 1000) } });
  },
  escalate(c: Caller, id: string, input: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "escalate", { ...A(c), ticket_id: uuid(id, "ticket_id"), audience: str(input.audience, 10) ?? "both", reason: str(input.reason, 500) ?? "Needs a decision", detail: str(input.detail, 4000) ?? null, dedupe_key: str(input.dedupe_key, 200) ?? null });
  },
  listAccounts: (c: Caller, q?: string) => rpc("list_accounts", { ...A(c), q: q ?? null }),
  getAccount: (c: Caller, id: string) => rpc("get_account", { ...A(c), account_id: uuid(id, "account_id") }),
  updateAccount(c: Caller, id: string, patch: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "update_account", { ...A(c), account_id: uuid(id, "account_id"), patch });
  },
  listEngineering: (c: Caller, status?: string) => rpc("list_engineering", { ...A(c), status: status ?? null }),
  updateEngineering(c: Caller, id: string, update: Record<string, unknown>) {
    requireWriteScope(c);
    return mutationRpc(c, "update_engineering_issue", { ...A(c), issue_id: uuid(id, "issue_id"), update });
  },
  resumeRelease(c: Caller, id: string, version: number) {
    requireWriteScope(c);
    if (!Number.isSafeInteger(version) || version < 1) {
      throw new BloomError(400, "invalid", "An exact current engineering version is required");
    }
    return directRpc("bloom_support_resume_release", {
      p_actor: c.principalId, p_issue: uuid(id, "issue_id"), p_version: version,
    });
  },
  listFeatures: (c: Caller, status?: string) => rpc("list_features", { ...A(c), status: status ?? null }),
  decideFeature(c: Caller, id: string, decision: string, note?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "decide_feature_request", { ...A(c), feature_request_id: uuid(id, "feature_request_id"), decision, note: note ?? null });
  },
  listEscalations: (c: Caller, openOnly = true) => rpc("list_escalations", { ...A(c), open_only: openOnly }),
  /**
   * A plain-language summary of one escalation for the Support desk. Written
   * once by the model, validated, then stored; later calls return the stored
   * text. Returns plain: null when the model is unavailable or its answer was
   * rejected, so the desk keeps its own wording.
   */
  async explainEscalation(c: Caller, id: string) {
    requireWriteScope(c);
    const escalationId = uuid(id, "escalation_id");
    const ctx = await directRpc<EscalationContext & { plain?: unknown; account_key?: string }>("bloom_support_escalation_context", { p_actor: c.principalId, p_escalation: escalationId });
    if (ctx.plain) return { plain: ctx.plain };
    const answer = await completeJson<{ problem: string; blocker: string }>({
      system: PLAIN_SYSTEM, user: plainPrompt(ctx), schemaName: "plain_escalation", schema: PLAIN_SCHEMA,
      accountKey: ctx.account_key ?? "none", timeoutMs: 20_000,
    });
    if (!answer.ok) return { plain: null, reason: answer.reason };
    const clean = cleanPlain(answer.value);
    if (!clean) return { plain: null, reason: "summary rejected: too long or technical" };
    const plain = await directRpc("bloom_support_save_escalation_plain", { p_actor: c.principalId, p_escalation: escalationId, p_plain: { ...clean, model: answer.model } });
    return { plain };
  },
  acknowledgeEscalation(c: Caller, id: string, note?: string) {
    requireWriteScope(c);
    return mutationRpc(c, "acknowledge_escalation", { ...A(c), escalation_id: uuid(id, "escalation_id"), note: note ?? null });
  },
  resolveEscalation(c: Caller, id: string, decision: string) {
    requireWriteScope(c);
    return mutationRpc(c, "resolve_escalation", { ...A(c), escalation_id: uuid(id, "escalation_id"), decision });
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
  recordReconciliation(c: Caller, id: string, outcome: unknown, verification: unknown, note: unknown) {
    requireWriteScope(c);
    const allowed = new Set(["applied", "not_applied", "undone", "not_undone"]);
    if (typeof outcome !== "string" || !allowed.has(outcome)) {
      throw new BloomError(400, "invalid", "Unsupported reconciliation outcome");
    }
    if (!verification || typeof verification !== "object" || Array.isArray(verification)) {
      throw new BloomError(400, "invalid", "verification must be an object with passed=true and the evidence checked");
    }
    const boundedNote = boundedString(note, "note", 2_000);
    if (!boundedNote?.trim()) throw new BloomError(400, "invalid", "note is required");
    return mutationRpc(c, "reconcile_operation", {
      ...A(c),
      operation_id: uuid(id, "operation_id"),
      outcome,
      verification,
      note: boundedNote,
    });
  },
  getOperation: (c: Caller, id: string) => rpc("get_operation", { ...A(c), operation_id: uuid(id, "operation_id") }),
  listJobs: (c: Caller, status?: string) => rpc("list_jobs", { ...A(c), status: status ?? null }),
  controlJob(c: Caller, id: string, action: string) {
    requireWriteScope(c);
    return mutationRpc(c, "control_job", { ...A(c), job_id: uuid(id, "job_id"), action });
  },
  getSettings: (c: Caller) => rpc("get_settings", A(c)),
  setSetting(c: Caller, key: string, value: unknown) {
    requireWriteScope(c);
    return mutationRpc(c, "set_setting", { ...A(c), key, value });
  },
  listStaff: (c: Caller) => rpc("list_staff", A(c)),
  // Bloom chat spending cap (platform admins only; enforced in the database).
  chatSpend: (c: Caller) => directRpc("bloom_chat_spend_overview", { p_actor: c.principalId }),
  setChatSpendCap(c: Caller, tenantId: string, capUsd: unknown, note?: string) {
    requireWriteScope(c);
    const cap = capUsd === null ? null : Number(capUsd);
    if (cap !== null && (!Number.isFinite(cap) || cap < 0)) throw new BloomError(400, "invalid", "cap_usd must be a number of US dollars, or null to use the default");
    return directRpc("bloom_chat_spend_set_cap", { p_actor: c.principalId, p_tenant_id: uuid(tenantId, "tenant_id"), p_cap_usd: cap, p_note: note ?? null });
  },
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
      ...(env("BLOOM_GITHUB_REPAIR_TOKEN") ? [] : ["BLOOM_GITHUB_REPAIR_TOKEN"]),
      ...(env("BLOOM_GITHUB_RELEASE_TOKEN") ? [] : ["BLOOM_GITHUB_RELEASE_TOKEN"]),
    ];
    return {
      ok: true,
      missing_configuration: [...new Set(missing)],
      email: {
        configured: email.configured,
        sending_inbox: email.sendingAddress,
        public_inbox: email.publicAddress,
      },
      ai: { provider: ai.provider, model: ai.model },
      operations: ops,
      statuses: STATUS_LABEL,
    };
  },
};
