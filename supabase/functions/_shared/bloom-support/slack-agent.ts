// Native OpenAI tools over existing permission-checked Bloom services.
// No arbitrary execution, new recurring jobs, direct sends, or policy bypasses.
import { readReleaseEvidence } from "./slack-release-evidence.ts";
import { db, env, rpc, directRpc, type Caller } from "./runtime.ts";
import { aiConfig } from "./ai.ts";
import { actions } from "./service.ts";
import { callProduct, runRead } from "./operations.ts";
import { safeTicketText } from "./ticket-slack.ts";
import { revenueFacts, statesAmount } from "./slack-revenue.ts";
import { type AgentContext, type ChatMessage, type ToolResult, ToolPermissionError, composeSlackAgentReply, openAiTools, runAgent } from "./slack-agent-core.ts";

export interface SlackAgentContext {
  allowed: boolean; principal_id: string; role: string; channel: string; route: string;
  root_ts: string; user_id: string; ticket_id: string | null;
  history: Array<{ question: string; answer: string }>;
}
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const rows = (v: unknown): Row[] => Array.isArray(v) ? v.map(row) : [];
const id = (v: unknown): string => {
  if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) throw Error("valid scoped ID required");
  return v;
};
/** Optional YYYY-MM-DD argument; a malformed date is refused rather than silently widened. */
export const isoDate = (v: unknown): string | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw Error("use YYYY-MM-DD dates");
  return v;
};
const pick = (r: Row, fields: string[]): Row => Object.fromEntries(fields.filter(k => k in r).map(k => [k, r[k]]));
const DESK = "https://bloomsuite.app/admin/bloom-support";
const PUBLIC_SOURCE = "https://bloomsuite.app/support";

/** Both conversation implementations share the same model destination boundary. */
export function isSlackModelEndpoint(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === "https://api.openai.com" && !url.username && !url.password
      && url.pathname.replace(/\/$/, "") === "/v1" && !url.search && !url.hash;
  } catch { return false; }
}

/** Metadata only: never log tokens, channel content, member lists or API bodies. */
export function privacyDiagnostic(channel: string, data: unknown): Record<string, unknown> {
  const r = row(data), ch = row(r.channel);
  const label = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_:, -]{1,160}$/.test(v) ? v : undefined;
  return { event: "bloom_slack_privacy_check", channel, error: label(r.error), needed: label(r.needed), provided: label(r.provided),
    id_matches: ch.id === channel, is_private: ch.is_private === true, is_shared: ch.is_shared === true, is_ext_shared: ch.is_ext_shared === true };
}
export type StaffChannelReason = "ok" | "public" | "shared" | "lookup_failed" | "not_configured";
export interface StaffChannelCheck { allowed: boolean; reason: StaffChannelReason; isPrivate?: boolean }

/** slack_agent.allow_any_staff_channel; anything but an explicit true is off. */
async function allowAnyStaffChannel(): Promise<boolean> {
  try { return row(await rpc("setting", { key: "slack_agent" })).allow_any_staff_channel === true; }
  catch { return false; }
}

/**
 * The single disclosure rule for Bloom's Slack conversations. Staff identity
 * and route binding decide who may ask; this decides whether the channel may
 * receive ticket and client records. Shared channels and failed lookups are
 * always refused. Private internal channels are allowed. Public internal
 * channels are allowed only when slack_agent.allow_any_staff_channel is true.
 */
