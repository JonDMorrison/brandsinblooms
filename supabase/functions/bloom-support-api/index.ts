// Bloom Support REST API — used by the CRM Bloom Support dashboard, ChatGPT
// (via API keys / Actions) and any other authenticated operator tooling.
// Every route authenticates the caller and every action is re-authorized in
// the database for that caller's principal.
import { authenticate, BloomError, cors, errorResponse, json, readJson, str } from "../_shared/bloom-support/runtime.ts";
import { actions } from "../_shared/bloom-support/service.ts";
import { attachmentUrl, decodeBase64File, storeAttachment } from "../_shared/bloom-support/attachments.ts";

type Handler = (req: Request, params: string[], url: URL) => Promise<unknown>;
const routes: Array<[string, RegExp, Handler]> = [];
const on = (method: string, pattern: string, h: Handler) =>
  routes.push([method, new RegExp("^" + pattern.replace(/:(\w+)/g, "([^/]+)") + "$"), h]);

const caller = (req: Request) => authenticate(req);
const q = (url: URL, k: string) => url.searchParams.get(k) ?? undefined;

on("GET", "/me", async (req) => actions.me(await caller(req)));
on("GET", "/health", async (req) => actions.health(await caller(req)));
on("GET", "/summary", async (req) => actions.summary(await caller(req)));
on("GET", "/notifications", async (req, _p, url) => actions.notifications(await caller(req), q(url, "mark_read") === "true"));

on("GET", "/tickets", async (req, _p, url) => {
  const f: Record<string, unknown> = {};
  for (const k of ["status", "product", "kind", "account_id", "owner", "q", "automation", "limit", "before"]) if (url.searchParams.has(k)) f[k] = url.searchParams.get(k);
  return actions.listTickets(await caller(req), f);
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
  const type = req.headers.get("content-type") ?? "";
  if (type.startsWith("multipart/form-data")) {
    const form = await req.formData();
    const out = [];
    for (const v of form.getAll("file")) {
      if (v instanceof File) out.push(await storeAttachment(c.principalId, id, { name: v.name, type: v.type, bytes: new Uint8Array(await v.arrayBuffer()) }, { visibility: form.get("visibility") === "internal" ? "internal" : "public" }));
    }
    return out;
  }
  const b = await readJson(req, 22_000_000);
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
on("POST", "/operations/read", async (req) => actions.readOperation(await caller(req), await readJson(req)));
on("POST", "/operations/preview", async (req) => actions.previewOperation(await caller(req), await readJson(req)));
on("GET", "/operations/:id", async (req, [id]) => actions.getOperation(await caller(req), id));
on("POST", "/operations/:id/execute", async (req, [id]) => actions.executeOperation(await caller(req), id));
on("POST", "/operations/:id/undo", async (req, [id]) => actions.undoOperation(await caller(req), id));

on("GET", "/jobs", async (req, _p, url) => actions.listJobs(await caller(req), q(url, "status")));
on("POST", "/jobs/:id/:action", async (req, [id, action]) => actions.controlJob(await caller(req), id, action));

on("GET", "/settings", async (req) => actions.getSettings(await caller(req)));
on("PUT", "/settings/:key", async (req, [key]) => actions.setSetting(await caller(req), key, (await readJson(req)).value));
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

// Public, unauthenticated: one ticket's public thread via its tracking link.
on("GET", "/track/:token", (_req, [token]) => actions.track(token));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/bloom-support-api/, "") || "/";
  try {
    for (const [method, re, h] of routes) {
      if (method !== req.method) continue;
      const m = path.match(re);
      if (m) return json(req, await h(req, m.slice(1).map(decodeURIComponent), url));
    }
    throw new BloomError(404, "not_found", `No route ${req.method} ${path}`);
  } catch (e) {
    return errorResponse(req, e);
  }
});
