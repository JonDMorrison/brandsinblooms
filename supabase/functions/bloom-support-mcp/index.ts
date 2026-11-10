// Bloom Support MCP server (Streamable HTTP, JSON responses).
//
// Lets admins and other staff operate Bloom from ChatGPT (or any MCP
// client) with their *own* identity. Authentication:
//   OAuth 2.1 (ChatGPT connectors: each person signs in as themselves), or
//   Authorization: Bearer bsk_…            (other MCP clients)
// Keys are never accepted in the URL: URLs are logged by proxies and providers.
// Keys are minted per person in Bloom Support → Settings → API keys and can be
// read-only. Every tool call is authorized in the database for that person.
import {
  authenticate,
  BloomError,
  closeMcpSession,
  type Caller,
  cors,
  json,
  openMcpSession,
  touchMcpSession,
} from "../_shared/bloom-support/runtime.ts";
import { actions } from "../_shared/bloom-support/service.ts";
import { readiness } from "../_shared/bloom-support/readiness.ts";
import { authorizationServerMetadata, mcpBase, protectedResourceMetadata } from "../_shared/bloom-support/oauth.ts";
import { mutationInputSchema, normalizeMcpSessionId, prepareMcpMutation } from "../_shared/bloom-support/mcp-idempotency.ts";

type Schema = Record<string, unknown>;
interface Tool { name: string; description: string; inputSchema: Schema; readOnly: boolean; run: (c: Caller, a: Record<string, unknown>) => Promise<unknown> | unknown }

const S = (props: Record<string, Schema>, required: string[] = []): Schema => ({ type: "object", properties: props, required, additionalProperties: false });
const str = (d: string, e?: string[], maxLength?: number): Schema => ({
  type: "string",
  description: d,
  ...(e ? { enum: e } : {}),
  ...(maxLength ? { maxLength } : {}),
});
const id = (d = "UUID") => str(d);
const STATUSES = ["new", "working", "waiting", "needs_owner", "resolved"];

