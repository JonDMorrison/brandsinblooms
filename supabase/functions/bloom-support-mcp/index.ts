// Bloom Support MCP server (Streamable HTTP, JSON responses).
//
// Lets Jon, Jeff and other staff operate Bloom from ChatGPT (or any MCP
// client) with their *own* identity. Authentication:
//   Authorization: Bearer bsk_…            (preferred)
//   …/bloom-support-mcp/k/bsk_…            (for clients that cannot send headers)
// Keys are minted per person in Bloom Support → Settings → API keys and can be
// read-only. Every tool call is authorized in the database for that person.
import { authenticate, authenticateApiKey, BloomError, type Caller, cors, json } from "../_shared/bloom-support/runtime.ts";
import { actions } from "../_shared/bloom-support/service.ts";

type Schema = Record<string, unknown>;
interface Tool { name: string; description: string; inputSchema: Schema; readOnly: boolean; run: (c: Caller, a: Record<string, unknown>) => Promise<unknown> | unknown }

const S = (props: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties: props, required, additionalProperties: false });
const str = (d: string, e?: string[]): Schema => (e ? { type: "string", description: d, enum: e } : { type: "string", description: d });
const id = (d = "UUID") => str(d);
const STATUSES = ["new", "working", "waiting", "needs_owner", "resolved"];