export async function checkStaffChannel(channel: string): Promise<StaffChannelCheck> {
  const token = env("BLOOM_SUPPORT_SLACK_BOT_TOKEN");
  if (!token) { console.warn(JSON.stringify(privacyDiagnostic(channel, { error: "not_configured" }))); return { allowed: false, reason: "not_configured" }; }
  let data: Row;
  try {
    const res = await fetch(`https://slack.com/api/conversations.info?channel=${encodeURIComponent(channel)}`, {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) { console.warn(JSON.stringify(privacyDiagnostic(channel, { error: `http_${res.status}` }))); await res.body?.cancel(); return { allowed: false, reason: "lookup_failed" }; }
    data = row(await res.json());
  } catch { console.warn(JSON.stringify(privacyDiagnostic(channel, { error: "lookup_unavailable" }))); return { allowed: false, reason: "lookup_failed" }; }
  const ch = row(data.channel);
  if (data.ok !== true || ch.id !== channel) { console.warn(JSON.stringify(privacyDiagnostic(channel, data))); return { allowed: false, reason: "lookup_failed" }; }
  if (ch.is_shared === true || ch.is_ext_shared === true) {
    if (ch.is_private === true) console.warn(JSON.stringify(privacyDiagnostic(channel, data)));
    return { allowed: false, reason: "shared" };
  }
  if (ch.is_private === true) return { allowed: true, reason: "ok", isPrivate: true };
  return await allowAnyStaffChannel() ? { allowed: true, reason: "ok" } : { allowed: false, reason: "public" };
}

export async function answerWithSlackAgent(c: SlackAgentContext, question: string, jobId: string): Promise<string | null> {
  const config = row(await rpc("setting", { key: "slack_agent" }));
  if (config.enabled !== true) return null;
  const cfg = await aiConfig();
  if (cfg.provider !== "openai" || !env("OPENAI_API_KEY")) return null;
  if (!isSlackModelEndpoint(cfg.baseUrl)) return null;
  const channelCheck = await checkStaffChannel(c.channel);
  const privateChannel = channelCheck.allowed;
  const confirmedPrivate = channelCheck.allowed && channelCheck.isPrivate === true;
  const ctx: AgentContext = {
    jobId, principalId: c.principal_id, role: c.role, channel: c.channel, route: c.route,
    rootTs: c.root_ts, ticketId: c.ticket_id, question, history: c.history, privateChannel, confirmedPrivate,
  };
  const caller: Caller = { principalId: c.principal_id, role: c.role, via: "service", scopes: [], name: null };
  const tickets = new Set<string>(c.ticket_id ? [c.ticket_id] : []);
  const accounts = new Set<string>();
  const customers = new Map<string, Set<string>>();
  const evidenceVersions = new Map<string, number>();
  const sources = new Map<string, string>();
  const revenueResults: unknown[] = [];
  const authorize = async (): Promise<boolean> => {
    const { data: current, error } = await db().rpc("bloom_support_slack_conversation_context", { p_job: jobId });
    return !error && current?.allowed === true && current.principal_id === c.principal_id && current.role === c.role
      && current.channel === c.channel && current.route === c.route && current.user_id === c.user_id && current.root_ts === c.root_ts && current.ticket_id === c.ticket_id;
  };
  const audit = async (name: string, outcome: string) => {
    await rpc("log", { actor: c.principal_id, ticket_id: c.ticket_id, action: "slack.agent.tool", detail: { job_id: jobId, tool: name, outcome, route: c.route } });
  };
  const getTicket = async (value: unknown): Promise<Row> => {
    const ticketId = id(value);
    if (!tickets.has(ticketId) || (c.ticket_id && c.ticket_id !== ticketId)) throw Error("ticket is outside this conversation");
    const t = row(await actions.getTicket(caller, ticketId));
    if (t.spam || t.merged_into) throw Error("ticket is unavailable");
    if (row(t.account).id) accounts.add(id(row(t.account).id));
    return t;
  };
  const source = (label: string, url = DESK): string => { sources.set(label, url); return label; };
  const ticketSource = (t: Row) => source(`Support request #${Number(t.number)}`, `${DESK}?ticket=${id(t.id)}`);
  const ticketFacts = (t: Row): Row => ({
    ...pick(t, ["id", "number", "subject", "product", "kind", "status", "priority", "summary", "next_action", "automation", "executor", "updated_at", "first_response_at", "last_customer_message_at", "last_team_message_at", "resolution_verified"]),
    account: pick(row(t.account), ["id", "name"]),
    messages: rows(t.messages).filter(m => m.ticket_id === t.id || m.ticket_id === null).slice(-6).map(m => pick(m, ["author_kind", "visibility", "body", "created_at", "delivery"])),
    engineering: pick(row(t.engineering), ["id", "status", "title", "pull_request", "deployment", "verification", "updated_at"]),
    deliveries: rows(t.emails).slice(0, 5).map(e => pick(e, ["purpose", "status", "created_at"])),
    jobs: rows(t.jobs).slice(0, 5).map(j => pick(j, ["kind", "status", "updated_at"])),
  });
  if (c.ticket_id && privateChannel) await getTicket(c.ticket_id);
  const execute = async (name: string, a: Row): Promise<ToolResult> => {
    if (name !== "product_knowledge" && !privateChannel) throw new ToolPermissionError("private staff channel required");
    switch (name) {
      case "product_knowledge": {
        const result = rows(await rpc("search_knowledge", { product: a.product === "all" ? null : a.product, q: a.query, limit: 5 }));
        return { source: source("Approved product guidance", PUBLIC_SOURCE), data: { matched: result.length, articles: result.map(r => pick(r, ["id", "title", "body", "product", "updated_at"])) } };
      }
      case "major_projects": {
        const result = await callProduct("cms", "major_projects.list", {}, 10000);
        return { source: source("Active Major Projects", "https://bloomsites.app/dashboard/admin/major-projects"), data: { results: rows(result.projects).slice(0, 10).map(r => pick(r, ["project_name", "stage", "next_action", "next_action_owner", "updated_at"])), limited_to: 10 } };
      }
      case "feature_requests": {
        const { data, error } = await db().rpc("bloom_support_slack_feature_summary", {});
        if (error) throw Error("feature lookup unavailable");
        return { source: source("Recorded feature requests", `${DESK}?view=features`), data: { results: rows(data).slice(0, 10).map(r => pick(r, ["title", "status", "product", "updated_at"])), limited_to: 10 } };
      }
      case "revenue_by_client": {
        if (!confirmedPrivate) throw new ToolPermissionError("revenue requires a private Slack channel");
        const { data, error } = await db().rpc("bloom_support_slack_revenue_by_client", {
          p_job: jobId, p_from: isoDate(a.from), p_to: isoDate(a.to),
          p_category: typeof a.category === "string" && a.category.trim() ? a.category.trim().slice(0, 60) : null,
        });
        if (error?.code === "42501") throw new ToolPermissionError("revenue refused for this conversation");
        if (error) throw Error("revenue lookup unavailable");
        revenueResults.push(data);
        return { source: source("Recorded POS sales by garden centre"), data };
      }
      case "client_customer_overview":
      case "find_client_customer":
      case "client_customer_profile": {
        const accountId = id(a.account_id);
        if (!accounts.has(accountId) || !["platform_admin", "platform_operator"].includes(c.role)) throw Error("authorized client selection required");
        const kind = name === "client_customer_overview" ? "overview" : name === "find_client_customer" ? "find" : "profile";
        const customerId = kind === "profile" ? id(a.customer_id) : null;
        if (customerId && !customers.get(accountId)?.has(customerId)) throw Error("find this customer in the selected client first");
        const { data, error } = await db().rpc("bloom_support_slack_client_intelligence", { p_job: jobId, p_account: accountId, p_kind: kind, p_query: kind === "find" ? a.query : null, p_customer: customerId });
        if (error) throw Error("client intelligence unavailable");
        if (kind === "find") {
          const allowed = customers.get(accountId) ?? new Set<string>();
          for (const customer of rows(row(row(data).data).results)) allowed.add(id(customer.customer_id));
          customers.set(accountId, allowed);
        }
        return { source: source("Scoped client customer evidence"), data };
      }
      case "draft_support_reply": {
        const t = await getTicket(c.ticket_id);
        if (evidenceVersions.get(id(t.id)) !== Number(t.version)) throw Error("Read the current ticket evidence before preparing its reply");
        const { data, error } = await db().rpc("bloom_support_prepare_slack_reply", { p_job: jobId, p_body: a.body });
        if (error) throw Error("draft was not confirmed");
        return { source: source("Reply approvals", `${DESK}?view=approvals`), data,
          receipt: `A reply draft is recorded for request #${Number(t.number)} in Reply approvals. It has not been sent. Review its exact recipient and text before approving.` };
      }
      case "support_overview":
        return { source: source("Live support overview"), data: await actions.summary(caller) };
      case "find_clients": {
        const matches = rows(await actions.listAccounts(caller, String(a.query))).slice(0, 10);
        const normalized = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const exact = matches.filter(r => normalized(r.name) === normalized(a.query));
        const selected = matches.length === 1 ? matches : exact.length === 1 ? exact : [];
        for (const account of selected) accounts.add(id(account.id));
        return { source: source("Authorized client directory"), data: { results: matches.map(r => pick(r, ["id", "name"])), selected_account_id: selected[0]?.id ?? null, limited_to: 10, instruction: selected.length ? "Use the selected client only." : "Several or no clients matched. Ask for the exact client name; do not combine or guess." } };
      }
      case "client_context": {
        const accountId = id(a.account_id);
        if (!accounts.has(accountId)) throw Error("find the client first");
        const account = row(await actions.getAccount(caller, accountId));
        const history = rows(await actions.listTickets(caller, { account_id: accountId, limit: 8 }));
        for (const t of history) if (!c.ticket_id) tickets.add(id(t.id));
        return { source: source("Client account and support history"), data: { account: pick(account, ["id", "name", "links", "notes", "automation_paused"]), requests: history.map(t => pick(t, ["id", "number", "subject", "status", "product", "updated_at"])), limited_to: 8 } };
      }
      case "find_tickets": {
        const found = rows(await actions.listTickets(caller, { q: a.query, ...(a.status === "all" ? {} : { status: a.status }), limit: 10 }));
        for (const t of found) tickets.add(id(t.id));
        return { source: source("Live support requests"), data: { results: found.map(t => pick(t, ["id", "number", "subject", "status", "priority", "product", "account", "updated_at", "next_action"])), limited_to: 10 } };
      }
      case "ticket_evidence": {
        const t = await getTicket(a.ticket_id);
        evidenceVersions.set(id(t.id), Number(t.version));
        return { source: ticketSource(t), data: ticketFacts(t) };
      }
      case "pending_replies": {
        const pending = rows(await directRpc("bloom_support_list_approval_queue", { p_actor: c.principal_id, p_status: "pending" }));
        return { source: source("Reply approvals", `${DESK}?view=approvals`), data: { pending_total: pending.length, results: pending.slice(0, 10).map(r => pick(r, ["id", "ticket_id", "subject", "hold_reason", "created_at", "status", "ticket", "needs_refresh"])), instruction: "Review exact recipients and full content in Reply approvals before approving. This lookup never sends anything." } };
      }
      case "read_product": {
        const accountId = id(a.account_id);
        if (!accounts.has(accountId)) throw Error("find the client first");
        const result = await runRead(caller, { kind: String(a.operation), account_id: accountId, ticket_id: c.ticket_id, inputs: {} });
        return { source: source(`Live ${String(a.operation)} record`), data: result };
      }
      case "release_status": {
        if(!(await checkStaffChannel(c.channel)).allowed)throw Error("staff channel no longer verified");
        const evidence=await readReleaseEvidence(c,jobId);
        for(const [i,url] of evidence.links.entries())source(`Release record ${i+1}`,url);
        return {source:source("Recent release evidence",evidence.links[0]??`${DESK}?view=engineering`),data:evidence.data,fallback:evidence.fallback};
      }
      case "request_human": {
        const t = await getTicket(c.ticket_id);
        const result = await actions.escalate(caller, id(t.id), { audience: "both", reason: "Human help requested in Slack", detail: "The existing ticket contains the conversation and evidence. Staff requested human help in its authorized Slack thread.", dedupe_key: `slack-agent-human:${jobId}` });
        return { source: ticketSource(t), data: result, receipt: `Human escalation recorded for request #${Number(t.number)}. A person's response or notification delivery has not been confirmed by this action.` };
      }
      case "request_repair":
      case "resume_release": {
        const t = await getTicket(c.ticket_id);
        const { data, error } = await db().rpc("bloom_support_slack_request_repair", { p_job: jobId, p_resume: name === "resume_release" });
        if (error) throw Error("repair or release request was not confirmed");
        const result = row(data);
        const descriptions: Record<string, string> = {
          queued: "A repair was queued through the existing authorized pipeline. Merge, deployment and customer-flow verification are not yet complete.",
          already_active: "The existing repair is already active. No duplicate coding session was started.",
          human_review_required: "A human stop is recorded. No additional automated repair was started; an authorized person must review the issue.",
          recorded_for_owner: "The issue is recorded for an authorized owner to start. No coding session was started by this request.",
          existing_work: "Engineering work already exists beyond the repair-start stage. No duplicate repair was started.",
          release_tracking_requested: "Tracking was requested for an already merged release. This does not confirm that deployment or affected-flow verification succeeded.",
        };
        return { source: ticketSource(t), data: result, receipt: `Request #${Number(t.number)}: ${descriptions[String(result.work_state)] ?? "The workflow recorded a result; review the ticket for its exact state."}` };
      }
      case "process_support_inbox": {
        if (!["platform_admin", "platform_operator"].includes(c.role) || c.ticket_id) throw Error("owner-level private queue request required");
        const { data, error } = await db().rpc("bloom_support_slack_process_inbox", { p_job: jobId });
        if (error) throw Error("inbox work was not confirmed");
        const result = row(data);
        return { source: source("Support inbox processing"), data: result,
          receipt: `Queued ${Number(result.queued ?? 0)} routine support question(s) for the existing guarded workflow. Examined ${Number(result.examined ?? 0)}; skipped ${Number(result.skipped ?? 0)}. This action does not confirm any email was sent. Each request processes at most 25 new tickets.` };
      }
      default: throw Error("unsupported tool");
    }
  };
  const result = await runAgent(ctx, {
    authorize, execute, audit,
    model: async (messages, tools, final): Promise<ChatMessage> => {
      const day = new Date().toISOString().slice(0, 10);
      if (!await rpc("consume_usage", { bucket: `ai-total:${day}`, subject: "all", limit: cfg.maxCallsPerDayTotal })) throw Error("daily budget reached");
      if (!await rpc("consume_usage", { bucket: `ai:${day}`, subject: `slack:${c.user_id}`, limit: cfg.maxCallsPerAccountPerDay })) throw Error("staff budget reached");
      const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
        method: "POST", headers: { Authorization: `Bearer ${env("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: cfg.model, messages, tools: openAiTools(tools), tool_choice: final ? "none" : "auto", parallel_tool_calls: false, max_completion_tokens: 1100, store: false }),
        signal: AbortSignal.timeout(9000),
      });
      if (!response.ok) { await response.body?.cancel(); throw Error("model unavailable"); }
      const output = await response.json();
      await rpc("log_usage", { detail: { model: cfg.model, schema: "slack_tool_agent", account: `slack:${c.user_id}`, usage: output.usage ?? null, job_id: jobId } }).catch(() => undefined);
      const message = output.choices?.[0]?.message;
      if (!message || typeof message !== "object") throw Error("missing model response");
      return message as ChatMessage;
    },
  });
  if (!await authorize() || (privateChannel && !(await checkStaffChannel(c.channel)).allowed)) return "I can no longer verify this conversation's access. Please use the authorized support desk to check any recorded work.";
  const receipts = result.receipts.map(r => `Recorded: ${r}`).join("\n");
  const links = result.sources.slice(0, 4).filter(s => sources.has(s)).map(s => `<${sources.get(s)}|${safeTicketText(s, 80)}>`).join(" · ");
  const scope = !privateChannel ? "Client records and operational actions belong in the private Bloom support channel or the signed-in support desk." : "";
  // Revenue amounts come from the tool result, composed in code. Model prose that
  // restates an amount is replaced, so a figure the tool did not return never ships.
  const facts = revenueFacts(revenueResults);
  const text = facts && statesAmount(result.text)
    ? "Here is the recorded revenue by garden centre. Where a store's system keeps no category, it says not recorded."
    : result.text;
  return composeSlackAgentReply(text, [facts ?? "", receipts, links ? `Checked sources: ${links}` : "", scope]);
}