const TOOLS: Tool[] = [
  { name: "whoami", readOnly: true, description: "Your Bloom identity, role and permissions.", inputSchema: S({}), run: (c) => actions.me(c) },
  { name: "queue_summary", readOnly: true, description: "Counts by status, your open tickets, human-owned tickets, open escalations, features awaiting decision, job health and automation switches.", inputSchema: S({}), run: (c) => actions.summary(c) },
  { name: "health", readOnly: true, description: "Integration status and every missing configuration value.", inputSchema: S({}), run: (c) => actions.health(c) },
  { name: "readiness", readOnly: true, description: "Honest readiness per capability: implemented, configured (missing settings named), tested, enabled, and last live evidence. Use this before saying anything works.", inputSchema: S({}), run: (c) => readiness(c) },
  { name: "acknowledge_escalation", readOnly: false, description: "Take ownership of an escalation (stops fallback routing to the other owner).", inputSchema: S({ escalation_id: id(), note: str("Note") }, ["escalation_id"]), run: (c, a) => actions.acknowledgeEscalation(c, String(a.escalation_id), a.note as string) },
  {
    name: "list_tickets", readOnly: true, description: "Search and filter support tickets across BloomSites, CRM and POS. Status values: new, working, waiting, needs_owner (Needs admin), resolved.",
    inputSchema: S({ view: str("Queue view", ["needs_attention", "mine", "open", "unassigned", "urgent", "due_soon", "overdue", "waiting_customer", "needs_owner", "recently_resolved"]),
      status: str("Comma-separated statuses"), product: str("Product", ["cms", "crm", "pos", "platform", "unknown"]), q: str("Free text, #number, client or requester"), account_id: id(), owner: str("'me', 'none' or principal id"),
      kind: str("Type: question, bug, change, incident, feature, other"), priority: str("Comma-separated priorities"), cursor: str("next_cursor from a previous call"), limit: { type: "number" } }),
    run: (c, a) => actions.listTickets(c, { ...a, envelope: "true" }),
  },
  { name: "get_ticket", readOnly: true, description: "Full ticket: conversation (public + internal for staff), attachments, related tickets, activity, jobs, operations, engineering and escalations.", inputSchema: S({ ticket_id: id() }, ["ticket_id"]), run: (c, a) => actions.getTicket(c, String(a.ticket_id)) },
  {
    name: "create_ticket", readOnly: false, description: "Open a support request (for yourself or on behalf of a client account). Bloom triages it automatically.",
    inputSchema: S({ body: str("What is happening / what is needed", undefined, 20_000), subject: str("Short title", undefined, 300), account_id: id("Client account (see find_client)"), product: str("Product", ["cms", "crm", "pos", "platform", "unknown"]), conversation_id: id("Add as another request in an existing conversation"), priority: str("Priority", ["low", "normal", "high", "urgent"]), idempotency_key: str("Repeat-safe key") }, ["body"]),
    run: (c, a) => actions.createTicket(c, a, "chatgpt"),
  },
  {
    name: "reply_to_ticket", readOnly: false, description: "Add a message. visibility=public is emailed to the client (and takes the ticket over from Bloom); visibility=internal is a private note.",
    inputSchema: S({ ticket_id: id(), body: str("Message", undefined, 20_000), visibility: str("public or internal", ["public", "internal"]), idempotency_key: str("Repeat-safe key") }, ["ticket_id", "body", "visibility"]),
    run: (c, a) => actions.addMessage(c, String(a.ticket_id), a),
  },
  {
    name: "update_ticket", readOnly: false, description: "Change status, priority, owner, next action, kind or category. Resolving needs resolution_summary. Pass version to avoid overwriting someone else's change.",
    inputSchema: S({ ticket_id: id(), version: { type: "number" }, status: str("Status", STATUSES), waiting_reason: str("Required for waiting", ["customer", "internal", "third_party", "deployment", "scheduled"]),
      decision_needed: str("Required for needs_owner"), accountable: str("Which admin decides: one admin alert inbox (jon or jeff) or both", ["jon", "jeff", "both"]), recommendation: str("Recommended next step"), decision_due_at: str("ISO deadline"),
      executor: str("Who is doing the work", ["bloom", "person"]), next_action_due_at: str("ISO deadline for the next action"), resolution_evidence: { type: "object" }, priority: str("Priority", ["low", "normal", "high", "urgent"]), owner_id: id("Principal id or empty"), next_action: str("Next action"), kind: str("Kind"), category: str("Category"), resolution_summary: str("Shown to the client when resolved. One or two plain sentences on what they can do now, no technical terms (e.g. \"You can upload photos to your gallery again.\"). Put technical detail in resolution_evidence."), resolution_verified: { type: "boolean" }, reason: str("Why") }, ["ticket_id"]),
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
  { name: "start_investigation", readOnly: false, description: "Start (or join) an engineering investigation for a bug ticket. When an admin opens it (otherwise an admin is asked to start it), Bloom reproduces, fixes on an isolated branch, and releases only if policy allows.", inputSchema: S({ ticket_id: id(), note: str("What you know"), existing_issue_id: id("Join an existing engineering issue") }, ["ticket_id"]), run: (c, a) => actions.startInvestigation(c, String(a.ticket_id), a) },
  { name: "start_repair", readOnly: false, description: "Let Bloom's isolated coding agent work on a bug that Bloom or Support reported. Only an admin can do this. Review the evidence first: start it only for a contained bug with clear intended behaviour. Nothing is released without the release policy or an admin's approval.", inputSchema: S({ issue_id: id(), note: str("Why it is safe to start") }, ["issue_id"]), run: (c, a) => actions.startRepair(c, String(a.issue_id), a.note as string | undefined) },
  { name: "engineering_status", readOnly: true, description: "Engineering issues with PR, eligibility, deployment and verification state.", inputSchema: S({ status: str("Comma-separated statuses") }), run: (c, a) => actions.listEngineering(c, a.status as string) },
  { name: "resume_release_tracking", readOnly: false, description: "Admin only: resume existing deployment tracking and production verification (including its existing-policy automatic rollback) of an already recorded merged/deploying/verifying release at its exact current version. Joins existing work; never launches a repair, approves or merges code, changes ownership, or resets exhausted retries. Use engineering_status first.", inputSchema: S({ issue_id: id(), version: { type: "integer", minimum: 1 } }, ["issue_id", "version"]), run: (c, a) => actions.resumeRelease(c, String(a.issue_id), Number(a.version)) },
  { name: "approve_fix", readOnly: false, description: "Platform administrator only: approve a fix that needs review (status awaiting_approval) so Bloom may release it once checks are green.", inputSchema: S({ issue_id: id(), note: str("Reason") }, ["issue_id"]), run: (c, a) => actions.updateEngineering(c, String(a.issue_id), { status: "approved", note: a.note }) },
  { name: "list_escalations", readOnly: true, description: "Open items waiting for an admin.", inputSchema: S({ include_resolved: { type: "boolean" } }), run: (c, a) => actions.listEscalations(c, a.include_resolved !== true) },
  { name: "record_decision", readOnly: false, description: "Resolve an escalation with your decision.", inputSchema: S({ escalation_id: id(), decision: str("Decision") }, ["escalation_id", "decision"]), run: (c, a) => actions.resolveEscalation(c, String(a.escalation_id), String(a.decision)) },
  { name: "list_feature_requests", readOnly: true, description: "Feature requests with the customer evidence linked to each.", inputSchema: S({ status: str("Status", ["awaiting_decision", "accepted", "declined", "planned", "shipped"]) }), run: (c, a) => actions.listFeatures(c, a.status as string) },
  { name: "decide_feature_request", readOnly: false, description: "Admins with the feature-decision permission only: accept, decline, plan or mark shipped.", inputSchema: S({ feature_request_id: id(), decision: str("Decision", ["accepted", "declined", "planned", "shipped"]), note: str("Note for the record") }, ["feature_request_id", "decision"]), run: (c, a) => actions.decideFeature(c, String(a.feature_request_id), String(a.decision), a.note as string) },
  { name: "route_feature_request", readOnly: false, description: "Send a ticket's request to an admin as a feature request (or attach it as evidence to an existing one).", inputSchema: S({ ticket_id: id(), title: str("Feature title"), feature_request_id: id("Existing feature request") }, ["ticket_id"]), run: (c, a) => actions.routeFeature(c, String(a.ticket_id), a) },
  { name: "escalate_ticket", readOnly: false, description: "Escalate a ticket to an admin. Audience picks an admin alert inbox (jon or jeff) or both.", inputSchema: S({ ticket_id: id(), audience: str("Who", ["jon", "jeff", "both"]), reason: str("Reason"), detail: str("Detail") }, ["ticket_id", "reason"]), run: (c, a) => actions.escalate(c, String(a.ticket_id), a) },
  { name: "merge_tickets", readOnly: false, description: "Merge a duplicate ticket into another ticket from the SAME client (messages, attachments and source references are kept; the old ticket points to the new one). For different clients use link_problem.", inputSchema: S({ ticket_id: id("Duplicate ticket"), into_ticket_id: id("Ticket to keep"), reason: str("Reason") }, ["ticket_id", "into_ticket_id"]), run: (c, a) => actions.mergeTickets(c, String(a.ticket_id), String(a.into_ticket_id), a.reason as string) },
  { name: "list_problems", readOnly: true, description: "Shared problems and incidents with their linked client tickets and engineering state.", inputSchema: S({ status: str("Status", ["open", "monitoring", "resolved"]) }), run: (c, a) => actions.listProblems(c, a.status as string) },
  { name: "create_problem", readOnly: false, description: "Create a shared problem/incident that several clients' tickets can link to (each client's conversation stays private).", inputSchema: S({ title: str("Title"), kind: str("Kind", ["problem", "incident"]), product: str("Product"), summary: str("Summary") }, ["title"]), run: (c, a) => actions.createProblem(c, a) },
  { name: "link_problem", readOnly: false, description: "Link a ticket to a shared problem (joins its investigation).", inputSchema: S({ ticket_id: id(), problem_id: id() }, ["ticket_id", "problem_id"]), run: (c, a) => actions.linkProblem(c, String(a.ticket_id), String(a.problem_id)) },
  { name: "decide_reply_after_resolution", readOnly: false, description: "A client replied to a resolved ticket: reopen it, start a new linked ticket for a different request, dismiss (e.g. thanks), or leave for review.", inputSchema: S({ ticket_id: id(), decision: str("Decision", ["reopen", "new_ticket", "dismiss", "review"]), message_id: id("The client's reply") }, ["ticket_id", "decision"]), run: (c, a) => actions.decidePostReply(c, String(a.ticket_id), String(a.decision), a.message_id as string) },
  { name: "support_metrics", readOnly: true, description: "Support reporting with definitions: open by status/priority/product/client/owner, daily incoming/resolved/backlog, response and resolution times (median/p90), reopen rate, human vs Bloom handling, verified autonomous resolutions, automation usage.", inputSchema: S({ from: str("ISO start"), to: str("ISO end") }), run: (c, a) => actions.metrics(c, a.from as string, a.to as string) },
  { name: "ticket_timers", readOnly: true, description: "Time accounting for a ticket: age, our clock (business and wall), customer/third-party waits, time per status, first response and resolution times.", inputSchema: S({ ticket_id: id() }, ["ticket_id"]), run: (c, a) => actions.timers(c, String(a.ticket_id)) },
  { name: "product_operations", readOnly: true, description: "Catalogue of product operations, their permissions, and whether BloomSites/POS operations are connected.", inputSchema: S({}), run: () => actions.operationsCatalog() },
  {
    name: "read_product", readOnly: true, description: "Run a read-only product query for a client: client.lookup, campaign.list, campaign.read, site.read, site.pages, event.list, pos.products, pos.inventory, pos.sales_summary, pos.price_history (variant_id), site.preview_link (content_id), site.catalogue.audit (staff only; optional category_id, cursor, category_cursor, limit; follow next_cursor for products and next_category_cursor for categories to inspect assignments and category scope).",
    inputSchema: S({ kind: str("Read operation"), account_id: id(), ticket_id: id(), inputs: { type: "object", description: "Operation inputs, e.g. {campaign_id} or {site_id}" } }, ["kind", "account_id"]),
    run: (c, a) => actions.readOperation(c, a),
  },
  {
    name: "preview_change", readOnly: false, description: "Prepare a product change and show exactly what it will do. Nothing changes until execute_change. Kinds: campaign.create_draft, campaign.update_draft, campaign.schedule, campaign.unschedule, site.page.update, site.create_draft, site.publish, event.update, site.section.update (inputs content_id, section_key, patch: only existing plain-text, link, number or boolean fields; images only from the site's own media), site.section.reorder (content_id, order: every section key), site.section.visibility (content_id, section_key, visible). Section changes save to the page draft only and return a preview_url; nothing goes live until site.publish. site.theme.update (patch: colors, typography, layout incl. ctaButton, logo from the site's own media, footer; navigation is refused) saves a theme draft with a preview_url; site.theme.publish makes it live; site.theme.discard removes it. site.blog.create (title, optional slug, excerpt, body as plain-text paragraphs, tags, featured_image_url from the site's own media, seo_title, seo_description) makes an unpublished draft post with a preview_url; site.blog.update (post_id; body goes to the post draft; title, slug, excerpt, tags, featured_image_url only while unpublished); site.blog.publish (post_id) makes it live. site.seo.update (content_id of a page or post; title, description, og_image from the site's media) is saved straight to the live page. site.navigation.update (items: the full menu in order; keep an item's id to keep or rename it, omit id to add, omit the item to remove; children for one dropdown level; href only to the site's own published pages or https links) saves a menu draft; site.navigation.publish makes it live; site.navigation.discard removes it. site.image.replace (content_id, section_key, field such as backgroundImage or slides.0.image, media_url from the site's own media) saves to the page draft only. site.catalogue.assign_categories (staff only; category_id, 1–500 explicit product_ids, evidence {source, reason}) adds category memberships without changing primary categories or product fields. Audit first, use verified category/SKU evidence rather than names alone, review exact scoped products and counts, then execute the stored preview; stale previews must be refreshed. No automatic undo. For site.create_draft supply name and subdomain; its verified creator and client workspace are shown in the preview and the result is linked to the client.",
    inputSchema: S({ kind: str("Change operation"), account_id: id(), ticket_id: id(), inputs: { type: "object" }, idempotency_key: str("Repeat-safe key") }, ["kind", "account_id"]),
    run: (c, a) => actions.previewOperation(c, a),
  },
  { name: "execute_change", readOnly: false, description: "Execute a previewed change exactly once. New changes require a current preview (30 minutes). If a product response is lost after the request was sent, Bloom blocks retries and reports reconciliation_needed until a person verifies the product state. Returns the result and verification only after a proven outcome.", inputSchema: S({ operation_id: id() }, ["operation_id"]), run: (c, a) => actions.executeOperation(c, String(a.operation_id)) },
  { name: "undo_change", readOnly: false, description: "Undo a completed change where the product supports restoration.", inputSchema: S({ operation_id: id() }, ["operation_id"]), run: (c, a) => actions.undoOperation(c, String(a.operation_id)) },
  {
    name: "record_reconciliation",
    readOnly: false,
    description: "Staff only: resolve a reconciliation_needed operation after independently checking the product. For a pending execute record applied or not_applied; for a pending undo record undone or not_undone. verification must say passed=true and describe the evidence checked. For a recovered site.create_draft include the exact product result in verification.result so Bloom can validate and link the site to the client. This records evidence only; it never sends the product change again.",
    inputSchema: S({
      operation_id: id(),
      outcome: str("Verified outcome", ["applied", "not_applied", "undone", "not_undone"]),
      verification: { type: "object", description: "Evidence checked in the product. Must include passed=true; may include the verified result." },
      note: str("What was checked and where", undefined, 2_000),
    }, ["operation_id", "outcome", "verification", "note"]),
    run: (c, a) => actions.recordReconciliation(c, String(a.operation_id), a.outcome, a.verification, a.note),
  },
  { name: "verify_outcome", readOnly: true, description: "Inspect an operation's result and verification, or a ticket's resolution evidence.", inputSchema: S({ operation_id: id(), ticket_id: id() }), run: (c, a) => a.operation_id ? actions.getOperation(c, String(a.operation_id)) : actions.getTicket(c, String(a.ticket_id)) },
  { name: "automation_switch", readOnly: false, description: "Pause or resume all Bloom automation (kill switch).", inputSchema: S({ enabled: { type: "boolean" } }, ["enabled"]), run: (c, a) => actions.setSetting(c, "automation_enabled", a.enabled === true) },
  { name: "list_jobs", readOnly: true, description: "Background jobs (failed, dead, running…).", inputSchema: S({ status: str("Comma-separated statuses") }), run: (c, a) => actions.listJobs(c, a.status as string) },
  { name: "retry_or_cancel_job", readOnly: false, description: "Retry a failed/dead job or cancel a queued one.", inputSchema: S({ job_id: id(), action: str("Action", ["retry", "cancel"]) }, ["job_id", "action"]), run: (c, a) => actions.controlJob(c, String(a.job_id), String(a.action)) },
];

const SERVER_INFO = { name: "bloom-support", version: "1.0.0" };

async function callerFor(req: Request, path: string): Promise<Caller> {
  if (/\/k\/bsk_/.test(path)) {
    throw new BloomError(401, "unauthenticated", "Keys in the URL are no longer accepted. Connect with OAuth or send the key as an Authorization: Bearer header, then revoke the key that was in the URL.");
  }
  return await authenticate(req);
}

function rpcResult(idv: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: idv, result };
}
function rpcError(idv: unknown, code: number, message: string) {
  return { jsonrpc: "2.0", id: idv, error: { code, message } };
}

