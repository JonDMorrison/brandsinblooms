// Bloom Support REST API — used by the CRM Bloom Support dashboard, ChatGPT
// (via API keys / Actions) and any other authenticated operator tooling.
// Every route authenticates the caller and every action is re-authorized in
// the database for that caller's principal.
import { authenticate, BloomError, cors, db, errorResponse, json, readJson, rpc, str } from "../_shared/bloom-support/runtime.ts";
import { actions, requireWriteScope } from "../_shared/bloom-support/service.ts";
import { attachmentUrl, decodeBase64File, storeAttachment } from "../_shared/bloom-support/attachments.ts";
import { readiness } from "../_shared/bloom-support/readiness.ts";
import { approve, authorizationServerMetadata, authorize, register, token } from "../_shared/bloom-support/oauth.ts";
import { actOnTicket, attachmentLink, renewLink, replyToTicket, TRACK_HEADERS, viewTicket } from "../_shared/bloom-support/track.ts";

type Handler = (req: Request, params: string[], url: URL) => Promise<unknown>;
const routes: Array<[string, RegExp, Handler]> = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp("^" + pattern.replace(/:(\w+)/g, "([^/]+)") + "$"), h]);

// Read-only API keys are enforced here for every route, not per action: any request that is not a
// GET can change state, so a scoped key without "write" is refused before the route runs.
const caller = async (req: Request) => {
  const c = await authenticate(req);
  if (req.method !== "GET" && req.method !== "HEAD") requireWriteScope(c);
  return c;
};
const q = (url: URL, k: string) => url.searchParams.get(k) ?? undefined;