const TOOLS: Tool[] = [
  { name: "whoami", readOnly: true, description: "Your Bloom identity, role and permissions.", inputSchema: S({}), run: (c) => actions.me(c) },
  { name: "queue_summary", readOnly: true, description: "Counts by status, your open tickets, human-owned tickets, open escalations, features awaiting decision, job health and automation switches.", inputSchema: S({}), run: (c) => actions.summary(c) },
  { name: "health", readOnly: true, description: "Integration status and every missing configuration value.", inputSchema: S({}), run: (c) => actions.health(c) },
  {
    name: "list_tickets", readOnly: true, description: "Search and filter support tickets across BloomSites, CRM and POS. Status values: new, working, waiting, needs_owner (Needs Jon/Jeff), resolved.",
    inputSchema: S({ status: str("Comma-separated statuses"), product: str("Product", ["cms", "crm", "pos", "platform", "unknown"]), q: str("Free text, #number or client name"), account_id: id(), owner: str("'me', 'none' or principal id"), kind: str("Kind"), limit: { type: "number" } }),
    run: (c, a) => actions.listTickets(c, a),
  },
  { name: "get_ticket", readOnly: true, description: "Full ticket: conversation (public + internal for staff), attachments, related tickets, activity, jobs, operations, engineering and escalations.", inputSchema: S({ ticket_id: id() }, ["ticket_id"]), run: (c, a) => actions.getTicket(c, String(a.ticket_id)) },
  {
    name: "create_ticket", readOnly: false, description: "Open a support request (for yourself or on behalf of a client account). Bloom triages it automatically.",
    inputSchema: S({ body: str("What is happening / what is needed"), subject: str("Short title"), account_id: id("Client account (see find_client)"), product: str("Product", ["cms", "crm", "pos", "platform", "unknown"]), conversation_id: id("Add as another request in an existing conversation"), priority: str("Priority", ["low", "normal", "high", "urgent"]), idempotency_key: str("Repeat-safe key") }, ["body"]),
    run: (c, a) => actions.createTicket(c, a, "chatgpt"),
  },
  {
    name: "reply_to_ticket", readOnly: false, description: "Add a message. visibility=public is emailed to the client (and takes the ticket over from Bloom); visibility=internal is a private note.",
    inputSchema: S({ ticket_id: id(), body: str("Message"), visibility: str("public or internal", ["public", "internal"]), idempotency_key: str("Repeat-safe key") }, ["ticket_id", "body", "visibility"]),
    run: (c, a) => actions.addMessage(c, String(a.ticket_id), a),
  },
  {
    name: "update_ticket", readOnly: false, description: "Change status, priority, owner, next action, kind or category. Resolving needs resolution_summary. Pass version to avoid overwriting someone else's change.",
    inputSchema: S({ ticket_id: id(), version: { type: "number" }, status: str("Status", STATUSES), priority: str("Priority", ["low", "normal", "high", "urgent"]), owner_id: id("Principal id or empty"), next_action: str("Next action"), kind: str("Kind"), category: str("Category"), resolution_summary: str("What was done"), resolution_verified: { type: "boolean" }, reason: str("Why") }, ["ticket_id"]),
    run: (c, a) => {
      const { ticket_id, ...patch } = a;
      return actions.updateTicket(c, String(ticket_id), patch);
    },
  },
  { name: "take_over_ticket", readOnly: false, description: "Take a ticket over from Bloom (mode=human), pause Bloom (paused), or hand it back (auto).", inputSchema: S({ ticket_id: id(), mode: str("Mode", ["human", "paused", "auto"]), reason: str("Reason") }, ["ticket_id", "mode"]), run: (c, a) => actions.setAutomation(c, String(a.ticket_id), String(a.mode), a.reason as string) },
  { name: "link_tickets", readOnly: false, description: "Link two tickets (related, duplicate, follow_up). duplicate makes the first follow the second's fix.", inputSchema: S({ ticket_id: id(), to_ticket_id: id(), kind: str("Kind", ["related", "duplicate", "follow_up"]) }, ["ticket_id", "to_ticket_id", "kind"]), run: (c, a) => actions.linkTickets(c, String(a.ticket_id), String(a.to_ticket_id), String(a.kind)) },
  { name: "related_tickets", readOnly: true, description: "Possible duplicates and recent tickets from the same client.", inputSchema: S({ ticket_id: id() }, ["ticket_id"]), run: (c, a) => actions.related(c, String(a.ticket_id)) },
  { name: "find_client", readOnly: true, description: "Find client accounts by name, site id, tenant id or label.", inputSchema: S({ q: str("Search text") }), run: (c, a) => actions.listAccounts(c, a.q as string) },
  { name: "client_history", readOnly: true, description: "A client account with product links, contacts, tickets and recent operations.", inputSchema: S({ account_id: id() }, ["account_id"]), run: (c, a) => actions.getAccount(c, String(a.account_id)) },
  { name: "start_investigation", readOnly: false, description: "Start (or join) an engineering investigation for a bug ticket. Bloom reproduces, fixes on an isolated branch, and releases only if policy allows.", inputSchema: S({ ticket_id: id(), note: str("What you know"), existing_issue_id: id("Join an existing engineering issue") }, ["ticket_id"]), run: (c, a) => actions.startInvestigation(c, String(a.ticket_id), a) },
  { name: "engineering_status", readOnly: true, description: "Engineering issues with PR, eligibility, deployment and verification state.", inputSchema: S({ status: str("Comma-separated statuses") }), run: (c, a) => actions.listEngineering(c, a.status as string) },
  { name: "approve_fix", readOnly: false, description: "Platform administrator only: approve a fix that needs review (status awaiting_approval) so Bloom may release it once checks are green.", inputSchema: S({ issue_id: id(), note: str("Reason") }, ["issue_id"]), run: (c, a) => actions.updateEngineering(c, String(a.issue_id), { status: "approved", note: a.note }) },
  { name: "list_escalations", readOnly: true, description: "Open items waiting for Jon or Jeff.", inputSchema: S({ include_resolved: { type: "boolean" } }), run: (c, a) => actions.listEscalations(c, a.include_resolved !== true) },
  { name: "record_decision", readOnly: false, description: "Resolve an escalation with your decision.", inputSchema: S({ escalation_id: id(), decision: str("Decision") }, ["escalation_id", "decision"]), run: (c, a) => actions.resolveEscalation(c, String(a.escalation_id), String(a.decision)) },
  { name: "list_feature_requests", readOnly: true, description: "Feature requests with the customer evidence linked to each.", inputSchema: S({ status: str("Status", ["awaiting_decision", "accepted", "declined", "planned", "shipped"]) }), run: (c, a) => actions.listFeatures(c, a.status as string) },
  { name: "decide_feature_request", readOnly: false, description: "Jon only: accept, decline, plan or mark shipped.", inputSchema: S({ feature_request_id: id(), decision: str("Decision", ["accepted", "declined", "planned", "shipped"]), note: str("Note for the record") }, ["feature_request_id", "decision"]), run: (c, a) => actions.decideFeature(c, String(a.feature_request_id), String(a.decision), a.note as string) },
  { name: "route_feature_request", readOnly: false, description: "Send a ticket's request to Jon as a feature request (or attach it as evidence to an existing one).", inputSchema: S({ ticket_id: id(), title: str("Feature title"), feature_request_id: id("Existing feature request") }, ["ticket_id"]), run: (c, a) => actions.routeFeature(c, String(a.ticket_id), a) },
  { name: "escalate_ticket", readOnly: false, description: "Escalate a ticket to Jon, Jeff or both.", inputSchema: S({ ticket_id: id(), audience: str("Who", ["jon", "jeff", "both"]), reason: str("Reason"), detail: str("Detail") }, ["ticket_id", "reason"]), run: (c, a) => actions.escalate(c, String(a.ticket_id), a) },
  { name: "product_operations", readOnly: true, description: "Catalogue of product operations, their permissions, and whether BloomSites/POS operations are connected.", inputSchema: S({}), run: () => actions.operationsCatalog() },
  {
    name: "read_product", readOnly: true, description: "Run a read-only product query for a client: client.lookup, campaign.list, campaign.read, site.read, site.pages, event.list, pos.products, pos.inventory, pos.sales_summary.",
    inputSchema: S({ kind: str("Read operation"), account_id: id(), ticket_id: id(), inputs: { type: "object", description: "Operation inputs, e.g. {campaign_id} or {site_id}" } }, ["kind", "account_id"]),
    run: (c, a) => actions.readOperation(c, a),
  },
  {
    name: "preview_change", readOnly: false, description: "Prepare a product change and show exactly what it will do. Nothing changes until execute_change. Kinds: campaign.create_draft, campaign.update_draft, campaign.schedule, campaign.unschedule, site.page.update, site.create_draft, site.publish, event.update.",
    inputSchema: S({ kind: str("Change operation"), account_id: id(), ticket_id: id(), inputs: { type: "object" }, idempotency_key: str("Repeat-safe key") }, ["kind", "account_id"]),
    run: (c, a) => actions.previewOperation(c, a),
  },
  { name: "execute_change", readOnly: false, description: "Execute a previewed change exactly once (previews expire after 30 minutes). Returns the result and the post-change verification.", inputSchema: S({ operation_id: id() }, ["operation_id"]), run: (c, a) => actions.executeOperation(c, String(a.operation_id)) },
  { name: "undo_change", readOnly: false, description: "Undo a completed change where the product supports restoration.", inputSchema: S({ operation_id: id() }, ["operation_id"]), run: (c, a) => actions.undoOperation(c, String(a.operation_id)) },
  { name: "verify_outcome", readOnly: true, description: "Inspect an operation's result and verification, or a ticket's resolution evidence.", inputSchema: S({ operation_id: id(), ticket_id: id() }), run: (c, a) => a.operation_id ? actions.getOperation(c, String(a.operation_id)) : actions.getTicket(c, String(a.ticket_id)) },
  { name: "automation_switch", readOnly: false, description: "Pause or resume all Bloom automation (kill switch).", inputSchema: S({ enabled: { type: "boolean" } }, ["enabled"]), run: (c, a) => actions.setSetting(c, "automation_enabled", a.enabled === true) },
  { name: "list_jobs", readOnly: true, description: "Background jobs (failed, dead, running…).", inputSchema: S({ status: str("Comma-separated statuses") }), run: (c, a) => actions.listJobs(c, a.status as string) },
  { name: "retry_or_cancel_job", readOnly: false, description: "Retry a failed/dead job or cancel a queued one.", inputSchema: S({ job_id: id(), action: str("Action", ["retry", "cancel"]) }, ["job_id", "action"]), run: (c, a) => actions.controlJob(c, String(a.job_id), String(a.action)) },
];

