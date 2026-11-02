/**
 * Bloom as a support agent: bridges the in-app assistant to the existing Bloom
 * Support desk (private schema bloom_support, reached only through the
 * service-role gateway public.bloom_support_rpc).
 *
 * - report_support_problem files a ticket for the company the person is working
 *   in, with server-collected diagnostics. Bloom-chat tickets start with
 *   automation paused, so the support worker never triages, emails or starts
 *   engineering work on them by itself. A person picks them up.
 * - check_support_request reads the person's own company's tickets.
 * - run_self_diagnostics runs read-only, tenant-scoped, time-budgeted checks.
 *   A check that cannot run returns "unknown". It never guesses.
 *
 * Nothing here changes customer data or permissions.
 */
import type { JsonObject, PersistenceClient } from "../../types.ts";
import type {
  ToolExecutionContext,
  ToolImplementation,
  ToolName,
  ToolResult,
} from "../types.ts";
import {
  redactText,
  sanitizeContext,
  STATUS_LABEL,
} from "../../../_shared/bloom-support/policy.ts";

export const SUPPORT_TOOL_NAMES = [
  "report_support_problem",
  "check_support_request",
  "run_self_diagnostics",
] as const satisfies readonly ToolName[];

const SUPPORT_TOOL_SET = new Set<string>(SUPPORT_TOOL_NAMES);
const STAFF_ROLES = new Set(["platform_admin", "platform_operator", "support"]);
const ERROR_TEXT_LIMIT = 300;
const FAILED_RUN_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Below the 8s authenticated statement_timeout so a slow check never fails the turn. */
export const CHECK_BUDGET_MS = 5_000;

export const DIAGNOSTIC_AREAS = [
  "all",
  "customers",
  "pos_sync",
  "segments",
  "email_sending",
] as const;
export type DiagnosticArea = (typeof DIAGNOSTIC_AREAS)[number];
export type DiagnosticStatus = "ok" | "warn" | "unknown";
export type DiagnosticCheck = {
  id: string;
  area: Exclude<DiagnosticArea, "all"> | "bloom";
  status: DiagnosticStatus;
  plain_message: string;
  evidence: { count: number | null; as_of: string };
};

// ---------------------------------------------------------------------------
// Gateway
// ---------------------------------------------------------------------------
export type SupportRpc = <T = unknown>(
  fn: string,
  args: Record<string, unknown>,
) => Promise<T>;