on("GET", "/me", async (req) => actions.me(await caller(req)));
on("GET", "/health", async (req) => actions.health(await caller(req)));
on("GET", "/readiness", async (req) => readiness(await caller(req)));
on("POST", "/escalations/:id/acknowledge", async (req, [id]) => actions.acknowledgeEscalation(await caller(req), id, str((await readJson(req)).note, 1000)));
// OAuth 2.1 for per-person ChatGPT / MCP connections.
on("GET", "/oauth/.well-known/oauth-authorization-server", () => Promise.resolve(authorizationServerMetadata()));
on("GET", "/oauth/.well-known/openid-configuration", () => Promise.resolve(authorizationServerMetadata()));
on("GET", "/.well-known/oauth-authorization-server", () => Promise.resolve(authorizationServerMetadata()));
on("POST", "/oauth/register", async (req) => register(await readJson(req), (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown"));
on("POST", "/oauth/approve", async (req) => approve(req, await readJson(req)));
on("GET", "/summary", async (req) => actions.summary(await caller(req)));
on("GET", "/notifications", async (req, _p, url) => actions.notifications(await caller(req), q(url, "mark_read") === "true"));

on("GET", "/tickets", async (req, _p, url) => {
  const f: Record<string, unknown> = {};
  for (const k of ["view", "status", "product", "kind", "priority", "account_id", "owner", "q", "automation", "tag", "age_days_min", "age_days_max", "sort", "cursor", "limit", "envelope", "include_spam"]) {
    if (url.searchParams.has(k)) f[k] = url.searchParams.get(k);
  }
  return actions.listTickets(await caller(req), f);
});
on("POST", "/tickets/bulk", async (req) => {
  const b = await readJson(req);
  return actions.bulkUpdate(await caller(req), b.ticket_ids, (b.bulk ?? {}) as Record<string, unknown>);
});
on("POST", "/tickets/:id/merge", async (req, [id]) => {
  const b = await readJson(req);
  return actions.mergeTickets(await caller(req), id, String(b.target_id), str(b.reason, 500));
});
on("POST", "/tickets/:id/spam", async (req, [id]) => actions.setSpam(await caller(req), id, (await readJson(req)).spam !== false));
on("POST", "/tickets/:id/client-action", async (req, [id]) => {
  const b = await readJson(req);
  return actions.clientAction(await caller(req), id, String(b.action), str(b.message, 20000));
});
on("POST", "/tickets/:id/post-reply", async (req, [id]) => {
  const b = await readJson(req);
  return actions.decidePostReply(await caller(req), id, String(b.decision), str(b.message_id, 40), str(b.note, 500));
});
on("GET", "/tickets/:id/timers", async (req, [id]) => actions.timers(await caller(req), id));
on("POST", "/tickets/:id/problem", async (req, [id]) => actions.linkProblem(await caller(req), id, String((await readJson(req)).problem_id)));
on("GET", "/problems", async (req, _p, url) => actions.listProblems(await caller(req), q(url, "status")));
on("POST", "/problems", async (req) => actions.createProblem(await caller(req), await readJson(req)));
on("PATCH", "/problems/:id", async (req, [id]) => actions.updateProblem(await caller(req), id, await readJson(req)));
on("GET", "/views", async (req) => actions.listViews(await caller(req)));
on("POST", "/views", async (req) => {
  const b = await readJson(req);
  return actions.saveView(await caller(req), String(b.name ?? ""), (b.filters ?? {}) as Record<string, unknown>, b.shared === true);
});
on("DELETE", "/views/:id", async (req, [id]) => actions.deleteView(await caller(req), id));
on("GET", "/reports/metrics", async (req, _p, url) => actions.metrics(await caller(req), q(url, "from"), q(url, "to")));
on("GET", "/reports/summary", async (req, _p, url) => actions.summary_report(await caller(req), q(url, "period") ?? "daily"));
on("POST", "/accounts/:id/automation", async (req, [id]) => actions.setAccountAutomation(await caller(req), id, (await readJson(req)).paused !== false));
on("POST", "/tickets/:id/redact", async (req, [id]) => {
  const c = await caller(req);
  const out = await rpc<{ storage_objects: Array<{ bucket: string; path: string }> }>("redact_ticket", { actor: c.principalId, ticket_id: id, reason: str((await readJson(req)).reason, 500) });
  // Attachment objects are removed from private storage; the ticket, events and audit log remain.
  for (const o of out.storage_objects ?? []) await db().storage.from(o.bucket).remove([o.path]).catch(() => undefined);
  return out;
});
on("POST", "/tickets", async (req) => actions.createTicket(await caller(req), await readJson(req)));
on("GET", "/tickets/:id", async (req, [id]) => actions.getTicket(await caller(req), id));
on("PATCH", "/tickets/:id", async (req, [id]) => actions.updateTicket(await caller(req), id, await readJson(req)));
on("POST", "/tickets/:id/messages", async (req, [id]) => actions.addMessage(await caller(req), id, await readJson(req)));
on("POST", "/tickets/:id/automation", async (req, [id]) => {
  const b = await readJson(req);
  return actions.setAutomation(await caller(req), id, String(b.mode), str(b.reason, 500));
});
on("POST", "/tickets/:id/link", async (req, [id]) => {
  const b = await readJson(req);
  return actions.linkTickets(await caller(req), id, String(b.to), String(b.kind ?? "related"));
});
on("GET", "/tickets/:id/related", async (req, [id]) => actions.related(await caller(req), id));
on("POST", "/tickets/:id/investigate", async (req, [id]) => actions.startInvestigation(await caller(req), id, await readJson(req)));
on("POST", "/tickets/:id/feature", async (req, [id]) => actions.routeFeature(await caller(req), id, await readJson(req)));
on("POST", "/tickets/:id/escalate", async (req, [id]) => actions.escalate(await caller(req), id, await readJson(req)));
on("POST", "/tickets/:id/attachments", async (req, [id]) => {
  const c = await caller(req);
  const type = req.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (type !== "application/json") {
    throw new BloomError(415, "unsupported_media_type", "Attachment uploads require application/json");
  }
  // One 8 MiB file is about 10.7 MiB as base64. Bound the JSON envelope before
  // parsing so chunked and dishonest Content-Length requests cannot make the
  // Edge runtime allocate an unbounded multipart/File body.
  const b = await readJson(req, 12 * 1024 * 1024);
  return storeAttachment(c.principalId, id, { name: String(b.file_name ?? "file"), type: String(b.content_type ?? ""), bytes: decodeBase64File(String(b.data_base64 ?? "")) }, { visibility: b.visibility === "internal" ? "internal" : "public" });
});
on("GET", "/attachments/:id", async (req, [id]) => attachmentUrl((await caller(req)).principalId, id));

on("GET", "/accounts", async (req, _p, url) => actions.listAccounts(await caller(req), q(url, "q")));
on("GET", "/accounts/:id", async (req, [id]) => actions.getAccount(await caller(req), id));
on("PATCH", "/accounts/:id", async (req, [id]) => actions.updateAccount(await caller(req), id, await readJson(req)));

on("GET", "/engineering", async (req, _p, url) => actions.listEngineering(await caller(req), q(url, "status")));
on("PATCH", "/engineering/:id", async (req, [id]) => actions.updateEngineering(await caller(req), id, await readJson(req)));

on("GET", "/features", async (req, _p, url) => actions.listFeatures(await caller(req), q(url, "status")));
on("POST", "/features/:id/decision", async (req, [id]) => {
  const b = await readJson(req);
  return actions.decideFeature(await caller(req), id, String(b.decision), str(b.note, 2000));
});

on("GET", "/escalations", async (req, _p, url) => actions.listEscalations(await caller(req), q(url, "all") !== "true"));
on("POST", "/escalations/:id/resolve", async (req, [id]) => {
  const b = await readJson(req);
  return actions.resolveEscalation(await caller(req), id, String(b.decision ?? ""));
});

on("GET", "/operations/catalog", async (req) => {
  await caller(req);
  return actions.operationsCatalog();
});
// Product reads use POST for their input body but change nothing, so read-only keys may call them.
on("POST", "/operations/read", async (req) => actions.readOperation(await authenticate(req), await readJson(req)));
on("POST", "/operations/preview", async (req) => actions.previewOperation(await caller(req), await readJson(req)));
on("GET", "/operations/:id", async (req, [id]) => actions.getOperation(await caller(req), id));
on("POST", "/operations/:id/execute", async (req, [id]) => actions.executeOperation(await caller(req), id));
on("POST", "/operations/:id/undo", async (req, [id]) => actions.undoOperation(await caller(req), id));

on("GET", "/jobs", async (req, _p, url) => actions.listJobs(await caller(req), q(url, "status")));
on("POST", "/jobs/:id/:action", async (req, [id, action]) => actions.controlJob(await caller(req), id, action));

on("GET", "/settings", async (req) => actions.getSettings(await caller(req)));
on("PUT", "/settings/:key", async (req, [key]) => actions.setSetting(await caller(req), key, (await readJson(req)).value));
on("GET", "/chat-spend", async (req) => actions.chatSpend(await caller(req)));
on("PUT", "/chat-spend/:tenant", async (req, [tenant]) => {
  const b = await readJson(req);
  return actions.setChatSpendCap(await caller(req), tenant, b.cap_usd ?? null, str(b.note, 500));
});
on("GET", "/staff", async (req) => actions.listStaff(await caller(req)));
on("POST", "/staff/role", async (req) => actions.setRole(await caller(req), await readJson(req)));
on("GET", "/keys", async (req) => actions.listKeys(await caller(req)));
on("POST", "/keys", async (req) => actions.createKey(await caller(req), await readJson(req)));
on("DELETE", "/keys/:id", async (req, [id]) => actions.revokeKey(await caller(req), id));
on("POST", "/service-identities", async (req) => {
  const b = await readJson(req);
  return actions.createServiceIdentity(await caller(req), String(b.name ?? "Bloom service"), String(b.scope));
});
on("GET", "/knowledge", async (req) => actions.listKnowledge(await caller(req)));
on("POST", "/knowledge", async (req) => actions.saveKnowledge(await caller(req), await readJson(req)));

// Only an approved, client-audience projection is exposed without a session.
on("GET", "/help", async (_req, _p, url) => {
  const product = q(url, "product") ?? null;
  if (product !== null && !["platform", "crm", "cms", "pos"].includes(product)) {
    throw new BloomError(400, "invalid", "Unknown help product");
  }
  const { data, error } = await db().rpc("bloom_support_public_knowledge", { p_product: product });
  if (error) throw new BloomError(503, "unavailable", "The help centre is temporarily unavailable");
  return data;
});

// Public, unauthenticated: one ticket's client view via its tracking link. The token is
// the credential; see _shared/bloom-support/track.ts for what it can and cannot do.
on("GET", "/track/:token", (_req, [token]) => viewTicket(token));
on("POST", "/track/:token/reply", (req, [token]) => replyToTicket(req, token));
on("POST", "/track/:token/action", (req, [token]) => actOnTicket(req, token));
on("GET", "/track/:token/attachments/:id", (_req, [token, id]) => attachmentLink(token, id));
on("POST", "/track/:token/renew", (req, [token]) => renewLink(req, token));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/bloom-support-api/, "") || "/";
  const extra = path.startsWith("/track/") ? TRACK_HEADERS : {};
  try {
    if (req.method === "GET" && path === "/oauth/authorize") return await authorize(url);
    if (req.method === "POST" && path === "/oauth/token") return await token(req);
    for (const [method, re, h] of routes) {
      if (method !== req.method) continue;
      const m = path.match(re);
      if (m) return json(req, await h(req, m.slice(1).map(decodeURIComponent), url), 200, extra);
    }
    throw new BloomError(404, "not_found", `No route ${req.method} ${path}`);
  } catch (e) {
    const res = errorResponse(req, e);
    for (const [k, v] of Object.entries(extra)) res.headers.set(k, v);
    return res;
  }
});