const SERVER_INFO = { name: "bloom-support", version: "1.0.0" };

async function callerFor(req: Request, path: string): Promise<Caller> {
  const m = path.match(/\/k\/(bsk_[A-Za-z0-9_-]+)$/);
  if (m) return await authenticateApiKey(m[1]);
  return await authenticate(req);
}

function rpcResult(idv: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: idv, result };
}
function rpcError(idv: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: idv, error: { code, message } };
}

async function handleMessage(caller: Caller, msg: Record<string, unknown>) {
  const method = String(msg.method ?? "");
  const idv = msg.id;
  if (idv === undefined) return null; // notification
  switch (method) {
    case "initialize":
      return rpcResult(idv, {
        protocolVersion: (msg.params as { protocolVersion?: string })?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Bloom Support for Brands in Blooms. Statuses: New, Working, Waiting, Needs Jon/Jeff (needs_owner), Resolved. Product changes are two-step: preview_change then execute_change. Public replies email the client; internal notes never do. Never mark a ticket resolved without verifying the outcome.",
      });
    case "ping":
      return rpcResult(idv, {});
    case "tools/list": {
      const readOnlyKey = caller.scopes.length > 0 && !caller.scopes.includes("write") && !caller.scopes.includes("*");
      return rpcResult(idv, {
        tools: TOOLS.filter((t) => t.readOnly || !readOnlyKey).map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: t.readOnly } })),
      });
    }
    case "tools/call": {
      const p = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const tool = TOOLS.find((t) => t.name === p.name);
      if (!tool) return rpcError(idv, -32602, `Unknown tool ${p.name}`);
      try {
        const out = await tool.run(caller, p.arguments ?? {});
        return rpcResult(idv, { content: [{ type: "text", text: JSON.stringify(out ?? { ok: true }, null, 2) }], structuredContent: typeof out === "object" && out !== null && !Array.isArray(out) ? out : { result: out } });
      } catch (e) {
        const message = e instanceof BloomError ? `${e.code}: ${e.message}` : "Unexpected error";
        return rpcResult(idv, { content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      return rpcError(idv, -32601, `Method not found: ${method}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const path = new URL(req.url).pathname;
  if (req.method === "GET") return new Response("Bloom Support MCP: POST JSON-RPC here.", { status: 405, headers: { Allow: "POST", ...cors(req) } });
  if (req.method === "DELETE") return new Response(null, { status: 204, headers: cors(req) });
  let caller: Caller;
  try {
    caller = await callerFor(req, path);
  } catch (e) {
    const status = e instanceof BloomError ? e.status : 401;
    return json(req, rpcError(null, -32001, e instanceof Error ? e.message : "Unauthorized"), status, { "WWW-Authenticate": 'Bearer realm="bloom-support"' });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, rpcError(null, -32700, "Parse error"), 400);
  }
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(caller, m)))).filter(Boolean);
    return out.length ? json(req, out) : new Response(null, { status: 202, headers: cors(req) });
  }
  const out = await handleMessage(caller, body as Record<string, unknown>);
  return out ? json(req, out) : new Response(null, { status: 202, headers: cors(req) });
});