export class SupportRpcError extends Error {
  constructor(
    public code: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** Calls the allow-listed gateway with the server's service-role client. */
export function supportRpcFor(serviceClient: Pick<PersistenceClient, "rpc">): SupportRpc {
  return async <T>(fn: string, args: Record<string, unknown>) => {
    const { data, error } = await serviceClient.rpc("bloom_support_rpc", {
      p_fn: fn,
      p: args,
    });
    if (error) {
      throw new SupportRpcError(
        typeof error.code === "string" ? error.code : null,
        error.message ?? "Support desk request failed",
      );
    }
    return data as T;
  };
}

// ---------------------------------------------------------------------------
// Identity: the same resolve_crm_user call the support desk makes, then the
// account for the company Bloom is working in (the admin workspace, if any).
// ---------------------------------------------------------------------------
export type SupportIdentity = {
  principalId: string;
  role: string;
  staff: boolean;
  ownTenantId: string | null;
  /** A master admin working inside a client's company (admin workspace). */
  inAdminWorkspace: boolean;
  account: { id: string; name: string | null };
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function resolveSupportIdentity(
  context: ToolExecutionContext,
  rpc: SupportRpc,
): Promise<SupportIdentity> {
  // Like the support desk, identity comes from the CRM's own users table, never the request.
  const { data: user, error } = await context.serviceClient
    .from("users")
    .select("email, full_name, name, tenant_id")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the signed-in user: ${error.message}`);
  const row = isRecord(user) ? user : {};
  const ownTenantId = readString(row.tenant_id);
  let ownTenantName: string | null = null;
  if (ownTenantId) {
    const { data: tenant } = await context.serviceClient
      .from("tenants")
      .select("name")
      .eq("id", ownTenantId)
      .maybeSingle();
    ownTenantName = isRecord(tenant) ? readString(tenant.name) : null;
  }

  const principalId = await rpc<string>("resolve_crm_user", {
    auth_user_id: context.userId,
    email: readString(row.email),
    name: readString(row.full_name) ?? readString(row.name) ?? context.userName ?? readString(row.email),
    tenant_id: ownTenantId,
    tenant_name: ownTenantName,
  });
  const who = await rpc<{ role?: string }>("whoami", { actor: principalId });
  const role = readString(who?.role) ?? "client";
  // resolveUserContext only moves tenantId away from the user's own company for
  // a master admin's active admin workspace (admin-workspace.ts).
  const inAdminWorkspace = context.tenantId !== ownTenantId;
  const account = await rpc<{ id?: string; name?: string }>("account_for_crm_tenant", {
    actor: principalId,
    tenant_id: context.tenantId,
    tenant_name: inAdminWorkspace ? null : ownTenantName,
  });
  const accountId = readString(account?.id);
  if (!accountId) throw new SupportRpcError("P0002", "No support account for this company");

  return {
    principalId,
    role,
    staff: STAFF_ROLES.has(role),
    ownTenantId,
    inAdminWorkspace,
    account: { id: accountId, name: readString(account?.name) },
  };
}

// ---------------------------------------------------------------------------
// Small helpers (exported for tests)
// ---------------------------------------------------------------------------
/** One ticket per Bloom reply: retries of the same approval return the same ticket. */
export function buildSupportDedupeKey(conversationId: string, messageId: string): string {
  return `${conversationId}:${messageId}`;
}

/** Redacts secrets first, then cuts, so a cut can never expose half a token. */
export function cleanErrorText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const flat = value.replace(/\s+/g, " ").trim();
  if (!flat) return null;
  return redactText(flat).slice(0, ERROR_TEXT_LIMIT);
}

function result(args: {
  success: boolean;
  message: string;
  data?: ToolResult["data"];
  count?: number | null;
  error?: string | null;
  blockType?: ToolResult["block_type"];
}): ToolResult {
  return {
    success: args.success,
    data: args.data ?? null,
    count: args.count ?? null,
    message: args.message,
    error: args.error ?? null,
    block_type: args.blockType ?? "text",
    confirmation_required: false,
    confirmation_details: null,
  };
}

function supportUnavailable(error: unknown): ToolResult {
  const code = error instanceof SupportRpcError ? error.code : null;
  const message = code === "42501"
    ? "Bloom could not connect your sign-in to the support desk for this company. Please use the Report a problem button instead, and the team will still get it."
    : code === "54000"
      ? "This company has sent a lot of support requests today, so Bloom could not send another one. Please try again tomorrow or use the Report a problem button."
      : "Bloom could not reach the support desk right now. Nothing was sent. Please try again in a moment or use the Report a problem button.";
  console.error("[bloom-assist] support desk call failed", error instanceof Error ? error.message : error);
  return result({ success: false, message, error: "support_unavailable" });
}

function withBudget<T>(run: (signal: AbortSignal) => PromiseLike<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("check timed out"));
    }, ms);
  });
  return Promise.race([Promise.resolve(run(controller.signal)), timeout]).finally(() => clearTimeout(timer));
}

type QueryResponse = { data: unknown; error: { message?: string } | null; count?: number | null };

function unwrap(response: QueryResponse): QueryResponse {
  if (response.error) throw new Error(response.error.message ?? "query failed");
  return response;
}

// ---------------------------------------------------------------------------
// Recent failed Bloom tool runs (this company and this person, last 24h)
// ---------------------------------------------------------------------------
export type FailedToolRun = { tool: string; at: string; error: string | null };

export async function loadFailedToolRuns(
  context: ToolExecutionContext,
  now: Date,
  budgetMs = CHECK_BUDGET_MS,
): Promise<FailedToolRun[]> {
  const since = new Date(now.getTime() - DAY_MS).toISOString();
  const response = await withBudget((signal) =>
    context.serviceClient
      .from("bloom_tool_executions")
      .select("tool_name, created_at, error_message, output_message:tool_output->>message")
      .eq("tenant_id", context.tenantId)
      .eq("user_id", context.userId)
      .eq("status", "failed")
      .gte("created_at", since)
      .not("tool_name", "in", `(${SUPPORT_TOOL_NAMES.join(",")})`)
      .order("created_at", { ascending: false })
      .limit(FAILED_RUN_LIMIT)
      .abortSignal(signal), budgetMs);
  const rows = unwrap(response as QueryResponse).data;
  return (Array.isArray(rows) ? rows : []).filter(isRecord).slice(0, FAILED_RUN_LIMIT).map((row) => ({
    tool: readString(row.tool_name) ?? "unknown",
    at: readString(row.created_at) ?? since,
    // The readable message lives in the tool output; error_message is often just a code.
    error: cleanErrorText(readString(row.output_message) ?? row.error_message),
  }));
}

// ---------------------------------------------------------------------------
// report_support_problem
// ---------------------------------------------------------------------------
const KIND_HINTS = new Set(["question", "bug", "change", "feature", "other"]);

export type ReportDiagnostics = JsonObject;

export async function collectReportDiagnostics(
  context: ToolExecutionContext,
  identity: SupportIdentity,
  now = new Date(),
): Promise<ReportDiagnostics> {
  let failedRuns: FailedToolRun[] = [];
  let failedRunsStatus: "ok" | "unknown" = "ok";
  try {
    failedRuns = await loadFailedToolRuns(context, now);
  } catch (error) {
    failedRunsStatus = "unknown";
    console.error("[bloom-assist] could not read recent tool failures", error instanceof Error ? error.message : error);
  }
  const client = context.clientContext ?? null;
  return {
    source: "bloom-chat",
    captured_at: now.toISOString(),
    tenant_id: context.tenantId,
    account_id: identity.account.id,
    account_name: identity.account.name,
    filed_by_staff: identity.staff,
    admin_workspace: identity.inAdminWorkspace,
    route: client?.route ? redactText(client.route).slice(0, 300) : null,
    user_agent: client?.user_agent ? client.user_agent.slice(0, 300) : null,
    viewport: client?.viewport ?? null,
    bloom_conversation_id: context.conversationId,
    bloom_message_id: context.messageId,
    failed_tool_runs_status: failedRunsStatus,
    failed_tool_runs: failedRuns.map((run) => ({ tool: run.tool, at: run.at, error: run.error })),
  };
}

export async function reportSupportProblem(
  params: JsonObject,
  context: ToolExecutionContext,
  rpc: SupportRpc = supportRpcFor(context.serviceClient),
): Promise<ToolResult> {
  // The executor gates this tool behind the approval card. Refuse anything else.
  if (context.approved !== true) {
    return result({ success: false, message: "This report needs the person's approval first.", error: "confirmation_required" });
  }
  const whatHappened = readString(params.what_happened) ?? "";
  const expected = readString(params.expected);
  const subject = readString(params.subject) ?? whatHappened.replace(/\s+/g, " ").slice(0, 120);
  const kindHint = readString(params.kind_hint);
  const body = expected ? `${whatHappened}\n\nWhat I expected: ${expected}` : whatHappened;

  let identity: SupportIdentity;
  try {
    identity = await resolveSupportIdentity(context, rpc);
  } catch (error) {
    return supportUnavailable(error);
  }

  const diagnostics = await collectReportDiagnostics(context, identity);
  const client = context.clientContext ?? null;
  const ticketContext = {
    ...sanitizeContext({ route: client?.route, user_agent: client?.user_agent, viewport: client?.viewport }),
    product_area: "bloom-chat",
    diagnostics,
  };

  let created: { ticket_id?: string; number?: number; duplicate_delivery?: boolean };
  try {
    created = await rpc("create_ticket", {
      actor: identity.principalId,
      ticket: {
        product: "crm",
        channel: "crm",
        subject: redactText(subject).slice(0, 120),
        body: redactText(body),
        kind_hint: kindHint && KIND_HINTS.has(kindHint) ? kindHint : null,
        priority_hint: params.urgency === "high" ? "high" : "normal",
        account_id: identity.account.id,
        context: ticketContext,
        dedupe_key: buildSupportDedupeKey(context.conversationId, context.messageId),
        // Created paused: no triage job is ever queued, so the worker cannot
        // email the requester or start engineering before a person looks.
        automation: "paused",
      },
    });
  } catch (error) {
    return supportUnavailable(error);
  }

  const ticketId = readString(created?.ticket_id);
  if (ticketId && created.duplicate_delivery !== true) {
    // The ticket is already created paused (see create_ticket above). This
    // records the reason and the bloom-chat tag; set_automation is kept as a
    // fallback for a database without the paused-on-create option.
    try {
      const bot = await rpc<string>("ensure_service_principal", { scope: "automation" });
      await rpc("set_automation", {
        actor: bot,
        ticket_id: ticketId,
        mode: "paused",
        reason: "Filed from Bloom chat. A person picks it up.",
      });
      await rpc("update_ticket", {
        actor: bot,
        ticket_id: ticketId,
        patch: { tags: ["bloom-chat"], internal_only: true, reason: "Bloom chat intake" },
      });
    } catch (error) {
      console.error("[bloom-assist] could not pause automation on a Bloom-chat ticket", ticketId, error instanceof Error ? error.message : error);
    }
  }

  const number = typeof created?.number === "number" ? created.number : null;
  const forClient = identity.inAdminWorkspace && identity.account.name ? ` for ${identity.account.name}` : "";
  return result({
    success: true,
    message: number
      ? `Sent to the Bloom support team as request #${number}${forClient}. A person will look at it. Do not say it is fixed and do not promise a time.`
      : `Sent to the Bloom support team${forClient}. A person will look at it.`,
    data: {
      ticket_number: number,
      status: STATUS_LABEL.new,
      company: identity.account.name,
      already_sent: created?.duplicate_delivery === true,
    },
  });
}

// ---------------------------------------------------------------------------
// check_support_request
// ---------------------------------------------------------------------------
const WAITING_PLAIN: Record<string, string> = {
  customer: "Waiting for your reply",
  internal: "Waiting on the support team",
  third_party: "Waiting on another company",
  deployment: "Waiting for an update to go live",
  scheduled: "Scheduled for later",
};

type TicketRow = Record<string, unknown>;

function ticketSummary(ticket: TicketRow): JsonObject {
  const status = readString(ticket.status) ?? "new";
  const waiting = readString(ticket.waiting_reason);
  return {
    request_number: typeof ticket.number === "number" ? ticket.number : null,
    subject: readString(ticket.subject),
    status: STATUS_LABEL[status] ?? status,
    waiting_on: waiting ? WAITING_PLAIN[waiting] ?? null : null,
    opened_at: readString(ticket.created_at),
    last_update_at: readString(ticket.updated_at),
  };
}

export async function checkSupportRequest(
  params: JsonObject,
  context: ToolExecutionContext,
  rpc: SupportRpc = supportRpcFor(context.serviceClient),
): Promise<ToolResult> {
  let identity: SupportIdentity;
  try {
    identity = await resolveSupportIdentity(context, rpc);
  } catch (error) {
    return supportUnavailable(error);
  }

  try {
    const wanted = typeof params.ticket_number === "number" ? params.ticket_number : null;
    if (wanted !== null) {
      const matches = await rpc<TicketRow[]>("list_tickets", {
        actor: identity.principalId,
        filters: { account_id: identity.account.id, q: String(wanted), limit: 5 },
      });
      const match = (Array.isArray(matches) ? matches : []).find((t) => t.number === wanted);
      const id = match ? readString(match.id) : null;
      if (!id) {
        return result({ success: true, message: `There is no support request #${wanted} for this company.`, data: { request_number: wanted, found: false } });
      }
      const detail = await rpc<TicketRow>("get_ticket", { actor: identity.principalId, ticket_id: id });
      const messages = Array.isArray(detail?.messages) ? detail.messages.filter(isRecord) : [];
      const lastReply = [...messages].reverse().find((m) => m.visibility === "public" && m.author_kind !== "client");
      const summary: JsonObject = {
        ...ticketSummary(detail),
        latest_reply_from_support: lastReply ? readString(lastReply.body)?.slice(0, 600) ?? null : null,
        resolution_note: readString(detail?.status) === "resolved" ? readString(detail?.resolution_summary) : null,
      };
      return result({ success: true, message: `Support request #${wanted} is ${summary.status}.`, data: summary, count: 1, blockType: "data_card" });
    }

    const open = await rpc<TicketRow[]>("list_tickets", {
      actor: identity.principalId,
      filters: { account_id: identity.account.id, view: "open", limit: 10, sort: "updated" },
    });
    const items = (Array.isArray(open) ? open : []).filter(isRecord).map(ticketSummary);
    return result({
      success: true,
      message: items.length ? `This company has ${items.length} open support request${items.length === 1 ? "" : "s"}.` : "This company has no open support requests.",
      data: items,
      count: items.length,
      blockType: items.length === 1 ? "data_card" : items.length ? "data_table" : "text",
    });
  } catch (error) {
    return supportUnavailable(error);
  }
}

// ---------------------------------------------------------------------------
// run_self_diagnostics
// ---------------------------------------------------------------------------
type CheckDefinition = {
  id: string;
  area: DiagnosticCheck["area"];
  /** Areas (besides "all") that include this check. */
  areas: DiagnosticArea[];
  run: (ctx: { client: PersistenceClient; context: ToolExecutionContext; signal: AbortSignal; now: Date }) => Promise<Omit<DiagnosticCheck, "id" | "area">>;
};

function countOf(response: QueryResponse): number {
  const r = unwrap(response);
  if (typeof r.count !== "number") throw new Error("count unavailable");
  return r.count;
}

const CHECKS: CheckDefinition[] = [
  {
    id: "customer_count",
    area: "customers",
    areas: ["customers"],
    run: async ({ client, context, signal, now }) => {
      const count = countOf(await client.from("crm_customers").select("id", { count: "exact", head: true })
        .eq("tenant_id", context.tenantId).is("deleted_at", null).abortSignal(signal) as QueryResponse);
      return {
        status: count > 0 ? "ok" : "warn",
        plain_message: count > 0 ? `There are ${count.toLocaleString("en-US")} customers on file.` : "There are no customers on file yet.",
        evidence: { count, as_of: now.toISOString() },
      };
    },
  },
  {
    id: "customers_with_purchase_data",
    area: "customers",
    areas: ["customers"],
    run: async ({ client, context, signal, now }) => {
      const count = countOf(await client.from("crm_customers").select("id", { count: "exact", head: true })
        .eq("tenant_id", context.tenantId).is("deleted_at", null)
        .or("total_spent.gt.0,custom_fields->ideal_reported_ytd.not.is.null")
        .abortSignal(signal) as QueryResponse);
      return {
        status: count > 0 ? "ok" : "warn",
        plain_message: count > 0
          ? `${count.toLocaleString("en-US")} customers have purchase information.`
          : "No customers have purchase information yet. Spending and purchase-based lists will look empty until sales or a report import arrive.",
        evidence: { count, as_of: now.toISOString() },
      };
    },
  },
  {
    id: "latest_customer_import",
    area: "customers",
    areas: ["customers"],
    run: async ({ client, context, signal, now }) => {
      const response = unwrap(await client.from("customer_intelligence_imports")
        .select("status, completed_at, accepted_row_count, rejected_row_count", { count: "exact" })
        .eq("tenant_id", context.tenantId).in("status", ["completed", "completed_with_errors"])
        .order("completed_at", { ascending: false, nullsFirst: false }).limit(1)
        .abortSignal(signal) as QueryResponse);
      const latest = Array.isArray(response.data) && isRecord(response.data[0]) ? response.data[0] : null;
      if (!latest) {
        return { status: "ok", plain_message: "No customer report imports have finished yet.", evidence: { count: 0, as_of: now.toISOString() } };
      }
      const when = readString(latest.completed_at) ?? now.toISOString();
      const rejected = typeof latest.rejected_row_count === "number" ? latest.rejected_row_count : 0;
      const withErrors = latest.status === "completed_with_errors" || rejected > 0;
      return {
        status: withErrors ? "warn" : "ok",
        plain_message: withErrors
          ? `The latest customer report import finished on ${when.slice(0, 10)}, but ${rejected.toLocaleString("en-US")} rows could not be used.`
          : `The latest customer report import finished on ${when.slice(0, 10)}.`,
        evidence: { count: typeof latest.accepted_row_count === "number" ? latest.accepted_row_count : null, as_of: when },
      };
    },
  },
  {
    id: "duplicate_built_in_segments",
    area: "segments",
    areas: ["segments"],
    run: async ({ client, context, signal, now }) => {
      const response = unwrap(await client.from("crm_segments").select("name")
        .eq("tenant_id", context.tenantId).eq("is_system_segment", true).is("deleted_at", null)
        .limit(1000).abortSignal(signal) as QueryResponse);
      const seen = new Map<string, number>();
      for (const row of Array.isArray(response.data) ? response.data.filter(isRecord) : []) {
        const key = (readString(row.name) ?? "").toLowerCase();
        if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
      }
      const duplicates = [...seen.values()].filter((n) => n > 1).reduce((sum, n) => sum + n - 1, 0);
      return {
        status: duplicates > 0 ? "warn" : "ok",
        plain_message: duplicates > 0
          ? `${duplicates} built-in segment${duplicates === 1 ? " is a copy" : "s are copies"} of another built-in segment with the same name.`
          : "Built-in segments have no duplicates.",
        evidence: { count: duplicates, as_of: now.toISOString() },
      };
    },
  },
  {
    id: "segment_members_deleted_customers",
    area: "segments",
    areas: ["segments"],
    run: async ({ client, context, signal, now }) => {
      const count = countOf(await client.from("customer_segments")
        .select("id, crm_customers!inner(id), crm_segments!inner(id)", { count: "exact", head: true })
        .eq("crm_segments.tenant_id", context.tenantId)
        .eq("crm_customers.tenant_id", context.tenantId)
        .not("crm_customers.deleted_at", "is", null)
        .abortSignal(signal) as QueryResponse);
      return {
        status: count > 0 ? "warn" : "ok",
        plain_message: count > 0
          ? `${count.toLocaleString("en-US")} segment memberships still point at customers who were deleted.`
          : "No segment memberships point at deleted customers.",
        evidence: { count, as_of: now.toISOString() },
      };
    },
  },
  {
    id: "pos_sync_failures",
    area: "pos_sync",
    areas: ["pos_sync"],
    // Service client with an explicit tenant filter: row security on this
    // table only shows a user's home company, so an admin working in a client
    // workspace would otherwise always see "no failures".
    run: async ({ context, signal, now }) => {
      const count = countOf(await context.serviceClient.from("pos_sync_jobs").select("id", { count: "exact", head: true })
        .eq("tenant_id", context.tenantId).eq("status", "failed")
        .gte("created_at", new Date(now.getTime() - DAY_MS).toISOString())
        .abortSignal(signal) as QueryResponse);
      return {
        status: count > 0 ? "warn" : "ok",
        plain_message: count > 0
          ? `${count} point-of-sale sync run${count === 1 ? "" : "s"} failed in the last 24 hours.`
          : "No point-of-sale sync runs failed in the last 24 hours.",
        evidence: { count, as_of: now.toISOString() },
      };
    },
  },
  {
    id: "email_send_failures",
    area: "email_sending",
    areas: ["email_sending"],
    // Same row-security reason as the POS check. A batch can complete with
    // some failed recipients, so count failed batches and partial failures.
    run: async ({ context, signal, now }) => {
      const count = countOf(await context.serviceClient.from("email_send_jobs").select("id", { count: "exact", head: true })
        .eq("tenant_id", context.tenantId).or("status.eq.failed,emails_failed.gt.0")
        .gte("created_at", new Date(now.getTime() - DAY_MS).toISOString())
        .abortSignal(signal) as QueryResponse);
      return {
        status: count > 0 ? "warn" : "ok",
        plain_message: count > 0
          ? `${count} email sending batch${count === 1 ? "" : "es"} had failed emails in the last 24 hours.`
          : "No email sending batches had failed emails in the last 24 hours.",
        evidence: { count, as_of: now.toISOString() },
      };
    },
  },
  {
    id: "recent_bloom_failures",
    area: "bloom",
    areas: [],
    run: async ({ context, now }) => {
      const runs = await loadFailedToolRuns(context, now);
      return {
        status: runs.length > 0 ? "warn" : "ok",
        plain_message: runs.length > 0
          ? `${runs.length}${runs.length === FAILED_RUN_LIMIT ? " or more" : ""} of your Bloom requests could not finish in the last 24 hours.`
          : "None of your Bloom requests failed in the last 24 hours.",
        evidence: { count: runs.length, as_of: now.toISOString() },
      };
    },
  },
];

export async function runSelfDiagnostics(
  params: JsonObject,
  context: ToolExecutionContext,
  options: { now?: Date; budgetMs?: number } = {},
): Promise<ToolResult> {
  const area = (DIAGNOSTIC_AREAS as readonly string[]).includes(String(params.area))
    ? (params.area as DiagnosticArea)
    : "all";
  const now = options.now ?? new Date();
  const budgetMs = options.budgetMs ?? CHECK_BUDGET_MS;
  const client = context.dataClient ?? context.serviceClient;
  const selected = CHECKS.filter((check) => area === "all" || check.areas.includes(area));

  const checks: DiagnosticCheck[] = await Promise.all(selected.map(async (check) => {
    try {
      const outcome = await withBudget((signal) => check.run({ client, context, signal, now }), budgetMs);
      return { id: check.id, area: check.area, ...outcome };
    } catch (error) {
      console.error(`[bloom-assist] diagnostic ${check.id} could not run`, error instanceof Error ? error.message : error);
      return {
        id: check.id,
        area: check.area,
        status: "unknown" as const,
        plain_message: "Bloom could not check this right now, so it is unknown. This is not a sign that something is wrong or right.",
        evidence: { count: null, as_of: now.toISOString() },
      };
    }
  }));

  const warnings = checks.filter((c) => c.status === "warn").length;
  const unknown = checks.filter((c) => c.status === "unknown").length;
  return result({
    success: true,
    message: `Ran ${checks.length} read-only checks: ${warnings} need attention, ${unknown} could not be checked. Explain the findings in plain words. Unknown means not checked, never assume the cause.`,
    data: { area, checks: checks.map((c) => ({ ...c, evidence: { ...c.evidence } })) },
    count: checks.length,
  });
}

export function supportToolImplementation(toolName: ToolName): ToolImplementation | null {
  if (!SUPPORT_TOOL_SET.has(toolName)) return null;
  switch (toolName) {
    case "report_support_problem":
      return (params, context) => reportSupportProblem(params, context);
    case "check_support_request":
      return (params, context) => checkSupportRequest(params, context);
    case "run_self_diagnostics":
      return (params, context) => runSelfDiagnostics(params, context);
    default:
      return null;
  }
}

export function isSupportTool(toolName: string): boolean {
  return SUPPORT_TOOL_SET.has(toolName);
}