async function handleMessage(caller: Caller, msg: Record<string, unknown>, sessionId: string | null) {
  const method = String(msg.method ?? "");
  const idv = msg.id;
  if (idv === undefined) return null; // notification
  switch (method) {
    case "initialize":
      return rpcResult(idv, {
        protocolVersion: (msg.params as { protocolVersion?: string })?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "Bloom Support for Brands in Blooms. Statuses: New, Working, Waiting, Needs admin (needs_owner), Resolved. Product changes are two-step: preview_change then execute_change. Public replies email the client; internal notes never do. Never mark a ticket resolved without verifying the outcome.",
      });
    case "ping":
      return rpcResult(idv, {});
    case "tools/list": {
      const readOnlyKey = caller.scopes.length > 0 && !caller.scopes.includes("write") && !caller.scopes.includes("*");
      return rpcResult(idv, {
        tools: TOOLS.filter((t) => t.readOnly || !readOnlyKey).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.readOnly ? t.inputSchema : mutationInputSchema(t.inputSchema),
          annotations: { readOnlyHint: t.readOnly },
        })),
      });
    }
    case "tools/call": {
      const p = (msg.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
      const tool = TOOLS.find((t) => t.name === p.name);
      if (!tool) return rpcError(idv, -32602, `Unknown tool ${p.name}`);
      // A read-only key can only call tools it can see in tools/list, whatever the tool does itself.
      const readOnlyCaller = caller.scopes.length > 0 && !caller.scopes.includes("write") && !caller.scopes.includes("*");
      if (!tool.readOnly && readOnlyCaller) {
        return rpcResult(idv, { content: [{ type: "text", text: "forbidden: This API key is read-only" }], isError: true });
      }
      try {
        const rawArguments = p.arguments ?? {};
        const prepared = tool.readOnly ? null : await prepareMcpMutation({
          callerId: caller.principalId,
          sessionId,
          requestId: idv,
          toolName: tool.name,
          arguments: rawArguments,
        });
        const out = await tool.run(
          prepared ? { ...caller, mcpMutation: { requestKey: prepared.requestKey, tool: tool.name, argumentsHash: prepared.argumentsHash } } : caller,
          prepared?.arguments ?? rawArguments,
        );
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
  if (req.method === "GET" && path.endsWith("/.well-known/oauth-protected-resource")) return json(req, protectedResourceMetadata());
  if (req.method === "GET" && (path.endsWith("/.well-known/oauth-authorization-server") || path.endsWith("/.well-known/openid-configuration"))) return json(req, authorizationServerMetadata());
  if (req.method === "GET") return new Response("Bloom Support MCP: POST JSON-RPC here.", { status: 405, headers: { Allow: "POST", ...cors(req) } });
  let caller: Caller;
  try {
    caller = await callerFor(req, path);
  } catch (e) {
    const status = e instanceof BloomError ? e.status : 401;
    return json(req, rpcError(null, -32001, e instanceof Error ? e.message : "Unauthorized"), status,
      { "WWW-Authenticate": `Bearer realm="bloom-support", resource_metadata="${mcpBase()}/.well-known/oauth-protected-resource"` });
  }
  const rawSession = req.headers.get("mcp-session-id");
  const incomingSession = normalizeMcpSessionId(rawSession);
  if (rawSession && !incomingSession) return json(req, rpcError(null, -32600, "Invalid Mcp-Session-Id"), 400);
  if (req.method === "DELETE") {
    if (!incomingSession || !await touchMcpSession(caller.principalId, incomingSession)) {
      return json(req, rpcError(null, -32001, "MCP session not found or expired"), 404);
    }
    await closeMcpSession(caller.principalId, incomingSession);
    return new Response(null, { status: 204, headers: cors(req) });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(req, rpcError(null, -32700, "Parse error"), 400);
  }
  const messages = Array.isArray(body) ? body : [body];
  const initializes = messages.some((m) => m && typeof m === "object" && (m as Record<string, unknown>).method === "initialize");
  const session = incomingSession ?? (initializes ? crypto.randomUUID() : null);
  if (incomingSession && !await touchMcpSession(caller.principalId, incomingSession)) {
    return json(req, rpcError(null, -32001, "MCP session not found or expired"), 404);
  }
  if (!incomingSession && session) await openMcpSession(caller.principalId, session);
  const responseHeaders: Record<string, string> = !incomingSession && session ? { "Mcp-Session-Id": session } : {};
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map((m) => handleMessage(caller, m, session)))).filter(Boolean);
    return out.length ? json(req, out, 200, responseHeaders) : new Response(null, { status: 202, headers: { ...cors(req), ...responseHeaders } });
  }
  const out = await handleMessage(caller, body as Record<string, unknown>, session);
  return out ? json(req, out, 200, responseHeaders) : new Response(null, { status: 202, headers: { ...cors(req), ...responseHeaders } });
});
